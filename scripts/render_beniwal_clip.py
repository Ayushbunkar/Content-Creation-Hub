import urllib.request
import json

req = urllib.request.urlopen('http://127.0.0.1:3000/api/clipper/projects/clip_proj_1794384539604')
data = json.loads(req.read().decode('utf-8'))
clips = data['clips']
print(f"Found {len(clips)} clips for project:")
for idx, c in enumerate(clips):
    print(f"  #{idx+1}: {c['title']} ({c['duration']}s, score {c['engagement_score']})")

clip = clips[1] # Clip 2
print(f"\nRendering clip #{clip['id']} - {clip['title']}...")
render_req = urllib.request.Request(f"http://127.0.0.1:3000/api/clipper/clips/{clip['id']}/render", method='POST')
render_res = json.loads(urllib.request.urlopen(render_req).read().decode('utf-8'))
print("Render complete! Video URL:", render_res.get('videoUrl'))
