# -*- coding: utf-8 -*-
"""
Import the WhatsApp phone export into public.whatsapp_contacts (Reservas line) and
backfill conversation names. Run AFTER migration 014.

  python3 scripts/import_whatsapp_contacts.py [/path/to/contacts.csv]

Classifies each contact (guest/lead/provider/spam/personal), normalizes phones to a
canonical DDD+8 key, dedupes, upserts, and fills conversation contact_name where blank.
"""
import os, re, csv, sys, json, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    "~/Downloads/Contatos_Celular_MIlagres_Hospedagens_16:06:2026.csv")
COMPANY_ID = "a0000000-0000-0000-0000-000000000001"
RESERVAS_LINE = "58b5737b-bfab-4dc0-a747-ff0b5a875d15"

def env():
    e = {}
    for line in open(os.path.join(ROOT, ".env.local")):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); e[k] = v.strip().strip('"').strip("'")
    return e
E = env(); U = E["NEXT_PUBLIC_SUPABASE_URL"]; K = E["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": K, "Authorization": "Bearer " + K, "Content-Type": "application/json"}

def req(method, path, body=None, extra=None):
    r = urllib.request.Request(U + path, data=(json.dumps(body).encode() if body is not None else None), method=method)
    for k, v in {**H, **(extra or {})}.items(): r.add_header(k, v)
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

def digits(s): return re.sub(r"\D", "", s or "")
def canonicalBR(s):
    d = digits(s)
    if d.startswith("55") and len(d) >= 12: d = d[2:]
    if len(d) < 10: return None
    return d[:2] + d[-8:]
def e164(s):
    d = digits(s)
    if d.startswith("55") and len(d) >= 12: return "+" + d
    if len(d) in (10, 11): return "+55" + d
    return "+" + d

UNIT_PATTERNS = [
    (r"cotinguiba|08cotinguiba", "cotinguiba-08"),
    (r"kanui\s*116|kanui116|duplex", "duplex-kanui-116"),
    (r"kanui\s*201|kanui201|knaui201|kanui20y", "kanui-201"),
    (r"kanui\s*206|kanui206|kanui296", "kanui-206"),
    (r"tamona\s*0?7|tamoná\s*0?7|tamona97|tamoja07", "tamona-07"),
    (r"tamona\s*18|tamoná\s*18|tamons18", "tamona-18"),
    (r"villa green|essence\s*b?001|b001\s*essence|b001essence|essenceb001", "villa-green"),
]
def unit_hint(l):
    l = l.lower()
    for pat, unit in UNIT_PATTERNS:
        if re.search(pat, l): return unit
    if re.search(r"essence|b101", l): return "essence-b101"
    if re.search(r"kanui\s*20[345]", l): return "kanui-other"
    return None

SPAM = ["banida","banido","golpe","golpista","pilantra","rouba","vaza tag","vasa tag","invasor",
        "sorteio fake","sorteio falso","falso sorteio","sorteio mente","prêmio","premios","premio",
        "sorteio","divulga","patrocina","patrocinad","troca","detona","turbina","conquista",
        "formigueiro"," unidas","chama patrocinador","fake","intruso","ladrão","ladrao","idiota",
        "grosso","nojento","sem noção","babaca","recupera conta","vende ig","vende tag","compra ig"]
PROVIDER = ["camareira","diarista","lavanderia","lavadeira","eletricist","marceneiro","mercado",
        "mercadinho","supermercado","amigão","amigao","farmacia","farmácia","drogaria","droga popular",
        "drogabel","piscineiro","piscina","geladeira","refrigera","climatiza","ar condicionado",
        "ar-condicionado","cooler","uber","taxi","táxi","transfer","mototaxi","portaria","porteiro",
        "sindico","síndico","cabeleire","pintor"," gás"," gas","citecon","internet","telecom",
        "massagista","massagem","jangada","jangadeiro","buggy","construtora","concierge","padaria",
        "açougue","acougue","peixaria","pescados","carnes","restaurante","pizzaria","pousada",
        "beach club","hotel","agência","agencia","turismo","tour ","cartório","advocacia","advogad",
        "dentista","clinica","clínica","salão","salao","manicure","podolog","costura","costureira",
        "bordado","marmore","mármore","serralh","vidraçaria","vidracaria","estofa","tapeç","frete",
        "deposito","depósito","energisa","defesa civil","bombeiros","samu","hospital","posto de saude",
        "conselho tutelar","secretaria","defensoria","booking","airbnb","hurb","viação","ônibus","onibus",
        "jardineiro","seguranç","vigia","governanta","motorista","veterin","barbear","floricultura",
        "auto elétrica","auto eletrica","auto peças","peças","churrasqueira","chaveiro","caminhão",
        "caminhao","drone","fotograf","cerimon","arquitet","engenheiro","engenharia","designer",
        "banho e tosa","pet shop","loja","store","atelie","ateliê","semijoias","boutique"]
