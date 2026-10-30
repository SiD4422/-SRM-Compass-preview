# -*- coding: utf-8 -*-
import sys
import os
import socket
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none';"

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def run_csp_check():
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../dist'))
    if not os.path.exists(dist_dir):
        print(f"ERROR: dist directory not found at {dist_dir}")
        sys.exit(1)

    port = find_free_port()

    class CSPHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=dist_dir, **kwargs)

        def end_headers(self):
            self.send_header('Content-Security-Policy', CSP_HEADER)
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
            super().end_headers()

        def log_message(self, format, *args):
            pass

    server = HTTPServer(('127.0.0.1', port), CSPHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    pages_to_test = [
        "",
        "programmes/",
        "programmes/mechanical-engineering/",
        "programmes/aerospace-engineering/",
        "compare/",
        "eligibility/",
        "stories/",
        "stories/camber-racing/",
        "apply/",
        "evidence/",
        "404.html"
    ]

    errors_found = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for slug in pages_to_test:
            page_errors = []
            console_errors = []
            
            context = browser.new_context()
            page = context.new_page()

            page.on("pageerror", lambda err: page_errors.append(str(err)))
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

            url = f"http://127.0.0.1:{port}/{slug}"
            res = page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(200)

            if page_errors:
                for pe in page_errors:
                    errors_found.append({"url": url, "type": "pageerror", "error": pe})
            if console_errors:
                for ce in console_errors:
                    errors_found.append({"url": url, "type": "console_error", "error": ce})

            context.close()
        browser.close()

    server.shutdown()

    if errors_found:
        print(f"FAILED: Found {len(errors_found)} console/page errors under CSP:")
        for err in errors_found:
            print(f"  [{err['type']}] on {err['url']}: {err['error']}")
        sys.exit(1)
    else:
        print(f"PASSED: 0 console errors and 0 page errors across all {len(pages_to_test)} tested page types under CSP.")
        sys.exit(0)

if __name__ == '__main__':
    run_csp_check()
