# -*- coding: utf-8 -*-
import sys
import os
import time
import socket
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def run_test():
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../dist'))
    if not os.path.exists(dist_dir):
        print(f"ERROR: dist directory not found at {dist_dir}")
        sys.exit(1)

    port = find_free_port()
    
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=dist_dir, **kwargs)
        def log_message(self, format, *args):
            pass # Silent server

    server = HTTPServer(('127.0.0.1', port), Handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            # Explicitly launch with JavaScript disabled
            page = browser.new_page(java_script_enabled=False)
            
            target_url = f"http://127.0.0.1:{port}/eligibility/"
            response = page.goto(target_url)
            
            if not response or response.status != 200:
                print(f"ERROR: Failed to load {target_url}, status: {response.status if response else 'None'}")
                sys.exit(1)

            initial_url = page.url
            print(f"1. Loaded with JS OFF at: {initial_url}")

            # Check that submit button is disabled in the static DOM
            btn = page.locator('#checker-submit-btn')
            is_disabled = btn.is_disabled()
            print(f"2. Submit button disabled: {is_disabled}")
            if not is_disabled:
                print("FAIL: #checker-submit-btn should be disabled when JS is off!")
                sys.exit(1)

            # Check that noscript banner is present
            noscript_text = page.locator('.noscript-banner').text_content()
            print(f"3. Noscript banner: {noscript_text[:60]}...")
            if 'JavaScript is required' not in noscript_text:
                print("FAIL: Noscript banner missing or incorrect!")
                sys.exit(1)

            # Focus aggregate field, type value, and press Enter
            aggregate_input = page.locator('#aggregate')
            aggregate_input.fill('60.0')
            aggregate_input.focus()
            page.keyboard.press('Enter')
            
            # Wait to ensure any potential form submission would have resolved
            page.wait_for_timeout(600)
            
            final_url = page.url
            print(f"4. URL after pressing Enter in aggregate field: {final_url}")

            if final_url != initial_url:
                print(f"FAIL: URL changed from {initial_url} to {final_url}!")
                sys.exit(1)

            if 'aggregate' in final_url or 'dob' in final_url or '?' in final_url:
                print(f"FAIL: Sensitive fields leaked into URL: {final_url}")
                sys.exit(1)

            browser.close()
            print("PASS: Eligibility form with JS disabled guarantees zero URL mutation and zero data leakage.")
            sys.exit(0)
    finally:
        server.shutdown()

if __name__ == '__main__':
    run_test()