LEAD = ["cotação","cotacao","cotaã§ã£o","interessad","reveillon"]

def classify(label, has_unit, has_dates):
    l = label.lower()
    if has_unit and has_dates: return "guest"
    if any(k in l for k in SPAM): return "spam"
    if any(k in l for k in LEAD): return "lead"
    if any(k in l for k in PROVIDER): return "provider"
    if has_unit: return "guest_maybe"
    return "personal"

def clean_name(first, mid, last):
    name = " ".join(x for x in [first, mid, last] if x).strip()
    name = re.sub(r"\d{1,2}/\d{1,2}(/\d{2,4})?", " ", name)
    for pat, _ in UNIT_PATTERNS: name = re.sub(pat, " ", name, flags=re.I)
    name = re.sub(r"essence\s*b?\d{3}|b\d{3}\s*essence|kanui\s*\d{3}|tamon[aá]\s*\d{1,2}|cotinguiba|reveillon|cotaç\w*|interessad\w*|\bsai\b|check-?out|check-?in", " ", name, flags=re.I)
    name = re.sub(r"\bA\b", " ", name)
    name = re.sub(r"\s+", " ", name).strip(" -|/,")
    return (name or (first or "Contato")).strip()[:120]

def parse():
    seen = {}; rows = []
    with open(CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            first = (row.get("First Name") or "").strip()
            mid = (row.get("Middle Name") or "").strip()
            last = (row.get("Last Name") or "").strip()
            label = " ".join(x for x in [first, mid, last] if x).strip()
            phones = []
            for k in ["Phone 1 - Value","Phone 2 - Value","Phone 3 - Value","Phone 4 - Value"]:
                for part in (row.get(k) or "").split(":::"):
                    if part.strip(): phones.append(part.strip())
            canon = None; ph = None
            for p in phones:
                c = canonicalBR(p)
                if c: canon = c; ph = e164(p); break
            if not canon or canon in seen: continue
            seen[canon] = True
            uh = unit_hint(label); has_dates = bool(re.search(r"\d{1,2}/\d{1,2}", label))
            rows.append({
                "company_id": COMPANY_ID, "line_id": RESERVAS_LINE,
                "phone_e164": ph, "phone_canonical": canon,
                "display_name": clean_name(first, mid, last), "raw_label": label[:200],
                "category": classify(label, bool(uh), has_dates), "unit_hint": uh,
                "source": "google_contacts_2026-06",
                "metadata": {"has_dates": has_dates},
            })
    return rows

def main():
    rows = parse()
    print("parsed unique contacts:", len(rows))
    # bulk upsert in batches
    ins = 0
    for i in range(0, len(rows), 500):
        batch = rows[i:i+500]
        st, resp = req("POST", "/rest/v1/whatsapp_contacts?on_conflict=company_id,phone_canonical",
                       batch, {"Prefer": "resolution=merge-duplicates,return=minimal"})
        if st in (200, 201, 204): ins += len(batch)
        else: print("batch FAIL", st, resp[:200]); break
    print("upserted:", ins)

    # backfill conversation names on the Reservas line (only when blank/numeric)
    name_by_canon = {}
    pref = {"guest":0,"guest_maybe":1,"personal":2,"lead":3,"provider":4,"spam":9}
    for r in rows:
        c = r["phone_canonical"]
        if c not in name_by_canon or pref.get(r["category"],9) < pref.get(name_by_canon[c]["category"],9):
            name_by_canon[c] = r
    st, resp = req("GET", f"/rest/v1/whatsapp_conversations?line_id=eq.{RESERVAS_LINE}&select=id,contact_phone,contact_name")
    convs = json.loads(resp) if st == 200 else []
    updated = 0
    for cv in convs:
        cur = (cv.get("contact_name") or "").strip()
        if cur and not re.fullmatch(r"[+\d\s-]+", cur): continue  # keep real names
        c = canonicalBR(cv.get("contact_phone") or "")
        m = name_by_canon.get(c)
        if not m or m["category"] == "spam": continue
        st2, _ = req("PATCH", f"/rest/v1/whatsapp_conversations?id=eq.{cv['id']}",
                     {"contact_name": m["display_name"]}, {"Prefer": "return=minimal"})
        if st2 in (200, 204): updated += 1
    print("conversation names filled:", updated, "of", len(convs))

main()
