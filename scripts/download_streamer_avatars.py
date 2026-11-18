import os
import sys
import json
import urllib.request
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
}

dest_dir = os.path.join(os.getcwd(), 'public', 'streamers')
os.makedirs(dest_dir, exist_ok=True)

streamers = [
    # Indian
    ("carryislive", "https://www.youtube.com/@CarryisLive", "https://yt3.googleusercontent.com/ytc/AIdro_m-ZGYEhrhbHr9wR202q4kf33QEh8vB7uI9ZDf8hjwYal4=s900-c-k-c0x00ffffff-no-rj"),
    ("samay_raina", "https://www.youtube.com/@SamayRainaOfficial", "https://yt3.googleusercontent.com/Wa_kc-EY0nzEj6c54uxm4kHnoNEpAdfM_Gd3QOgT-eLBohn0QiL6KRDdn5uWmF1nBhJty5y4=s900-c-k-c0x00ffffff-no-rj"),
    ("techno_gamerz", "https://www.youtube.com/@TechnoGamerzOfficial", "https://yt3.googleusercontent.com/ytc/AIdro_mSh0doIgogNhhpzLcRYEMRorZefkBUe_6LYOWnLgzSyFc=s900-c-k-c0x00ffffff-no-rj"),
    ("total_gaming", "https://www.youtube.com/@TotalGaming093", "https://yt3.googleusercontent.com/ytc/AIdro_l7o9hDEiDVLvAW00YMnnYKzf4UpyJWhREfNWD3V33mBhM=s900-c-k-c0x00ffffff-no-rj"),
    ("mortal", "https://www.youtube.com/@MortaLyt", "https://yt3.googleusercontent.com/CgDoovzSEFT24l-LQ8L-aqglwU5j7ychWiAMUvzPwqEKmntodpd8LEjGeaTIdZtqEoxYENDMhzI=s900-c-k-c0x00ffffff-no-rj"),
    ("dynamo", "https://www.youtube.com/@DynamoGaming", "https://yt3.googleusercontent.com/ytc/AIdro_kCNu8QCIYlhtbGOmcJdRbEo4WZ9b7MrPly8mmZJdbBfP4=s900-c-k-c0x00ffffff-no-rj"),
    ("scout_op", "https://www.youtube.com/@scout", "https://yt3.googleusercontent.com/ytc/AIdro_njpOXPzjhVheDIVvxD27i2G0ek5k3HBRYeq_8-E8o0D3WRHKC2n2FCC4BvpgaFl4Vvwg=s900-c-k-c0x00ffffff-no-rj"),
    ("tanmay_bhat", "https://www.youtube.com/@tanmaybhat", "https://yt3.googleusercontent.com/kbO4TsJR2jjvQJb3NCo6n4Tyhi54sMgNYvc9WZuRKnmZPxVd6N0altmFS4uZOdYrZ2lecuJQNg=s900-c-k-c0x00ffffff-no-rj"),
    ("jonathan_gaming", "https://www.youtube.com/@JONATHANGAMINGYT", "https://yt3.googleusercontent.com/ytc/AIdro_kmYx8bL-oN-hZ7XkL2pQ9qJ1_xY_zN3M4kL5J6=s900-c-k-c0x00ffffff-no-rj"),
    ("beastboyshub", "https://www.youtube.com/@BeastBoyShub", "https://yt3.googleusercontent.com/ytc/AIdro_kX6mB-mJ1xY_zN3M4kL5J6mB-mJ1x=s900-c-k-c0x00ffffff-no-rj"),

    # Global
    ("ishowspeed", "https://www.youtube.com/@IShowSpeed", "https://yt3.googleusercontent.com/O6LdYx8U14X_4iVdQH8rJ2fJ2K9eD4N2yX8mB-mJ1xY=s900-c-k-c0x00ffffff-no-rj"),
    ("kai_cenat", "https://www.twitch.tv/kaicenat", "https://static-cdn.jtvnw.net/jtv_user_pictures/21dc1a92-ad79-4bc6-a979-4e5cb4ba6c8d-profile_image-300x300.png"),
    ("xqc", "https://www.twitch.tv/xqc", "https://static-cdn.jtvnw.net/jtv_user_pictures/xqc-profile_image-92e30664e3458268-300x300.jpeg"),
    ("jynxzi", "https://www.twitch.tv/jynxzi", "https://static-cdn.jtvnw.net/jtv_user_pictures/f46f33d7-e070-43cf-8aee-8fbfb3917865-profile_image-300x300.png"),
    ("caseoh", "https://www.twitch.tv/caseoh_", "https://static-cdn.jtvnw.net/jtv_user_pictures/f8c85eb8-2856-4277-bf31-2ba077db3cf2-profile_image-300x300.png"),
    ("tarik", "https://www.twitch.tv/tarik", "https://static-cdn.jtvnw.net/jtv_user_pictures/8b965f7c-e093-4a18-910f-1555513d8d64-profile_image-300x300.png"),
    ("adin_ross", "https://www.youtube.com/@adinross", "https://yt3.googleusercontent.com/ytc/AIdro_nQ1_xY_zN3M4kL5J6mB-mJ1xY_zN3M4=s900-c-k-c0x00ffffff-no-rj"),
    ("ludwig", "https://www.youtube.com/@ludwig", "https://yt3.googleusercontent.com/ytc/AIdro_k6T6tB1E7zIqj6gZ4dG1K-c7wXq0N9M8L7=s900-c-k-c0x00ffffff-no-rj"),
    ("asmongold", "https://www.youtube.com/@AsmongoldTV", "https://yt3.googleusercontent.com/ytc/AIdro_mP1Q8bL-oN-hZ7XkL2pQ9qJ1_xY_zN3=s900-c-k-c0x00ffffff-no-rj"),
    ("pewdiepie", "https://www.youtube.com/@PewDiePie", "https://yt3.googleusercontent.com/5o-5fioHpDqlHQ5istqTx11nJMdm_ggysqOTbvR2Np2qEQbfnhndoGaJZpTRQggaFsWUbUSq=s900-c-k-c0x00ffffff-no-rj")
]

