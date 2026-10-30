import os
import sys
import socket
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../dist"))
shots_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../audit/shots"))
os.makedirs(shots_dir, exist_ok=True)

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

port = find_free_port()

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=dist_dir, **kwargs)

    def log_message(self, format, *args):
        pass

server = HTTPServer(('127.0.0.1', port), Handler)
server_thread = threading.Thread(target=server.serve_forever, daemon=True)
server_thread.start()

routes = [
    ("ta/eligibility/", "ta_eligibility"),
    ("ta/apply/", "ta_apply")
]

overflow_failures = []
font_reports = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # 1. Test 360 px Viewport (Light and Dark)
    for theme in ["light", "dark"]:
        context = browser.new_context(
            viewport={"width": 360, "height": 640},
            color_scheme=theme
        )
        page = context.new_page()

        for rel_path, name in routes:
            url = f"http://127.0.0.1:{port}/{rel_path}"
            page.goto(url, wait_until="networkidle")
            page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}')")

            # Check document scrollWidth vs innerWidth
            scroll_width = page.evaluate("document.documentElement.scrollWidth")
            client_width = page.evaluate("window.innerWidth")

            if scroll_width > client_width:
                overflow_failures.append(f"{name} at 360px ({theme}): scrollWidth={scroll_width} > innerWidth={client_width}")

            # Check individual container overflows
            overflowing_elements = page.evaluate("""
                () => {
                    const bad = [];
                    document.querySelectorAll('*').forEach(el => {
                        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
                            const style = window.getComputedStyle(el);
                            if (style.overflowX !== 'auto' && style.overflowX !== 'scroll' && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
                                bad.push({
                                    tag: el.tagName,
                                    id: el.id,
                                    class: el.className,
                                    scroll: el.scrollWidth,
                                    client: el.clientWidth
                                });
                            }
                        }
                    });
                    return bad;
                }
            """)

            if overflowing_elements:
                for el in overflowing_elements:
                    overflow_failures.append(f"Element overflow on {name} at 360px ({theme}): {el}")

            # Report computed font family on a Tamil text element
            computed_font = page.evaluate("""
                () => {
                    const h1 = document.querySelector('h1');
                    return h1 ? window.getComputedStyle(h1).fontFamily : 'not found';
                }
            """)
            font_reports.append(f"{name} ({theme}): Rendered Font Family = {computed_font}")

            # Capture screenshot
            shot_path = os.path.join(shots_dir, f"{name}_360_{theme}.png")
            page.screenshot(path=shot_path, full_page=True)
            print(f"Captured {shot_path}")

        context.close()

    # 2. Test 1440 px Viewport (Light and Dark)
    for theme in ["light", "dark"]:
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            color_scheme=theme
        )
        page = context.new_page()

        for rel_path, name in routes:
            url = f"http://127.0.0.1:{port}/{rel_path}"
            page.goto(url, wait_until="networkidle")
            page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}')")
            shot_path = os.path.join(shots_dir, f"{name}_1440_{theme}.png")
            page.screenshot(path=shot_path, full_page=True)
            print(f"Captured {shot_path}")

        context.close()

    browser.close()

server.shutdown()

print("\n--- FONT RENDERING REPORT ---")
for r in font_reports:
    print(r)

if overflow_failures:
    print("\n--- OVERFLOW FAILURES DETECTED ---")
    for f in overflow_failures:
        print(f)
    sys.exit(1)
else:
    print("\n--- 360 PX OVERFLOW CHECK PASSED: Zero Horizontal Scroll / Overflow ---")
    sys.exit(0)
