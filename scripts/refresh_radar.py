import sys
import os
import json
from scripts.streamer_radar import get_radar_streamers

print("Refreshing Streamer Radar Cache...")
streamers = get_radar_streamers(force_refresh=True)
print(f"Total streamers loaded: {len(streamers)}")

indian_streamers = [s for s in streamers if s.get('region') == 'indian']
for s in indian_streamers:
    print(f"[{s['views_rank']}] {s['name']} | Handle: {s['handle']} | URL: {s['channel_url']} | Active Stream: {s.get('active_stream_url')}")
