# -*- coding: utf-8 -*-
"""
Run AFTER migration 015. Makes whatsapp_contacts the single contact identity:
  1. Every conversation gets a contact_id (creating a contact for phones not yet in the
     phonebook), so the funnel/classification works for all conversations.
  2. Links whatsapp_contacts.guest_id to the matching guest record (by canonical phone).

  python3 scripts/backfill_contact_links.py
"""
import re, json, urllib.request, urllib.error

env = {}
for line in open(".env.local"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k] = v.strip().strip('"').strip("'")
U = env["NEXT_PUBLIC_SUPABASE_URL"]; K = env["SUPABASE_SERVICE_ROLE_KEY"]
CID = "a0000000-0000-0000-0000-000000000001"
H = {"apikey": K, "Authorization": "Bearer " + K, "Content-Type": "application/json"}

def req(method, path, body=None, extra=None):
    r = urllib.request.Request(U + path, data=(json.dumps(body).encode() if body is not None else None), method=method)
    for k, v in {**H, **(extra or {})}.items(): r.add_header(k, v)
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

def get_all(path_base):
    out = []; off = 0
    while True:
        r = urllib.request.Request(U + path_base + f"&offset={off}&limit=1000")
        for k, v in H.items():
            if k != "Content-Type": r.add_header(k, v)
        page = json.load(urllib.request.urlopen(r)); out += page
        if len(page) < 1000: break
        off += 1000
    return out

def digits(s): return re.sub(r"\D", "", s or "")
def canon(s):
    d = digits(s)
    if d.startswith("55") and len(d) >= 12: d = d[2:]
    if len(d) < 10: return None
    return d[:2] + d[-8:]
def e164(s):
    d = digits(s)
    if d.startswith("55") and len(d) >= 12: return "+" + d
    if len(d) in (10, 11): return "+55" + d
    return "+" + d
def real(n): n = (n or "").strip(); return bool(n) and not re.fullmatch(r"[+\d\s\-()]+", n)

# 1. contacts canonical -> id
contacts = get_all("/rest/v1/whatsapp_contacts?select=id,phone_canonical,guest_id&order=phone_canonical")
cid_by_canon = {c["phone_canonical"]: c["id"] for c in contacts}
print("contatos:", len(contacts))

# 2. conversations needing a contact_id
convs = get_all("/rest/v1/whatsapp_conversations?select=id,company_id,line_id,contact_phone,contact_name,contact_id")
need = [c for c in convs if not c.get("contact_id")]
print("conversas:", len(convs), "| sem contact_id:", len(need))

# create missing contacts (dedupe by canonical)
to_create = {}
for cv in need:
    ck = canon(cv["contact_phone"])
    if not ck or ck in cid_by_canon or ck in to_create: continue
    to_create[ck] = {
        "company_id": cv["company_id"] or CID, "line_id": cv["line_id"],
        "phone_e164": e164(cv["contact_phone"]), "phone_canonical": ck,
        "display_name": cv["contact_name"] if real(cv["contact_name"]) else None,
        "classification": "sem_classificacao", "source": "conversation",
    }
rows = list(to_create.values())
print("contatos a criar (de conversas):", len(rows))
for i in range(0, len(rows), 500):
    st, resp = req("POST", "/rest/v1/whatsapp_contacts?on_conflict=company_id,phone_canonical", rows[i:i+500],
                   {"Prefer": "resolution=merge-duplicates,return=representation"})
    if st in (200, 201):
        for c in json.loads(resp): cid_by_canon[c["phone_canonical"]] = c["id"]
    else: print("create FAIL", st, resp[:160])

# set conversation.contact_id
linked = 0
for cv in need:
    ck = canon(cv["contact_phone"]); cid = cid_by_canon.get(ck)
    if not cid: continue
    st, _ = req("PATCH", f"/rest/v1/whatsapp_conversations?id=eq.{cv['id']}", {"contact_id": cid}, {"Prefer": "return=minimal"})
    if st in (200, 204): linked += 1
print("conversas vinculadas a contato:", linked)

# 3. link contacts.guest_id from guests (by canonical phone)
guests = get_all("/rest/v1/guests?select=id,phone&deleted_at=is.null")
gid_by_canon = {}
for g in guests:
    ck = canon(g.get("phone"))
    if ck and ck not in gid_by_canon: gid_by_canon[ck] = g["id"]
already = {c["phone_canonical"] for c in contacts if c.get("guest_id")}
glinked = 0
for ck, gid in gid_by_canon.items():
    cid = cid_by_canon.get(ck)
    if not cid or ck in already: continue
    st, _ = req("PATCH", f"/rest/v1/whatsapp_contacts?phone_canonical=eq.{ck}&company_id=eq.{CID}", {"guest_id": gid}, {"Prefer": "return=minimal"})
    if st in (200, 204): glinked += 1
print("contatos vinculados a hóspede:", glinked)
print("DONE")
