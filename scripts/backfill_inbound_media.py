# -*- coding: utf-8 -*-
"""
Re-host inbound WhatsApp media that is still pointing at WhatsApp's encrypted CDN
(mmg.whatsapp.net/…), which the browser can't display. For each such message we
download+decrypt via Evolution (getBase64FromMediaMessage) and upload to the public
whatsapp-media bucket, then update media_url.

  python3 scripts/backfill_inbound_media.py
Reads Supabase from .env.local and Evolution from the scratchpad .env.prod.
"""
import base64, json, re, urllib.request, urllib.error

SCRATCH = "/private/tmp/claude-501/-Users-MarceloCarvalho-Documents-ANTIGRAVITY---N8N-milagres/1e7f3800-e08f-4439-8298-78c7131fd077/scratchpad"

def load(path):
    e = {}
    for line in open(path):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); e[k] = v.strip().strip('"').strip("'")
    return e

le = load(".env.local"); pe = load(f"{SCRATCH}/.env.prod")
U = le["NEXT_PUBLIC_SUPABASE_URL"]; SK = le["SUPABASE_SERVICE_ROLE_KEY"]
BASE = pe["EVOLUTION_API_URL"].rstrip("/"); EKEY = pe["EVOLUTION_API_KEY"]
SH = {"apikey": SK, "Authorization": "Bearer " + SK}
BUCKET = "whatsapp-media"
EXT = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","audio/ogg":"ogg","audio/mpeg":"mp3","audio/mp4":"m4a","video/mp4":"mp4","video/3gpp":"3gp","application/pdf":"pdf"}

def sget(path):
    r = urllib.request.Request(U + path)
    for k, v in SH.items(): r.add_header(k, v)
    return json.load(urllib.request.urlopen(r))

def spatch(path, body):
    r = urllib.request.Request(U + path, data=json.dumps(body).encode(), method="PATCH")
    for k, v in SH.items(): r.add_header(k, v)
    r.add_header("Content-Type", "application/json"); r.add_header("Prefer", "return=minimal")
    try:
        urllib.request.urlopen(r); return True
    except urllib.error.HTTPError as e:
        print("  patch fail", e.code, e.read().decode()[:120]); return False

def supload(path, data, mime):
    r = urllib.request.Request(f"{U}/storage/v1/object/{BUCKET}/{path}", data=data, method="POST")
    for k, v in SH.items(): r.add_header(k, v)
    r.add_header("Content-Type", mime); r.add_header("x-upsert", "true")
    try:
        urllib.request.urlopen(r); return True
    except urllib.error.HTTPError as e:
        print("  upload fail", e.code, e.read().decode()[:120]); return False

def evo_base64(inst, tok, msg_id):
    r = urllib.request.Request(f"{BASE}/chat/getBase64FromMediaMessage/{inst}",
                               data=json.dumps({"message": {"key": {"id": msg_id}}, "convertToMp4": False}).encode(), method="POST")
    r.add_header("apikey", tok); r.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(r) as resp:
        return json.load(resp)

def ext_for(mime):
    if mime in EXT: return EXT[mime]
    sub = (mime.split("/")[1] if "/" in mime else "bin").split(";")[0]
    return re.sub(r"[^a-z0-9]", "", sub.lower())[:5] or "bin"

# line cache
lines = {l["id"]: l for l in sget("/rest/v1/whatsapp_lines?select=id,provider_instance,provider_token")}
# conversations cache (id -> line_id)
def conv_line(cid, cache={}):
    if cid in cache: return cache[cid]
    rows = sget(f"/rest/v1/whatsapp_conversations?select=line_id&id=eq.{cid}")
    cache[cid] = rows[0]["line_id"] if rows else None
    return cache[cid]

# fetch inbound media still on whatsapp.net
msgs = []
off = 0
while True:
    page = sget(f"/rest/v1/whatsapp_messages?select=id,external_id,conversation_id,message_type,media_url&direction=eq.inbound&message_type=in.(image,audio,video,document)&media_url=like.*whatsapp.net*&order=created_at.desc&offset={off}&limit=1000")
    msgs += page
    if len(page) < 1000: break
    off += 1000
print("mídias inbound a re-hospedar:", len(msgs))

ok = fail = skip = 0
for m in msgs:
    ext_id = m.get("external_id")
    if not ext_id: skip += 1; continue
    lid = conv_line(m["conversation_id"])
    ln = lines.get(lid) if lid else None
    if not ln or not ln.get("provider_instance"):
        skip += 1; continue
    inst = ln["provider_instance"]; tok = ln.get("provider_token") or EKEY
    try:
        data = evo_base64(inst, tok, ext_id)
        b64 = data.get("base64") or data.get("media") or ""
        mime = (data.get("mimetype") or "application/octet-stream").split(";")[0].strip()
        if not b64: fail += 1; continue
        raw = base64.b64decode(b64)
        safe = re.sub(r"[^a-zA-Z0-9_-]", "", ext_id)[:40] or str(off)
        path = f"inbound/{m['conversation_id']}/{safe}.{ext_for(mime)}"
        if not supload(path, raw, mime): fail += 1; continue
        pub = f"{U}/storage/v1/object/public/{BUCKET}/{path}"
        if spatch(f"/rest/v1/whatsapp_messages?id=eq.{m['id']}", {"media_url": pub, "media_mime_type": mime}):
            ok += 1
        else:
            fail += 1
    except urllib.error.HTTPError as e:
        print(f"  evo fail {ext_id}: {e.code}"); fail += 1
    except Exception as e:
        print(f"  err {ext_id}: {str(e)[:80]}"); fail += 1

print(f"RE-HOSPEDADAS: {ok} | falhas: {fail} | puladas: {skip}")
