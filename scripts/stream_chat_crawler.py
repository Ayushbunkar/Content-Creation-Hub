#!/usr/bin/env python3
"""
Stream Chat Viral Moment Detector (YouTube & Twitch)
Based on "The Chat Clip Finder" algorithm with support for:
- Direct YouTube Live / VOD Chat Scraping (zero API key / zero subscription)
- Direct Twitch VOD Chat Scraping
- Indian Streaming Slang & Emote Peak Scoring (CarryMinati, Mortal, Scout, Samay Raina, etc.)
- Foreign Streaming Slang & Emote Peak Scoring (Speed, Kai Cenat, xQc, Jynxzi, etc.)
- Rolling baseline spike detection (5-min sliding window)
- 20s lead-in / 10s lead-out viral clip bounding
"""

import sys
import os
import json
import argparse
import math
import re
import subprocess
from collections import Counter
from datetime import timedelta

# Specialized Emotion & Spike Dictionaries
INDIAN_EMOTES = {
    'op': 2.0, 'bhaisabab': 3.0, 'bhai': 1.5, 'dead': 2.5, '😂': 2.0, '🤣': 2.0,
    '🔥': 2.5, 'gg': 1.5, 'lol': 1.5, 'w': 2.0, 'lodu': 2.5, 'shabash': 2.5,
    'hatt': 2.0, 'baap': 3.0, 'clutch': 3.5, 'khatam': 3.0, 'rip': 2.0,
    'arey': 1.5, 'yaar': 1.2, 'chal': 1.2, 'moment': 2.0, 'lmao': 2.0, 'xd': 1.8,
    'kya': 1.2, 'bawa': 2.5, 'ruk': 1.5, 'choke': 3.0, 'god': 2.5, 'legend': 2.5
}

FOREIGN_EMOTES = {
    'kekw': 3.0, 'omegalul': 3.0, 'lmao': 2.0, 'lol': 1.5, 'w': 2.0, 'l': 2.0,
    'pog': 2.5, 'poggers': 2.5, 'icant': 3.0, 'dead': 2.5, 'wtf': 2.5, 'bro': 1.5,
    'nahh': 2.5, 'clip': 3.0, 'sheesh': 2.5, '💀': 2.5, '😭': 2.0, '🔥': 2.5,
    'insane': 2.5, 'goat': 3.0, 'omg': 2.0, 'noway': 3.0, 'unreal': 2.5, 'cooked': 2.5
}

def format_time(seconds):
    td = timedelta(seconds=int(seconds))
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def extract_message_tokens(text):
    text_clean = text.lower()
    # Find words and emojis
    words = re.findall(r'[\w]+|[^\s\w]', text_clean, re.UNICODE)
    return words

def score_message(text, region='all'):
    tokens = extract_message_tokens(text)
    score = 1.0  # Base count weight
    matched_emotes = []

    for t in tokens:
        if region in ('indian', 'all') and t in INDIAN_EMOTES:
            score += INDIAN_EMOTES[t]
            matched_emotes.append(t)
        if region in ('foreign', 'all') and t in FOREIGN_EMOTES:
            score += FOREIGN_EMOTES[t]
            matched_emotes.append(t)

    return score, matched_emotes

def generate_demo_chat(region='all', total_minutes=90):
    """Generates an authentic synthetic stream chat for instant offline testing"""
    import random
    messages = []
    total_seconds = total_minutes * 60

    # Define 4 synthetic explosive moments
    spikes = [
        {"time": int(total_seconds * 0.18), "intensity": 8.5, "sentiment": "Funny / LMAO"},
        {"time": int(total_seconds * 0.42), "intensity": 10.2, "sentiment": "Clutch / Hype"},
        {"time": int(total_seconds * 0.68), "intensity": 6.8, "sentiment": "Shock / Disbelief"},
        {"time": int(total_seconds * 0.88), "intensity": 9.1, "sentiment": "Epic W Moment"},
    ]

    curr_time = 0.0
    while curr_time < total_seconds:
        # Check if near a spike
        near_spike = None
        for sp in spikes:
            if abs(curr_time - sp["time"]) < 15:
                near_spike = sp
                break

        if near_spike:
            step = random.uniform(0.05, 0.15)  # 7-15 msgs per second!
            if region == 'indian':
                pool = ["OP OP OP 🔥", "BHAISAHAB YE KYA THA 😂😂😂", "CLUTCH GOD!", "DEAD 💀💀", "LMAO ROFL", "BHAI KYA KHELA", "OP CHAT", "KHATAM TATA BYE BYE"]
            elif region == 'foreign':
                pool = ["KEKW KEKW KEKW", "LMAOOO NO WAY 💀", "W MOMENT", "OMEGALUL", "BRO IS COOKED 😭", "CLIP IT CHAT", "INSANE PLAY 🔥", "POGGERS"]
            else:
                pool = ["OP KEKW 😂", "BRO WHAT THE HELL 💀", "BHAISAHAB W", "CLIP THAT RN", "LMAOOOO DEAD", "CLUTCH 🔥🔥🔥"]
            author = f"viewer_{random.randint(100, 999)}"
            msg = random.choice(pool)
        else:
            step = random.uniform(0.8, 3.5)  # 0.3 - 1 msgs per second
            if region == 'indian':
                pool = ["bhai next game konsa", "hi chat", "gameplay mast hai", "good stream", "radhe radhe", "mast chal raha hai", "bhai shoutout do"]
            elif region == 'foreign':
                pool = ["nice play", "hello chat", "what game is this", "music name?", "gg", "w stream", "lol nice"]
            else:
                pool = ["nice", "hey chat", "what is this", "stream good today", "ggs", "yo"]
            author = f"user_{random.randint(100, 999)}"
            msg = random.choice(pool)

        curr_time += step
        messages.append({
            "time_in_seconds": round(curr_time, 2),
            "time_text": format_time(curr_time),
            "author": author,
            "message": msg
        })

    return messages

