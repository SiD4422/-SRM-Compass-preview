import os
import sys
import json
import time
from concurrent.futures import ProcessPoolExecutor
from playwright.sync_api import sync_playwright

script_dir = os.path.dirname(os.path.abspath(__file__))
dist_dir = os.path.abspath(os.path.join(script_dir, "..", "dist"))
axe_path = os.path.join(script_dir, "fixtures", "axe.min.js")

if not os.path.exists(axe_path):
    print(f"Error: axe script not found at {axe_path}", file=sys.stderr)
    sys.exit(1)

with open(axe_path, "r", encoding="utf-8") as f:
    axe_js = f.read()

def get_html_files():
    html_files = []
    for root, dirs, files in os.walk(dist_dir):
        for f in files:
            if f.endswith(".html"):
                html_files.append(os.path.join(root, f))
    html_files.sort()
    return html_files

def run_worker(tasks):
    violations_found = []
    audits_done = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        grouped = {}
        for file_path, vp, theme in tasks:
            key = (vp, theme)
            grouped.setdefault(key, []).append(file_path)
            
        for (vp, theme), files in grouped.items():
            page = browser.new_page(viewport={"width": vp, "height": 900})
            page.emulate_media(color_scheme=theme)
            for fpath in files:
                rel = os.path.relpath(fpath, dist_dir).replace("\\", "/")
                file_url = "file:///" + fpath.replace("\\", "/")
                page.goto(file_url)
                page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}')")
                page.evaluate(axe_js)
                res = page.evaluate("axe.run()")
                audits_done += 1
                v_list = res.get("violations", [])
                if v_list:
                    for v in v_list:
                        violations_found.append({
                            "page": rel,
                            "viewport": vp,
                            "theme": theme,
                            "id": v.get("id"),
                            "help": v.get("help"),
                            "nodes": [n.get("target") for n in v.get("nodes", [])]
                        })
            page.close()
        browser.close()
    return audits_done, violations_found

def main():
    files = get_html_files()
    if not files:
        print(f"Error: No HTML files found in {dist_dir}", file=sys.stderr)
        sys.exit(1)

    combos = [
        (360, "light"),
        (360, "dark"),
        (1440, "light"),
        (1440, "dark")
    ]
    
    worker_tasks = []
    for vp, theme in combos:
        task_list = [(f, vp, theme) for f in files]
        worker_tasks.append(task_list)
        
    total_audits = 0
    all_violations = []
    t0 = time.time()
    
    with ProcessPoolExecutor(max_workers=4) as executor:
        results = executor.map(run_worker, worker_tasks)
        for done, vios in results:
            total_audits += done
            all_violations.extend(vios)
            
    elapsed = time.time() - t0
    report = {
        "pages_count": len(files),
        "total_audits": total_audits,
        "elapsed_seconds": round(elapsed, 2),
        "violations_count": len(all_violations),
        "violations": all_violations
    }
    
    print(json.dumps(report, indent=2))
    if all_violations:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
