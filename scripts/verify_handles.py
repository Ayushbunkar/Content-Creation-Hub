import urllib.request
import re
import json

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

search_queries = [
    ("Total Gaming", "total gaming ajjubhai"),
    ("Scout", "scoutop gaming tanmay singh"),
    ("Tanmay Bhat", "tanmay bhat channel"),
    ("Jonathan Gaming", "jonathan gaming bgmi"),
    ("Dynamo Gaming", "dynamo gaming"),
    ("CarryisLive", "carryislive"),
    ("Samay Raina", "samay raina"),
    ("Mortal", "mortalyt"),
    ("Techno Gamerz", "techno gamerz"),
    ("BeastBoyShub", "beastboyshub")
]

results = {}

for name, q in search_queries:
    url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(q)}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            matches = re.findall(r'\"canonicalBaseUrl\":\"(/@[^\"/]+)\"', html)
            unique_handles = list(dict.fromkeys(matches))[:3]
            results[name] = unique_handles
    except Exception as e:
        results[name] = str(e)

print(json.dumps(results, indent=2))