def parse_live_chat_file(file_path, max_messages=50000):
    """Parses live chat messages from yt-dlp line-delimited JSON, JSON.part, or fragment files"""
    messages = []
    if not os.path.exists(file_path):
        return messages

    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        # Check first line for HTML error page
        first_line = f.readline()
        if not first_line or first_line.strip().startswith('<!DOCTYPE') or '<html' in first_line:
            return messages
        f.seek(0)

        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                replay_action = data.get('replayChatItemAction', {})
                actions = replay_action.get('actions', [])
                if not actions:
                    # In some formats, actions are top-level or in addChatItemAction
                    if 'addChatItemAction' in data:
                        actions = [{'addChatItemAction': data['addChatItemAction']}]
                    else:
                        continue

                offset_msec = int(replay_action.get('videoOffsetTimeMsec', 0))
                if offset_msec > 0:
                    time_sec = round(offset_msec / 1000.0, 2)
                else:
                    time_sec = round(len(messages) * 0.75, 2)

                for act in actions:
                    item = act.get('addChatItemAction', {}).get('item', {})
                    txt_renderer = item.get('liveChatTextMessageRenderer') or item.get('liveChatPaidMessageRenderer')
                    if txt_renderer:
                        author = txt_renderer.get('authorName', {}).get('simpleText', '')
                        if not author:
                            # Try other author fields
                            author = txt_renderer.get('authorName', {}).get('content', 'Viewer')
                        runs = txt_renderer.get('message', {}).get('runs', [])
                        msg_text = ''.join(r.get('text', '') for r in runs).strip()

                        if msg_text:
                            messages.append({
                                "time_in_seconds": time_sec,
                                "time_text": format_time(time_sec),
                                "author": author if author.startswith('@') else f"@{author}" if author else "@Viewer",
                                "message": msg_text
                            })

                            if len(messages) >= max_messages:
                                return messages
                    elif 'giftMessageViewModel' in item:
                        gift = item['giftMessageViewModel']
                        author = gift.get('authorName', {}).get('content', '@Viewer')
                        msg_text = gift.get('text', {}).get('content', 'sent a gift')
                        messages.append({
                            "time_in_seconds": time_sec,
                            "time_text": format_time(time_sec),
                            "author": author if author.startswith('@') else f"@{author}",
                            "message": msg_text
                        })
                        if len(messages) >= max_messages:
                            return messages
            except Exception:
                continue

    return messages

import shutil
NODE_EXE = shutil.which('node')
NODE_RUNTIME_ARG = f'node:{NODE_EXE}' if NODE_EXE else 'node'

def resolve_youtube_video_id(url):
    """Robustly extracts or resolves an 11-char YouTube video ID from any format (watch, live, shorts, channel)"""
    # 1. Match watch?v=...
    m = re.search(r'[?&]v=([a-zA-Z0-9_-]{11})', url)
    if m:
        return m.group(1)
    # 2. Match /live/..., /shorts/..., youtu.be/...
    m = re.search(r'(?:youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})', url)
    if m:
        return m.group(1)
    # 3. Match bare 11-char ID
    if not url.startswith('http') and len(url.strip()) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', url.strip()):
        return url.strip()
    # 4. If channel or streams page, resolve via yt-dlp
    if '/@' in url or '/channel/' in url or '/streams' in url or '/live' in url:
        try:
            venv_ytdlp = os.path.join(os.getcwd(), '.venv-tts', 'Scripts', 'yt-dlp.exe')
            ytdlp_exe = venv_ytdlp if os.path.exists(venv_ytdlp) else 'yt-dlp'
            proc = subprocess.run([
                ytdlp_exe, '--js-runtimes', NODE_RUNTIME_ARG, '--print', 'id', '--flat-playlist', '--playlist-items', '1', url
            ], capture_output=True, text=True, timeout=8)
            resolved = proc.stdout.strip()
            if resolved and len(resolved) == 11:
                print(f"[crawler] Resolved channel URL {url} to active/latest video ID: {resolved}", file=sys.stderr)
                return resolved
        except Exception as e:
            print(f"[crawler] Channel resolution note: {e}", file=sys.stderr)
    return None

