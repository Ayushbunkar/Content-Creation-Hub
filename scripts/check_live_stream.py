import urllib.request
import re
import json

url = "https://www.youtube.com/watch?v=gJNZNNwKHOg"
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=8) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        title_m = re.search(r'<title>([^<]+)</title>', html)
        is_live = ('"isLive":true' in html or '"style":"LIVE"' in html)
        print("Title:", title_m.group(1) if title_m else "None")
        print("Is Live:", is_live)
        # Check live chat renderer
        live_chat_renderer = ('liveChatRenderer' in html or 'liveChatContinuation' in html)
        print("Live Chat present in HTML:", live_chat_renderer)
except Exception as e:
    print("Error:", e)
