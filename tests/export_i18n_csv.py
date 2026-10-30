import json
import csv
import re
import os

repo_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
json_path = os.path.join(repo_dir, "src/i18n/en.json")
csv_path = os.path.join(repo_dir, "audit/i18n_strings.csv")

with open(json_path, "r", encoding="utf-8") as f:
    en = json.load(f)

VERBATIM_SRM_KEYS = {
    "eligibility.rules.general",
    "eligibility.rules.biotech"
}

rows = []
for key, text in en.items():
    # Extract variables formatted as {name}
    matches = re.findall(r"\{([a-zA-Z0-9_]+)\}", text)
    # Deduplicate while preserving order
    seen = set()
    deduped_vars = []
    for m in matches:
        if m not in seen:
            seen.add(m)
            deduped_vars.append(m)
    variables = ", ".join(deduped_vars)

    verbatim_srm = "yes" if key in VERBATIM_SRM_KEYS else "no"

    if key.startswith("apply."):
        page_where_used = "/apply"
    elif key.startswith("eligibility."):
        page_where_used = "/eligibility"
    else:
        page_where_used = "all"

    rows.append({
        "key": key,
        "english": text,
        "variables": variables,
        "verbatim_srm": verbatim_srm,
        "page_where_used": page_where_used,
        "tamil": ""
    })

fieldnames = ["key", "english", "variables", "verbatim_srm", "page_where_used", "tamil"]

with open(csv_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    writer.writerows(rows)

print(f"Exported {len(rows)} rows to {csv_path}")
print(f"Verbatim count: {sum(1 for r in rows if r['verbatim_srm'] == 'yes')}")
print(f"Translatable count: {sum(1 for r in rows if r['verbatim_srm'] == 'no')}")