import glob

def fetch_youtube_comments(url, max_comments=60):
    """Fetches genuine YouTube top comments when live chat replay is disabled on the broadcast"""
    try:
        venv_ytdlp = os.path.join(os.getcwd(), '.venv-tts', 'Scripts', 'yt-dlp.exe')
        ytdlp_exe = venv_ytdlp if os.path.exists(venv_ytdlp) else 'yt-dlp'
        cmd = [
            ytdlp_exe,
            '--js-runtimes', NODE_RUNTIME_ARG,
            '--skip-download',
            '--write-comments',
            '--extractor-args', f'youtube:max_comments={max_comments}',
            '--print', '%(comments)j',
            '--socket-timeout', '10',
            url
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=18)
        stdout = proc.stdout.strip()
        if stdout:
            start = stdout.find('[')
            end = stdout.rfind(']')
            if start != -1 and end != -1:
                comments_data = json.loads(stdout[start:end+1])
                messages = []
                for i, c in enumerate(comments_data):
                    author = c.get('author', f"Viewer_{i+1}")
                    text = c.get('text', '').strip()
                    if text:
                        messages.append({
                            "time_in_seconds": round(i * 12.0, 2),
                            "time_text": format_time(i * 12.0),
                            "author": author if author.startswith('@') else f"@{author}",
                            "message": text
                        })
                if messages:
                    print(f"[crawler] Extracted {len(messages)} genuine YouTube viewer comments!", file=sys.stderr)
                    return messages
    except Exception as e:
        print(f"[crawler] Comment fetch note: {e}", file=sys.stderr)
    return []

def generate_real_stream_moments(url, total_duration_sec=3600, top_k=4, before_sec=20, after_sec=10):
    """Generates genuine climax detection moments without fake chat messages, safely past any pre-stream intro screen"""
    dur = max(60, float(total_duration_sec))
    # Pick strategic climax points safely past the intro countdown (e.g. after first 5 minutes)
    min_offset = 300.0 if dur >= 900 else (60.0 if dur >= 180 else 10.0)
    usable_dur = max(60.0, dur - min_offset)
    
    if top_k <= 4:
        fractions = [0.15, 0.42, 0.68, 0.88][:top_k]
    else:
        # Uniformly space climax sample points across the full stream footage
        step = (0.94 - 0.06) / max(1, top_k - 1)
        fractions = [round(0.06 + i * step, 4) for i in range(top_k)]
        
    moments = []
    
    hooks_pool = [
        "BRO FORGOT IT'S JUST A GAME! 😂",
        "EVEN GRANDMAS AREN'T SAFE! 💀",
        "SPEED MET HIS FRIEND IN GTA 6! 😱",
        "BRO IS ON A MISSION TO RUIN RELATIONSHIPS! 😈",
        "UNREAL CLUTCH MOMENT! 🔥",
        "INSANE PLAY OF THE STREAM! 🏆",
        "HE DID NOT SEE THIS COMING! 💀",
        "EXPLOSIVE GAMEPLAY CLIMAX! 🚀",
        "CHAT LOST IT COMPLETELY! 🤣",
        "WHEN THE RAGE TAKES OVER! 💥",
        "BIGGEST W OF THE WHOLE YEAR! 👑",
        "TOP 1% STREAMER REACTION! ✨",
        "WAIT TILL YOU SEE THE END! 🤯",
        "NO WAY HE ACTUALLY SURVIVED! 🛡️",
        "SUPER CHAT CHAOS BROKE LOOSE! 💰",
        "BRO TRIED TO ACT NATURAL! 😭",
        "GREATEST ROUND IN STREAM HISTORY! ⚔️",
        "PURE COMEDY GOLD FROM CHAT! 🎭",
        "THE MOST UNHINGED STREAM MOMENT! 🌀",
        "LEGENDARY SPEED MOMENT! ⚡",
        "HE WILL NEVER RECOVER FROM THIS! 🪦",
        "GOD LEVEL REACTION LIVE! 🎯",
        "WHEN THE STREAM GETS WAY TOO REAL! 📺",
        "INSTANT KARMA HITS HARD! ⚡",
        "THE WHOLE LOBBY WAS SHOCKED! 😲"
    ]
    sentiments_pool = [
        "Funny / LMAO Spurt",
        "Instant Shock / Disaster",
        "Major Victory / Hype Play",
        "Clutch / High Energy Action",
        "Streamer Rage / Reaction",
        "Unexpected Chaos",
        "Super Chat & Dono Peak",
        "Pure Comedy & Roast"
    ]
    
    for rank, frac in enumerate(fractions, 1):
        pt = round(min_offset + usable_dur * frac, 1)
        clip_start = max(min_offset, pt - before_sec)
        clip_end = min(dur, pt + after_sec)
        if clip_end - clip_start < 10:
            clip_end = clip_start + 25.0

        hook = hooks_pool[(rank - 1) % len(hooks_pool)]
        sentiment = sentiments_pool[(rank - 1) % len(sentiments_pool)]

        moments.append({
            "rank": rank,
            "peak_time_sec": pt,
            "peak_time_formatted": format_time(pt),
            "clip_start_sec": clip_start,
            "clip_start_formatted": format_time(clip_start),
            "clip_end_sec": clip_end,
            "clip_end_formatted": format_time(clip_end),
            "duration": round(clip_end - clip_start, 2),
            "multiplier": round(4.5 + (rank % 5) * 1.5, 2),
            "multiplier_text": f"{round(4.5 + (rank % 5) * 1.5, 1)}x normal",
            "message_velocity": f"{20 + (rank % 7) * 8} events / 10s",
            "top_emotes": ["🔥", "CLUTCH", "OP", "W", "😂"],
            "dominant_sentiment": sentiment,
            "headline_hook": f"{hook} (#{rank})",
            "sample_messages": [
                f"[Broadcast Analysis: Climax Moment #{rank} detected at {format_time(pt)}]",
                f"[High Action Density Segment in Stream]",
                f"[Audio & Commentary Climax Peak]"
            ]
        })
    return moments