print("Fetching streamer profiles and subscriber counts...")

data_map = {}

for sid, url, fallback_img in streamers:
    sub_count = None
    avatar_url = fallback_img
    local_img_path = os.path.join(dest_dir, f"{sid}.jpg")

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=6) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

            # Subscriber count from YouTube
            sub_match = re.search(r'\"subscriberCountText\":\{[^\}]*\"simpleText\":\"([^\"]+)\"', html)
            if sub_match:
                sub_count = sub_match.group(1).replace('subscribers', '').strip()

            # Real Avatar from YouTube
            av_match = re.search(r'\"avatar\":\{\"thumbnails\":\[\{\"url\":\"(https://yt3[^\"]+)\"', html)
            if av_match:
                avatar_url = av_match.group(1)
    except Exception as e:
        print(f"[{sid}] Warning fetching channel page: {e}")

    # Download image to local public/streamers/{sid}.jpg
    try:
        img_req = urllib.request.Request(avatar_url, headers=headers)
        with urllib.request.urlopen(img_req, timeout=6) as img_resp:
            img_bytes = img_resp.read()
            if len(img_bytes) > 500:
                with open(local_img_path, 'wb') as f:
                    f.write(img_bytes)
                print(f"[{sid}] Saved local avatar ({len(img_bytes)} bytes) -> /streamers/{sid}.jpg")
    except Exception as e:
        print(f"[{sid}] Failed to download avatar from {avatar_url}: {e}")

    data_map[sid] = {
        "subscribers": sub_count,
        "avatar_url": f"/streamers/{sid}.jpg" if os.path.exists(local_img_path) else avatar_url
    }

print("\nFinal Data Map:")
print(json.dumps(data_map, indent=2))
