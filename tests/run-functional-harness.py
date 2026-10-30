# -*- coding: utf-8 -*-
"""
SRM Compass - Comprehensive Functional Test Harness (Stage A)
Tests Search, Chips, Campuses, Sort, Compare, and Apply Routes against the live DOM.
Ensures DOM updates are awaited, validates counts against filter.ts benchmarks,
and fails loudly if any filtered query returns 106 rows.
"""

import sys
import os
import json
import socket
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def run_harness():
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../dist'))
    raw_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../audit/raw'))
    os.makedirs(raw_dir, exist_ok=True)

    if not os.path.exists(dist_dir):
        print(f"ERROR: dist directory not found at {dist_dir}")
        sys.exit(1)

    port = find_free_port()
    
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=dist_dir, **kwargs)
        def log_message(self, format, *args):
            pass

    server = HTTPServer(('127.0.0.1', port), Handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    results = {
        "search_tests": [],
        "chip_tests": [],
        "campus_tests": [],
        "sort_tests": [],
        "compare_tests": [],
        "apply_route_tests": [],
        "all_passed": True,
        "failures": []
    }

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()

            # -----------------------------------------------------------------
            # 1. Search Tests on /programmes
            # -----------------------------------------------------------------
            print("--- 1. Testing Search on /programmes ---")
            page.goto(f"http://127.0.0.1:{port}/programmes")
            page.wait_for_selector("#programmes-table")

            search_benchmarks = {
                "eee": 3,
                "ece": 12,
                "cse": 43,
                "ai": 13,
                "vlsi": 3,
                "robotics": 3,
                "biotech": 8,
                "mechanical": 9,
                "it": 3,
                "iot": 3,
                "ktr eee": 1
            }

            for query, expected in search_benchmarks.items():
                input_el = page.locator("#search-input")
                input_el.fill(query)
                input_el.dispatch_event("input")
                
                # Wait for live-count to reflect the update
                page.wait_for_function(
                    f"() => {{ const el = document.getElementById('live-count'); return el && el.textContent.includes('{expected} of'); }}"
                )

                visible_count = page.evaluate(
                    "() => document.querySelectorAll('#offerings-body tr:not([hidden])').length"
                )

                if visible_count == 106 and expected != 106:
                    msg = f"FATAL: Search query '{query}' returned all 106 rows! DOM filtering failed."
                    results["failures"].append(msg)
                    results["all_passed"] = False
                    print(f"  [FAIL] {msg}")

                passed = (visible_count == expected)
                if not passed:
                    msg = f"Search '{query}' expected {expected}, got {visible_count}"
                    results["failures"].append(msg)
                    results["all_passed"] = False
                    print(f"  [FAIL] {msg}")
                else:
                    print(f"  [PASS] Search '{query}': {visible_count} offerings (expected {expected})")

                results["search_tests"].append({
                    "query": query,
                    "expected": expected,
                    "actual": visible_count,
                    "passed": passed
                })

            # Clear search
            page.locator("#search-input").fill("")
            page.locator("#search-input").dispatch_event("input")
            page.wait_for_function("() => document.querySelectorAll('#offerings-body tr:not([hidden])').length === 106")

            # -----------------------------------------------------------------
            # 2. Taxonomy Chip Filter Tests
            # -----------------------------------------------------------------
            print("\n--- 2. Testing Taxonomy Chips on /programmes ---")
            tag_benchmarks = {
                "circuits-power": 21,
                "code-ai": 63,
                "machines-vehicles": 16,
                "robots-automation": 5,
                "health-bio": 13,
                "build-infrastructure": 3,
                "data-business": 17,
                "materials": 2
            }

            for tag, expected in tag_benchmarks.items():
                # Ensure search is clear and no chip active
                page.locator("#search-input").fill("")
                page.locator("#search-input").dispatch_event("input")
                # Uncheck any campus checkboxes
                page.evaluate("() => document.querySelectorAll('input[name=\"campus\"]:checked').forEach(cb => { cb.checked = false; cb.dispatchEvent(new Event('change')); })")
                # Deactivate any active chip
                page.evaluate("() => { const active = document.querySelector('.chip[aria-pressed=\"true\"]'); if (active) active.click(); }")
                page.wait_for_function("() => document.querySelectorAll('#offerings-body tr:not([hidden])').length === 106")

                # Click tag chip
                chip = page.locator(f".chip[data-tag='{tag}']")
                chip.click()

                page.wait_for_function(
                    f"() => {{ const el = document.getElementById('live-count'); return el && el.textContent.includes('{expected} of'); }}"
                )

                visible_count = page.evaluate(
                    "() => document.querySelectorAll('#offerings-body tr:not([hidden])').length"
                )

                if visible_count == 106:
                    msg = f"FATAL: Chip '{tag}' returned all 106 rows! Chip filter failed."
                    results["failures"].append(msg)
                    results["all_passed"] = False
                    print(f"  [FAIL] {msg}")

                passed = (visible_count == expected)
                if not passed:
                    msg = f"Chip '{tag}' expected {expected}, got {visible_count}"
                    results["failures"].append(msg)
                    results["all_passed"] = False
                    print(f"  [FAIL] {msg}")
                else:
                    print(f"  [PASS] Chip '{tag}': {visible_count} offerings (expected {expected})")

                results["chip_tests"].append({
                    "tag": tag,
                    "expected": expected,
                    "actual": visible_count,
                    "passed": passed
                })

                # Deactivate chip for next iteration
                chip.click()
                page.wait_for_function("() => document.querySelectorAll('#offerings-body tr:not([hidden])').length === 106")

            # -----------------------------------------------------------------
            # 3. Campus Filter Tests
            # -----------------------------------------------------------------
            print("\n--- 3. Testing Campus Filters on /programmes ---")
            campus_benchmarks = {
                "KTR": 44,
                "RMP": 18,
                "Trichy": 20,
                "NCR": 11,
                "VDP": 11,
                "BAB": 2
            }

            for campus, expected in campus_benchmarks.items():
                # Ensure clean state
                page.locator("#search-input").fill("")
                page.locator("#search-input").dispatch_event("input")
                page.evaluate("() => document.querySelectorAll('input[name=\"campus\"]:checked').forEach(cb => { cb.checked = false; cb.dispatchEvent(new Event('change')); })")
                page.evaluate("() => { const active = document.querySelector('.chip[aria-pressed=\"true\"]'); if (active) active.click(); }")
                page.wait_for_function("() => document.querySelectorAll('#offerings-body tr:not([hidden])').length === 106")

                cb = page.locator(f"input[name='campus'][value='{campus}']")
                cb.check()

                page.wait_for_function(
                    f"() => {{ const el = document.getElementById('live-count'); return el && el.textContent.includes('{expected} of'); }}"
                )

                visible_count = page.evaluate(
                    "() => document.querySelectorAll('#offerings-body tr:not([hidden])').length"
                )

                if visible_count == 106:
                    msg = f"FATAL: Campus '{campus}' returned all 106 rows! Campus filter failed."
                    results["failures"].append(msg)
                    results["all_passed"] = False
                    print(f"  [FAIL] {msg}")

                passed = (visible_count == expected)
                if not passed:
                    msg = f"Campus '{campus}' expected {expected}, got {visible_count}"
                    results["failures"].append(msg)
                    results["all_passed"] = False
                    print(f"  [FAIL] {msg}")
                else:
                    print(f"  [PASS] Campus '{campus}': {visible_count} offerings (expected {expected})")

                results["campus_tests"].append({
                    "campus": campus,
                    "expected": expected,
                    "actual": visible_count,
                    "passed": passed
                })

                # Uncheck
                cb.uncheck()
                page.wait_for_function("() => document.querySelectorAll('#offerings-body tr:not([hidden])').length === 106")

            # -----------------------------------------------------------------
            # 4. Sort Tests on /programmes
            # -----------------------------------------------------------------
            print("\n--- 4. Testing Sort Order on /programmes ---")
            page.locator("#search-input").fill("")
            page.locator("#search-input").dispatch_event("input")
            page.evaluate("() => document.querySelectorAll('input[name=\"campus\"]:checked').forEach(cb => { cb.checked = false; cb.dispatchEvent(new Event('change')); })")
            page.evaluate("() => { const active = document.querySelector('.chip[aria-pressed=\"true\"]'); if (active) active.click(); }")
            page.wait_for_function("() => document.querySelectorAll('#offerings-body tr:not([hidden])').length === 106")

            # Test fee-asc
            page.select_option("#sort-order", "fee-asc")
            page.wait_for_timeout(300)
            first_fee = page.evaluate("() => parseInt(document.querySelector('#offerings-body tr:not([hidden])').getAttribute('data-fee'), 10)")
            last_fee = page.evaluate("() => { const rows = document.querySelectorAll('#offerings-body tr:not([hidden])'); return parseInt(rows[rows.length - 1].getAttribute('data-fee'), 10); }")
            fee_asc_passed = (first_fee == 100000 and last_fee == 475000)
            print(f"  [{'PASS' if fee_asc_passed else 'FAIL'}] Sort fee-asc: first row Rs.{first_fee}, last row Rs.{last_fee}")
            results["sort_tests"].append({"sort": "fee-asc", "first_fee": first_fee, "last_fee": last_fee, "passed": fee_asc_passed})
            if not fee_asc_passed:
                results["all_passed"] = False

            # Test fee-desc
            page.select_option("#sort-order", "fee-desc")
            page.wait_for_timeout(300)
            first_fee_desc = page.evaluate("() => parseInt(document.querySelector('#offerings-body tr:not([hidden])').getAttribute('data-fee'), 10)")
            last_fee_desc = page.evaluate("() => { const rows = document.querySelectorAll('#offerings-body tr:not([hidden])'); return parseInt(rows[rows.length - 1].getAttribute('data-fee'), 10); }")
            fee_desc_passed = (first_fee_desc == 475000 and last_fee_desc == 100000)
            print(f"  [{'PASS' if fee_desc_passed else 'FAIL'}] Sort fee-desc: first row Rs.{first_fee_desc}, last row Rs.{last_fee_desc}")
            results["sort_tests"].append({"sort": "fee-desc", "first_fee": first_fee_desc, "last_fee": last_fee_desc, "passed": fee_desc_passed})
            if not fee_desc_passed:
                results["all_passed"] = False

            # -----------------------------------------------------------------
            # 5. Compare Tests on /compare
            # -----------------------------------------------------------------
            print("\n--- 5. Testing Compare Engine on /compare ---")
            
            # 0 items
            page.goto(f"http://127.0.0.1:{port}/compare")
            empty_visible = page.is_visible("#compare-empty")
            card_count_0 = len(page.locator(".compare-card").all())
            comp_0_pass = empty_visible and (card_count_0 == 0)
            print(f"  [{'PASS' if comp_0_pass else 'FAIL'}] Compare 0 items: empty state visible={empty_visible}, cards={card_count_0}")
            results["compare_tests"].append({"state": "0 items", "cards": card_count_0, "passed": comp_0_pass})

            # 1 item
            page.goto(f"http://127.0.0.1:{port}/compare?ids=ktr-computer-science-and-engineering")
            page.wait_for_selector(".compare-card")
            card_count_1 = len(page.locator(".compare-card").all())
            comp_1_pass = (card_count_1 == 1)
            print(f"  [{'PASS' if comp_1_pass else 'FAIL'}] Compare 1 item: cards={card_count_1}")
            results["compare_tests"].append({"state": "1 item", "cards": card_count_1, "passed": comp_1_pass})

            # 3 items
            page.goto(f"http://127.0.0.1:{port}/compare?ids=ktr-computer-science-and-engineering,rmp-computer-science-and-engineering,ktr-electronics-and-communication-engineering")
            page.wait_for_selector(".compare-card")
            card_count_3 = len(page.locator(".compare-card").all())
            has_lowest_fee = page.locator(".badge-lowest").count() > 0
            has_largest_intake = page.locator(".badge-highest").count() > 0
            comp_3_pass = (card_count_3 == 3 and has_lowest_fee and has_largest_intake)
            print(f"  [{'PASS' if comp_3_pass else 'FAIL'}] Compare 3 items: cards={card_count_3}, lowest_fee_badge={has_lowest_fee}, largest_intake_badge={has_largest_intake}")
            results["compare_tests"].append({"state": "3 items", "cards": card_count_3, "passed": comp_3_pass})

            # 4 items (enforces max 3)
            page.goto(f"http://127.0.0.1:{port}/compare?ids=ktr-computer-science-and-engineering,rmp-computer-science-and-engineering,ktr-electronics-and-communication-engineering,vdp-computer-science-and-engineering")
            page.wait_for_selector(".compare-card")
            card_count_4 = len(page.locator(".compare-card").all())
            has_limit_notice = page.locator("#compare-notice:not([hidden])").count() > 0
            comp_4_pass = (card_count_4 == 3 and has_limit_notice)
            print(f"  [{'PASS' if comp_4_pass else 'FAIL'}] Compare 4 items: cards={card_count_4} (capped at 3), notice_shown={has_limit_notice}")
            results["compare_tests"].append({"state": "4 items", "cards": card_count_4, "passed": comp_4_pass})

            # -----------------------------------------------------------------
            # 6. Apply Route Chooser Tests on /apply
            # -----------------------------------------------------------------
            print("\n--- 6. Testing Apply Route Selector on /apply (8 routes) ---")
            page.goto(f"http://127.0.0.1:{port}/apply")
            page.wait_for_selector("#route-select")

            expected_routes = [
                "btech", "mtech", "architecture", "law",
                "mba", "medicine", "health", "other"
            ]

            for route_id in expected_routes:
                page.select_option("#route-select", route_id)
                page.wait_for_timeout(200)

                # Verify that only route_id is open
                target_card = page.locator(f"#route-card-{route_id}")
                is_target_open = target_card.get_attribute("open") is not None

                other_open_count = page.evaluate(
                    f"() => Array.from(document.querySelectorAll('.route-details-item')).filter(el => el.id !== 'route-card-{route_id}' && el.open).length"
                )

                route_passed = is_target_open and (other_open_count == 0)
                print(f"  [{'PASS' if route_passed else 'FAIL'}] Route '{route_id}': active_open={is_target_open}, other_open_count={other_open_count}")
                results["apply_route_tests"].append({
                    "route": route_id,
                    "target_open": is_target_open,
                    "other_open": other_open_count,
                    "passed": route_passed
                })

                if not route_passed:
                    results["all_passed"] = False
                    results["failures"].append(f"Route '{route_id}' failed: target_open={is_target_open}, other_open={other_open_count}")

            browser.close()

    finally:
        server.shutdown()

    # Save raw outputs to audit/raw/functional_harness_results.json
    out_file = os.path.join(raw_dir, "functional_harness_results.json")
    with open(out_file, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2)

    print(f"\nRaw results saved to {out_file}")
    print("=" * 60)
    if results["all_passed"]:
        print("VERDICT: ALL FUNCTIONAL FEATURES PASSED 100%. ZERO FAILURES.")
    else:
        print(f"VERDICT: {len(results['failures'])} FEATURES FAILED:")
        for f in results["failures"]:
            print(f"  - {f}")
    print("=" * 60)

    if not results["all_passed"]:
        sys.exit(1)

if __name__ == "__main__":
    run_harness()
