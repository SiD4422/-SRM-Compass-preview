import os, sys, json
from playwright.sync_api import sync_playwright

script_dir = os.path.dirname(os.path.abspath(__file__))
dist_dir = os.path.abspath(os.path.join(script_dir, "..", "dist"))
axe_path = os.path.join(script_dir, "fixtures", "axe.min.js")
with open(axe_path, "r", encoding="utf-8") as f:
    axe_js = f.read()

def get_html_files():
    files = []
    for root, dirs, f_list in os.walk(dist_dir):
        for f in f_list:
            if f.endswith(".html"):
                files.append(os.path.join(root, f))
    files.sort()
    return files

files = get_html_files()
print(f"Total HTML files to test: {len(files)}")

results = {"os_dark": 0, "data_theme_dark": 0, "violations": []}

with sync_playwright() as p:
    browser = p.chromium.launch()
    
    # Test Way 1: OS Dark (color_scheme='dark', data-theme attribute removed)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.emulate_media(color_scheme="dark")
    for f in files:
        url = "file:///" + f.replace(os.sep, "/")
        page.goto(url)
        page.evaluate("document.documentElement.removeAttribute('data-theme')")
        page.evaluate(axe_js)
        res = page.evaluate("axe.run()")
        v = res.get("violations", [])
        results["os_dark"] += 1
        if v:
            for item in v:
                results["violations"].append({
                    "mode": "OS Dark",
                    "page": os.path.relpath(f, dist_dir),
                    "id": item["id"],
                    "help": item["help"]
                })
    page.close()

    # Test Way 2: data-theme Dark (color_scheme='light', data-theme='dark' attribute)
    page2 = browser.new_page(viewport={"width": 1440, "height": 900})
    page2.emulate_media(color_scheme="light")
    for f in files:
        url = "file:///" + f.replace(os.sep, "/")
        page2.goto(url)
        page2.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
        page2.evaluate(axe_js)
        res = page2.evaluate("axe.run()")
        v = res.get("violations", [])
        results["data_theme_dark"] += 1
        if v:
            for item in v:
                results["violations"].append({
                    "mode": "data-theme Dark",
                    "page": os.path.relpath(f, dist_dir),
                    "id": item["id"],
                    "help": item["help"]
                })
    page2.close()
    browser.close()

print(f"Way 1 (OS Dark): {results['os_dark']} pages tested.")
print(f"Way 2 (data-theme Dark): {results['data_theme_dark']} pages tested.")
print(f"Total violations across both ways: {len(results['violations'])}")
if results["violations"]:
    print("Violations:", json.dumps(results["violations"], indent=2))
else:
    print("PASS: 0 violations across both OS dark and data-theme dark audits!")