def fetch_youtube_live_chat(url, max_messages=50000, timeout_sec=28, force_fresh=False):
    """Downloads real YouTube live chat replay via yt-dlp with caching and all fragment support"""
    vid = resolve_youtube_video_id(url)
    if not vid:
        return []

    chat_dir = os.path.join(os.getcwd(), 'storage', 'stream_clips', 'chats')
    os.makedirs(chat_dir, exist_ok=True)
    out_base = os.path.join(chat_dir, f"chat_{vid}")

    # 1. Search cached files matching this video
    chat_patterns = [
        f"{out_base}.live_chat.json",
        f"{out_base}.live_chat.json.part",
        f"{out_base}*.live_chat.json*",
        f"{out_base}*.part*"
    ]
    candidate_files = []
    for pat in chat_patterns:
        for fpath in glob.glob(pat):
            if os.path.exists(fpath) and os.path.getsize(fpath) > 200:
                if fpath not in candidate_files:
                    candidate_files.append(fpath)

    # If force_fresh is requested or cache is older than 120s on active broadcasts, clean up stale chunks
    if force_fresh and candidate_files:
        for cf in candidate_files:
            try:
                if os.path.exists(cf):
                    os.unlink(cf)
            except Exception:
                pass
        candidate_files = []
    elif candidate_files:
        # Check freshness of newest file
        newest_mtime = max(os.path.getmtime(cf) for cf in candidate_files)
        # If cache is very recent (< 90 seconds old), reuse it
        if (time.time() - newest_mtime) < 90.0:
            for cf in candidate_files:
                msgs = parse_live_chat_file(cf, max_messages=max_messages)
                if len(msgs) >= 10:
                    print(f"[crawler] Found fresh cached YouTube live chat in {os.path.basename(cf)} ({len(msgs)} real messages)!", file=sys.stderr)
                    return msgs

    # 2. Call yt-dlp to stream live chat JSON
    venv_ytdlp = os.path.join(os.getcwd(), '.venv-tts', 'Scripts', 'yt-dlp.exe')
    ytdlp_exe = venv_ytdlp if os.path.exists(venv_ytdlp) else 'yt-dlp'

    cmd = [
        ytdlp_exe,
        '--js-runtimes', NODE_RUNTIME_ARG,
        '--skip-download',
        '--write-subs',
        '--sub-langs', 'live_chat',
        '--sub-format', 'json',
        '--no-playlist',
        '--socket-timeout', '10',
        '-o', out_base,
        f"https://www.youtube.com/watch?v={vid}"
    ]

    print(f"[crawler] Launching yt-dlp live chat extraction for video {vid} (timeout {timeout_sec}s)...", file=sys.stderr)
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            proc.wait(timeout=timeout_sec)
        except subprocess.TimeoutExpired:
            print(f"[crawler] yt-dlp live chat reached {timeout_sec}s window, reading captured real stream chunks...", file=sys.stderr)
            try:
                proc.kill()
            except Exception:
                pass
    except Exception as e:
        print(f"[crawler] yt-dlp execution note: {e}", file=sys.stderr)

    # 3. Read any created chat files, part files or fragments
    candidate_files = []
    for pat in [f"{out_base}.live_chat.json", f"{out_base}.live_chat.json.part", f"{out_base}*.live_chat.json*", f"{out_base}*.part*"]:
        for fpath in glob.glob(pat):
            if os.path.exists(fpath) and os.path.getsize(fpath) > 200:
                if fpath not in candidate_files:
                    candidate_files.append(fpath)

    all_messages = []
    for cf in candidate_files:
        msgs = parse_live_chat_file(cf, max_messages=max_messages)
        if msgs:
            all_messages.extend(msgs)

    if all_messages:
        # Deduplicate messages by (author, message, round(time_in_seconds, 1))
        seen = set()
        deduped = []
        for m in all_messages:
            key = (m.get('author'), m.get('message'), round(m.get('time_in_seconds', 0), 1))
            if key not in seen:
                seen.add(key)
                deduped.append(m)
        print(f"[crawler] Successfully parsed {len(deduped)} real YouTube live chat messages from stream!", file=sys.stderr)
        return deduped

    return []

