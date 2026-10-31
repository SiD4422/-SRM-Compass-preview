import os
import sys
import json
import socket
import threading
import subprocess
import statistics
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../dist"))
out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../audit/raw"))
os.makedirs(out_dir, exist_ok=True)

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

port = find_free_port()

class SilentHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=dist_dir, **kwargs)

    def log_message(self, format, *args):
        pass

class SilentServer(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        pass

server = SilentServer(('127.0.0.1', port), SilentHandler)
server_thread = threading.Thread(target=server.serve_forever, daemon=True)
server_thread.start()

pages = [
    ("home", f"http://127.0.0.1:{port}/"),
    ("apply", f"http://127.0.0.1:{port}/apply/"),
    ("eligibility", f"http://127.0.0.1:{port}/eligibility/")
]

summary = {}

try:
    for name, url in pages:
        runs = []
        print(f"\nAuditing {name} ({url}) - 3 Mobile Runs...")
        for r in range(1, 4):
            out_json = os.path.join(out_dir, f"lh_stage_f_{name}_run{r}.json")
            cmd = [
                "npx", "lighthouse",
                url,
                "--output=json",
                f'--output-path="{out_json}"',
                "--chrome-flags=--headless",
                "--form-factor=mobile",
                "--screenEmulation.mobile",
                "--screenEmulation.width=360",
                "--screenEmulation.height=640",
                "--quiet"
            ]
            print(f"  Starting Run {r}...")
            res = subprocess.run(" ".join(cmd), shell=True, capture_output=True, text=True, timeout=120)
            if os.path.exists(out_json):
                with open(out_json, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                cats = data.get("categories", {})
                auds = data.get("audits", {})

                perf = int(cats.get("performance", {}).get("score", 0) * 100)
                a11y = int(cats.get("accessibility", {}).get("score", 0) * 100)
                bp = int(cats.get("best-practices", {}).get("score", 0) * 100)
                seo = int(cats.get("seo", {}).get("score", 0) * 100)

                fcp = round(auds.get("first-contentful-paint", {}).get("numericValue", 0))
                lcp = round(auds.get("largest-contentful-paint", {}).get("numericValue", 0))
                tbt = round(auds.get("total-blocking-time", {}).get("numericValue", 0))
                cls = round(auds.get("cumulative-layout-shift", {}).get("numericValue", 0), 3)

                runs.append({
                    "run": r,
                    "performance": perf,
                    "accessibility": a11y,
                    "best_practices": bp,
                    "seo": seo,
                    "fcp_ms": fcp,
                    "lcp_ms": lcp,
                    "tbt_ms": tbt,
                    "cls": cls
                })
                print(f"    Run {r}: Perf={perf}, A11y={a11y}, BP={bp}, SEO={seo}, FCP={fcp}ms, LCP={lcp}ms, TBT={tbt}ms, CLS={cls}")
            else:
                print(f"    Run {r} did not produce file. Exit={res.returncode}. Stderr={res.stderr[:200]}")

        if runs:
            summary[name] = {
                "runs": runs,
                "median": {
                    "performance": int(statistics.median([x["performance"] for x in runs])),
                    "accessibility": int(statistics.median([x["accessibility"] for x in runs])),
                    "best_practices": int(statistics.median([x["best_practices"] for x in runs])),
                    "seo": int(statistics.median([x["seo"] for x in runs])),
                    "fcp_ms": round(statistics.median([x["fcp_ms"] for x in runs])),
                    "lcp_ms": round(statistics.median([x["lcp_ms"] for x in runs])),
                    "tbt_ms": round(statistics.median([x["tbt_ms"] for x in runs])),
                    "cls": round(statistics.median([x["cls"] for x in runs]), 3)
                }
            }
finally:
    server.shutdown()

summary_file = os.path.join(out_dir, "lh_stage_f_summary.json")
with open(summary_file, "w", encoding="utf-8") as fh:
    json.dump(summary, fh, indent=2)

print("\n--- LIGHTHOUSE STAGE F 3-RUN MEDIANS ---")
print(f"{'Page':<15} | {'Perf':<6} | {'A11y':<6} | {'BP':<6} | {'SEO':<6} | {'FCP':<8} | {'LCP':<8} | {'TBT':<8} | {'CLS':<6}")
print("-" * 80)
for name, data in summary.items():
    m = data["median"]
    print(f"{name:<15} | {m['performance']:<6} | {m['accessibility']:<6} | {m['best_practices']:<6} | {m['seo']:<6} | {m['fcp_ms']}ms{'':<4} | {m['lcp_ms']}ms{'':<4} | {m['tbt_ms']}ms{'':<4} | {m['cls']:<6}")
