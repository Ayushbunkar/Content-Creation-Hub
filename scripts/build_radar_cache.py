import os
import sys
import json

from scripts.streamer_radar import get_radar_streamers

print("Building fresh radar cache with local avatars and verified subscriber counts...")
streamers = get_radar_streamers(force_refresh=True)
print(f"Generated cache with {len(streamers)} streamers:")
for s in streamers:
    print(f"[{s['region'].upper()}] #{s['views_rank']} {s['name']} | Subs: {s['subscribers']} | Avatar: {s['avatar_url']}")