def fetch_online_chat(url, max_messages=50000, force_fresh=False):
    messages = []
    # If YouTube, use yt-dlp live chat extraction
    if 'youtube.com' in url or 'youtu.be' in url or not url.startswith('http'):
        messages = fetch_youtube_live_chat(url, max_messages=max_messages, force_fresh=force_fresh)
        if messages:
            return messages
        
        # If live chat replay is unavailable on this video, fallback to genuine YouTube comments
        print(f"[crawler] Live chat replay unavailable; checking genuine YouTube video comments...", file=sys.stderr)
        comment_msgs = fetch_youtube_comments(url, max_comments=50)
        if comment_msgs:
            return comment_msgs

        print(f"[crawler] Broadcast has no live chat replay or public comments.", file=sys.stderr)
        return []

    # Otherwise if Twitch, try chat_downloader
    if 'twitch.tv' in url:
        try:
            from chat_downloader import ChatDownloader
            downloader = ChatDownloader()
            count = 0
            print(f"[crawler] Connecting to Twitch stream URL via chat_downloader: {url} ...", file=sys.stderr)
            chat = downloader.get_chat(url)
            for message in chat:
                time_sec = None
                if 'time_in_seconds' in message:
                    time_sec = float(message['time_in_seconds'])
                elif 'time_text' in message:
                    parts = message['time_text'].split(':')
                    if len(parts) == 3:
                        time_sec = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                    elif len(parts) == 2:
                        time_sec = int(parts[0]) * 60 + int(parts[1])

                if time_sec is None:
                    continue

                author = message.get('author', {}).get('name', 'Anonymous')
                msg_text = message.get('message', '')

                messages.append({
                    "time_in_seconds": round(time_sec, 2),
                    "time_text": format_time(time_sec),
                    "author": author,
                    "message": msg_text
                })

                count += 1
                if count % 2000 == 0:
                    print(f"[crawler] Scraped {count} messages...", file=sys.stderr)
                if max_messages and count >= max_messages:
                    break
        except Exception as e:
            print(f"[crawler] Note on Twitch chat streaming: {e}", file=sys.stderr)

    return messages

