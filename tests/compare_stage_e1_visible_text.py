import os
import sys
import difflib
from playwright.sync_api import sync_playwright

dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../dist"))
baseline_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures/stage_e1_baseline"))

pages_to_verify = [
    ("apply/index.html", "apply_index.html.txt"),
    ("eligibility/index.html", "eligibility_index.html.txt"),
    ("index.html", "index.html.txt"),
    ("programmes/index.html", "programmes_index.html.txt"),
    ("compare/index.html", "compare_index.html.txt"),
    ("evidence/index.html", "evidence_index.html.txt"),
    ("stories/index.html", "stories_index.html.txt")
]

all_match = True

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    for rel_path, baseline_fn in pages_to_verify:
        full_path = os.path.join(dist_dir, rel_path)
        if not os.path.exists(full_path):
            print(f"Error: {full_path} not found")
            all_match = False
            continue

        file_url = f"file:///{full_path.replace(os.sep, '/')}"
        page.goto(file_url)
        current_text = page.locator("body").inner_text()

        baseline_path = os.path.join(baseline_dir, baseline_fn)
        if not os.path.exists(baseline_path):
            print(f"Error: Baseline {baseline_path} not found")
            all_match = False
            continue

        with open(baseline_path, "r", encoding="utf-8") as f:
            baseline_text = f.read()

        if current_text == baseline_text:
            print(f"[OK] {rel_path} is byte-identical to baseline ({len(current_text)} chars)")
        else:
            all_match = False
            print(f"[MISMATCH] {rel_path}: current ({len(current_text)}) != baseline ({len(baseline_text)})")
            diff = list(difflib.unified_diff(
                baseline_text.splitlines(),
                current_text.splitlines(),
                fromfile="baseline",
                tofile="current",
                lineterm=""
            ))
            print("\n".join(diff[:20]))

    browser.close()

if not all_match:
    sys.exit(1)

print("\nALL PAGES VERIFIED: 100% BYTE-IDENTICAL VISIBLE TEXT CONTENT")
sys.exit(0)
