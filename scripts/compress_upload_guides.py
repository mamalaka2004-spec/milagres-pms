# -*- coding: utf-8 -*-
"""
Compress the welcome-guide PDFs (image-heavy Canva exports, 48-60MB) to a
mobile-friendly size under the 50MB storage cap, then upload to the private
`property-guides` bucket and set property_guides.pdf_path.

Run from project root:  python3 scripts/compress_upload_guides.py
"""
import os, io, json, glob, urllib.request, urllib.error
import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDES_DIR = os.path.abspath(os.path.join(ROOT, "..", "boas vindas imoveis milagres"))
TARGET_MB = 20.0  # aim well under the 50MB cap

MAP = [
    ("COTINGUIBA 08", "cotinguiba-08"),
    ("Duplex", "duplex-kanui-116"),
    ("Kanui201", "kanui-201"),
    ("Kanui206", "kanui-206"),
    ("Tamoná07", "tamona-07"),
    ("Tamoná18", "tamona-18"),
    ("Villa Green", "villa-green"),
]

def load_env():
    env = {}
    with open(os.path.join(ROOT, ".env.local")) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k] = v.strip().strip('"').strip("'")
    return env

def compress(path, zoom, q):
    src = fitz.open(path)
    out = fitz.open()
    mat = fitz.Matrix(zoom, zoom)
    for page in src:
        pix = page.get_pixmap(matrix=mat, alpha=False)
        try:
            img = pix.tobytes("jpeg", jpg_quality=q)
        except TypeError:
            img = pix.tobytes("jpg")  # older pymupdf: default quality
        rect = page.rect
        npage = out.new_page(width=rect.width, height=rect.height)
        npage.insert_image(rect, stream=img)
    data = out.tobytes(garbage=4, deflate=True)
    src.close(); out.close()
    return data

def best_compress(path):
    # Step down quality/zoom until under TARGET_MB.
    for zoom, q in [(2.0, 72), (1.7, 68), (1.5, 62), (1.3, 58)]:
        data = compress(path, zoom, q)
        mb = len(data) / 1048576
        if mb <= TARGET_MB:
            return data, mb, zoom, q
    return data, mb, zoom, q  # last attempt even if slightly over

def http(method, url, key, body=None, ctype=None, extra=None):
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    if ctype:
        req.add_header("Content-Type", ctype)
    for k, v in (extra or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")

def main():
    env = load_env()
    URL = env["NEXT_PUBLIC_SUPABASE_URL"]
    KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
    files = [f for f in os.listdir(GUIDES_DIR) if f.lower().endswith(".pdf")]

    for needle, unit in MAP:
        match = next((f for f in files if needle in f), None)
        if not match:
            print("SKIP", unit, "- no file for", needle); continue
        path = os.path.join(GUIDES_DIR, match)
        orig_mb = os.path.getsize(path) / 1048576
        data, mb, zoom, q = best_compress(path)
        obj = unit + ".pdf"

        status, resp = http(
            "POST",
            URL + "/storage/v1/object/property-guides/" + obj,
            KEY, body=data, ctype="application/pdf", extra={"x-upsert": "true"},
        )
        if status not in (200, 201):
            print("FAIL upload", unit, status, resp[:160]); continue

        st2, rp2 = http(
            "PATCH",
            URL + "/rest/v1/property_guides?unit_code=eq." + unit,
            KEY, body=json.dumps({"pdf_path": obj}).encode(),
            ctype="application/json", extra={"Prefer": "return=minimal"},
        )
        flag = "OK" if st2 in (200, 204) else ("uploaded, pdf_path FAIL %s" % st2)
        print("%-3s %-18s %5.1fMB -> %4.1fMB (zoom %.1f q%d)  %s" % (flag, unit, orig_mb, mb, zoom, q, ""))

    print("Done.")

main()