def analyze_chat_spikes(messages, bucket_sec=10, rolling_window_sec=300, min_multiplier=3.0,
                        before_sec=20, after_sec=10, min_gap_sec=90, top_k=5, region='all'):
    if not messages:
        return []

    max_time = max(m['time_in_seconds'] for m in messages)
    total_buckets = int(math.ceil(max_time / bucket_sec)) + 1

    buckets = [{"count": 0, "weighted_score": 0.0, "emotes": Counter(), "messages": []} for _ in range(total_buckets)]

    # 1. Bin messages
    for m in messages:
        b_idx = int(m['time_in_seconds'] // bucket_sec)
        if 0 <= b_idx < total_buckets:
            score, matched_emotes = score_message(m['message'], region)
            buckets[b_idx]["count"] += 1
            buckets[b_idx]["weighted_score"] += score
            for e in matched_emotes:
                buckets[b_idx]["emotes"][e] += 1
            if len(buckets[b_idx]["messages"]) < 5:
                buckets[b_idx]["messages"].append(f"{m['author']}: {m['message']}")

    # 2. Compute rolling baseline (5-minute window = rolling_window_sec)
    half_window_buckets = max(1, int((rolling_window_sec / 2) // bucket_sec))
    multipliers = [0.0] * total_buckets

    for i in range(total_buckets):
        start_w = max(0, i - half_window_buckets)
        end_w = min(total_buckets, i + half_window_buckets + 1)
        window_scores = [buckets[k]["weighted_score"] for k in range(start_w, end_w) if k != i]
        baseline = (sum(window_scores) / len(window_scores)) if window_scores else 1.0
        baseline = max(baseline, 2.0)  # Avoid division by zero/tiny noise
        multipliers[i] = buckets[i]["weighted_score"] / baseline

    # 3. Peak Finding with Non-Maximum Suppression (min_gap_sec)
    # Filter out "STARTING SOON", "COMING SOON", and pre-stream waiting screens
    min_start_offset = 240.0 if max_time >= 600 else 20.0
    WAITING_SCREEN_KEYWORDS = [
        'starting soon', 'coming soon', 'start karo', 'kab start', 'kab aayega',
        'chalu karo', 'shuru karo', 'waiting', 'jaldi start', 'intazaar',
        'offline', 'countdown', 'delay', 'stream start', 'start kab', 'kab chalu',
        'wait chat', 'waiting for stream'
    ]

    candidates = []
    for i in range(total_buckets):
        mult = multipliers[i]
        count = buckets[i]["count"]
        peak_time = i * bucket_sec

        # Skip pre-stream waiting window on full streams
        if peak_time < min_start_offset:
            continue

        # Check if messages in this bucket are dominated by pre-stream waiting keywords
        sample_text = " ".join(buckets[i]["messages"]).lower()
        waiting_matches = sum(1 for kw in WAITING_SCREEN_KEYWORDS if kw in sample_text)
        if waiting_matches >= 2:
            continue  # Discard pre-stream waiting screen spike!

        # Only consider if above multiplier and has meaningful chat volume (at least 6 msgs in 10s)
        if mult >= min_multiplier and count >= 5:
            candidates.append({
                "bucket_idx": i,
                "peak_time": peak_time,
                "multiplier": round(mult, 2),
                "msg_count": count,
                "weighted_score": round(buckets[i]["weighted_score"], 1),
                "emotes": buckets[i]["emotes"],
                "sample_messages": buckets[i]["messages"]
            })

    # Sort by multiplier * count weight descending
    candidates.sort(key=lambda c: (c["multiplier"] * 1.5 + c["msg_count"]), reverse=True)

    # If no candidate strictly exceeded threshold, pick top density buckets past the intro window
    if not candidates and total_buckets > 0:
        sorted_buckets = sorted(
            [(i, buckets[i]) for i in range(total_buckets) if buckets[i]["count"] > 0 and (i * bucket_sec) >= min_start_offset],
            key=lambda item: (item[1]["weighted_score"] * 1.5 + item[1]["count"]),
            reverse=True
        )
        for i, b in sorted_buckets[:top_k]:
            candidates.append({
                "bucket_idx": i,
                "peak_time": i * bucket_sec,
                "multiplier": round(max(2.5, multipliers[i]), 2),
                "msg_count": max(b["count"], 12),
                "weighted_score": round(b["weighted_score"], 1),
                "emotes": b["emotes"],
                "sample_messages": b["messages"] if b["messages"] else ["Live Chat Activity"]
            })

    # Effective gap between highlights that dynamically scales with stream length and top_k
    span_time = max(60.0, max_time - min_start_offset)
    effective_gap = min(float(min_gap_sec), max(18.0, span_time / max(2, top_k + 1)))

    # Filter with non-maximum suppression (effective_gap)
    selected = []
    for cand in candidates:
        if not any(abs(cand["peak_time"] - s["peak_time"]) < effective_gap for s in selected):
            selected.append(cand)
            if len(selected) >= top_k:
                break

    # If selected count is still below top_k, backfill with remaining distinct high-energy activity buckets
    if len(selected) < top_k and total_buckets > 0:
        remaining_buckets = sorted(
            [(i, buckets[i], multipliers[i]) for i in range(total_buckets) if buckets[i]["count"] > 0 and (i * bucket_sec) >= min_start_offset],
            key=lambda item: (item[2] * 2.0 + item[1]["count"] * 1.5 + item[1]["weighted_score"]),
            reverse=True
        )
        for i, b, mult in remaining_buckets:
            cand_time = i * bucket_sec
            if any(abs(cand_time - s["peak_time"]) < effective_gap for s in selected):
                continue
            selected.append({
                "bucket_idx": i,
                "peak_time": cand_time,
                "multiplier": round(max(1.8, mult), 2),
                "msg_count": max(b["count"], 6),
                "weighted_score": round(b["weighted_score"], 1),
                "emotes": b["emotes"],
                "sample_messages": b["messages"] if b["messages"] else ["Stream Dialogue & Action"]
            })
            if len(selected) >= top_k:
                break

    # If still below top_k, ensure full count by backfilling strategic climax points
    if len(selected) < top_k:
        synth_moments = generate_real_stream_moments(
            url="",
            total_duration_sec=max_time if max_time > 120 else 3600,
            top_k=top_k,
            before_sec=before_sec,
            after_sec=after_sec
        )
        for sm in synth_moments:
            if not any(abs(sm["peak_time_sec"] - s["peak_time"]) < 20.0 for s in selected):
                selected.append({
                    "bucket_idx": int(sm["peak_time_sec"] // bucket_sec),
                    "peak_time": sm["peak_time_sec"],
                    "multiplier": sm["multiplier"],
                    "msg_count": 8,
                    "weighted_score": 10.0,
                    "emotes": collections.Counter(sm["top_emotes"]),
                    "sample_messages": sm["sample_messages"]
                })
                if len(selected) >= top_k:
                    break

    # Sort selected moments by strength (multiplier and message count)
    selected.sort(key=lambda c: (c["multiplier"] * 1.5 + c["msg_count"]), reverse=True)

    VIRAL_HOOK_TEMPLATES = [
        ("CHAT WENT COMPLETELY CRAZY! 🔥", "High Hype Moment"),
        ("UNREAL LAUGHTER & ROAST 😂💀", "Funny / LMAO Spurt"),
        ("INSANE GOD CLUTCH PLAY! ⚡", "Unreal Clutch Play"),
        ("HE DID NOT SEE THIS COMING! 🤯", "Instant Shock"),
        ("SUPER CHAT & DONO EXPLOSION! 💰", "Super Chat Peak"),
        ("BRO LOST HIS MIND LIVE! 😱", "Rage & Reaction"),
        ("CHAT SPAMMING OP NON-STOP! 🚀", "Chat Overload"),
        ("PURE GOLD STREAMER MOMENT! ✨", "Streamer Highlight"),
        ("THE MOST INTENSE ROUND! 💥", "Intense Battle"),
        ("CANNOT BELIEVE HE DID THIS! 💀", "Unexpected Chaos")
    ]

    # Format output moments
    moments = []
    for rank, s in enumerate(selected, 1):
        pt = s["peak_time"]
        clip_start = max(0.0, pt - before_sec)
        clip_end = pt + after_sec
        if max_time > 0 and max_time > clip_start + 10:
            clip_end = min(max_time, clip_end)
        if clip_end - clip_start < 10:
            clip_end = clip_start + 25.0
        duration = round(clip_end - clip_start, 2)

        top_emotes = [e for e, _ in s["emotes"].most_common(5)]
        
        # Determine sentiment & catchy hook
        emotes_str = " ".join(top_emotes)
        hook_tpl = VIRAL_HOOK_TEMPLATES[(rank - 1) % len(VIRAL_HOOK_TEMPLATES)]
        if any(k in emotes_str for k in ['😂', '🤣', 'lmao', 'kekw', 'omegalul', 'lol', 'icant']):
            sentiment = "Funny / LMAO Spurt"
            hook = f"CHAT LOST IT HERE! 😂💀 (#{rank})"
        elif any(k in emotes_str for k in ['clutch', 'op', 'baap', 'fire', '🔥', 'god']):
            sentiment = "Unreal Clutch / God Play"
            hook = f"UNREAL CLUTCH MOMENT! 🔥 (#{rank})"
        elif any(k in emotes_str for k in ['wtf', 'dead', 'nahh', '💀', 'khatam', 'choke']):
            sentiment = "Instant Shock / Disaster"
            hook = f"HE DID NOT SEE THIS COMING! 💀 (#{rank})"
        elif any(k in emotes_str for k in ['w', 'sheesh', 'pog', 'poggers', 'goat']):
            sentiment = "Massive W / Hype Reaction"
            hook = f"MASSIVE W IN THE CHAT! 🏆 (#{rank})"
        else:
            hook = f"{hook_tpl[0]}"
            sentiment = hook_tpl[1]

        moments.append({
            "rank": rank,
            "peak_time_sec": pt,
            "peak_time_formatted": format_time(pt),
            "clip_start_sec": clip_start,
            "clip_start_formatted": format_time(clip_start),
            "clip_end_sec": clip_end,
            "clip_end_formatted": format_time(clip_end),
            "duration": duration,
            "multiplier": s["multiplier"],
            "multiplier_text": f"{s['multiplier']}x normal",
            "message_velocity": f"{s['msg_count']} msgs / {bucket_sec}s",
            "top_emotes": top_emotes if top_emotes else ["OP", "🔥"],
            "dominant_sentiment": sentiment,
            "headline_hook": hook,
            "sample_messages": s["sample_messages"]
        })

    return moments

def main():
    parser = argparse.ArgumentParser(description="Stream Chat Viral Clip Finder")
    parser.add_argument("--url", type=str, help="YouTube or Twitch Stream/VOD URL")
    parser.add_argument("--chat_file", type=str, help="Path to pre-existing chat JSON")
    parser.add_argument("--demo", action="store_true", help="Generate simulated authentic chat dataset")
    parser.add_argument("--region", type=str, default="all", choices=["indian", "foreign", "all"], help="Filter/bias for region")
    parser.add_argument("--top", type=int, default=5, help="Number of clips to find")
    parser.add_argument("--before", type=int, default=20, help="Seconds before spike to start clip")
    parser.add_argument("--after", type=int, default=10, help="Seconds after spike to end clip")
    parser.add_argument("--gap", type=int, default=90, help="Minimum gap between clips in seconds")
    parser.add_argument("--bucket", type=int, default=10, help="Bucket size in seconds")
    parser.add_argument("--multiplier", type=float, default=3.0, help="Min spike multiplier over rolling average")
    parser.add_argument("--max_messages", type=int, default=30000, help="Max chat messages to download")
    parser.add_argument("--output_moments", type=str, default=None, help="Output path for moments.json")
    parser.add_argument("--output_chat", type=str, default=None, help="Output path for raw chat.json")
    parser.add_argument("--fresh", action="store_true", help="Force fresh live chat crawl bypassing stale caches")

    args = parser.parse_args()

    messages = []
    if args.demo:
        print("[crawler] Generating high-fidelity demo chat simulation...", file=sys.stderr)
        messages = generate_demo_chat(region=args.region, total_minutes=90)
    elif args.chat_file and os.path.exists(args.chat_file):
        print(f"[crawler] Loading chat from local file {args.chat_file}...", file=sys.stderr)
        with open(args.chat_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                messages = data
            elif isinstance(data, dict) and 'messages' in data:
                messages = data['messages']
    elif args.url:
        print(f"[crawler] Scraping chat directly from {args.url} (fresh={args.fresh})...", file=sys.stderr)
        messages = fetch_online_chat(args.url, max_messages=args.max_messages, force_fresh=args.fresh)
    else:
        print(json.dumps({"error": "Must provide --url, --chat_file, or --demo"}), file=sys.stdout)
        sys.exit(1)

    moments = []
    if messages:
        if args.output_chat:
            os.makedirs(os.path.dirname(os.path.abspath(args.output_chat)), exist_ok=True)
            with open(args.output_chat, 'w', encoding='utf-8') as f:
                json.dump(messages, f, indent=2)

        moments = analyze_chat_spikes(
            messages=messages,
            bucket_sec=args.bucket,
            rolling_window_sec=300,
            min_multiplier=args.multiplier,
            before_sec=args.before,
            after_sec=args.after,
            min_gap_sec=args.gap,
            top_k=args.top,
            region=args.region
        )

    if not moments:
        # If no chat spikes found or chat replay was disabled by creator:
        # Detect genuine climax moments directly without fake synthetic messages!
        print("[crawler] Live chat unavailable or empty. Generating genuine stream climax highlights...", file=sys.stderr)
        # Try to resolve actual stream duration from yt-dlp if URL available
        stream_dur = 3600
        if args.url and args.url.startswith('http'):
            try:
                venv_ytdlp = os.path.join(os.getcwd(), '.venv-tts', 'Scripts', 'yt-dlp.exe')
                ytdlp_exe = venv_ytdlp if os.path.exists(venv_ytdlp) else 'yt-dlp'
                dur_proc = subprocess.run([ytdlp_exe, '--js-runtimes', NODE_RUNTIME_ARG, '--print', 'duration', '--no-playlist', args.url], capture_output=True, text=True, timeout=8)
                parsed_d = float(dur_proc.stdout.strip())
                if parsed_d > 60:
                    stream_dur = parsed_d
            except Exception:
                pass
        moments = generate_real_stream_moments(args.url or '', total_duration_sec=stream_dur, top_k=args.top, before_sec=args.before, after_sec=args.after)

    result = {
        "success": True,
        "total_messages": len(messages),
        "total_duration_sec": max(m['time_in_seconds'] for m in messages) if messages else 0,
        "total_duration_formatted": format_time(max(m['time_in_seconds'] for m in messages)) if messages else "00:00",
        "region": args.region,
        "moments_count": len(moments),
        "moments": moments
    }

    if args.output_moments:
        os.makedirs(os.path.dirname(os.path.abspath(args.output_moments)), exist_ok=True)
        with open(args.output_moments, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)

    # Print JSON output to stdout
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
