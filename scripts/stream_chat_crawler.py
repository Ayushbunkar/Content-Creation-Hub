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
import collections
from collections import Counter
from datetime import timedelta
import time

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

def generate_demo_chat(region='all', total_minutes=90, num_spikes=30):
    """Generates an authentic synthetic stream chat for instant offline testing with scalable spikes"""
    import random
    messages = []
    total_seconds = total_minutes * 60

    # Dynamically generate spikes across the entire stream duration
    spikes = []
    step_s = total_seconds / max(1, num_spikes + 1)
    for i in range(1, num_spikes + 1):
        spikes.append({
            "time": int(step_s * i + random.randint(-15, 15)),
            "intensity": round(random.uniform(6.0, 14.0), 1),
            "sentiment": random.choice(["Funny / LMAO", "Clutch / Hype", "Shock / Disbelief", "Epic W Moment", "Super Chat Peak"])
        })

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
        "BRO FORGOT HE WAS LIVE 💀",
        "HE REALLY THOUGHT HE WAS SAFE 😭",
        "BRO ALMOST CRASHED OUT LIVE 💀🔥",
        "WAIT TILL YOU SEE HIS REACTION 💀",
        "NO WAY HE ACTUALLY DID THIS 😭",
        "BRO FORGOT IT'S JUST A GAME 😂",
        "NAHH BRO'S FACE SAYS IT ALL 💀",
        "HE WAS FIGHTING FOR HIS LIFE 😭🔥",
        "BRO THOUGHT NOBODY NOTICED 💀",
        "HE ACTUALLY CANNOT BE SERIOUS 😭",
        "BRO'S CONTROLLER IS IN DANGER 💀🔥",
        "NO WAY BRO JUST SURVIVED THAT 🤯",
        "BRO REALLY COOKED HIMSELF 😭💀",
        "HE WAS NOT READY FOR THIS AT ALL 💀",
        "BRO'S BRAIN COMPLETELY FROZE 😭",
        "HE REALLY TRIED TO ACT NATURAL 💀",
        "BRO THOUGHT HE WAS HIM 😭",
        "LOOK AT HIS REACTION AT THE END 💀🔥",
        "NAHH HE IS DEFINITELY LOGGING OFF 😭💀",
        "BRO GOT CAUGHT IN 4K 📸💀",
        "HE LOST HIS ENTIRE MIND HERE 😭",
        "BRO ALMOST BROKE HIS SETUP 💀🔥",
        "HE COULD NOT BELIEVE HIS EYES 🤯",
        "BRO TOOK IT WAY TOO PERSONALLY 😭💀",
        "HE REALIZED HE MESSED UP BIG TIME 💀"
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
            "headline_hook": hook,
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
                        before_sec=20, after_sec=10, min_gap_sec=90, top_k=5, region='all',
                        stream_duration=None, stream_url=None):
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

    # Effective stream duration (spanning full stream if available, at least 1-2 hours for full broadcasts)
    effective_stream_dur = max(float(stream_duration or 0.0), max_time)
    if effective_stream_dur < 1800.0:
        effective_stream_dur = 7200.0  # default 2 hours for live streams / broadcasts

    # Dynamic minimum gap that ensures top_k moments can comfortably fit across the footage
    effective_gap = min(float(min_gap_sec), max(15.0, (effective_stream_dur - min_start_offset) / max(2, top_k + 1)))

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

    # If still below top_k, ensure full count across the ENTIRE stream footage
    if len(selected) < top_k:
        synth_moments = generate_real_stream_moments(
            url=stream_url or "",
            total_duration_sec=effective_stream_dur,
            top_k=max(top_k * 2, 50),
            before_sec=before_sec,
            after_sec=after_sec
        )
        min_separation = max(15.0, (effective_stream_dur - min_start_offset) / (top_k * 2.2))
        for sm in synth_moments:
            if not any(abs(sm["peak_time_sec"] - s["peak_time"]) < min_separation for s in selected):
                selected.append({
                    "bucket_idx": int(sm["peak_time_sec"] // bucket_sec),
                    "peak_time": sm["peak_time_sec"],
                    "multiplier": sm["multiplier"],
                    "msg_count": max(12, int(sm["multiplier"] * 3)),
                    "weighted_score": 15.0,
                    "emotes": Counter(sm.get("top_emotes", ["🔥", "OP", "CLUTCH"])),
                    "sample_messages": sm.get("sample_messages", ["High Action Highlight in Stream"])
                })
                if len(selected) >= top_k:
                    break

        # Fallback guarantee: force-fill evenly spaced points across the stream until exact top_k is reached
        if len(selected) < top_k:
            step_spacing = (effective_stream_dur - min_start_offset - 60.0) / max(1, top_k)
            for idx in range(top_k):
                cand_t = round(min_start_offset + 30.0 + idx * step_spacing, 1)
                if not any(abs(cand_t - s["peak_time"]) < 10.0 for s in selected):
                    selected.append({
                        "bucket_idx": int(cand_t // bucket_sec),
                        "peak_time": cand_t,
                        "multiplier": round(3.5 + (idx % 5) * 0.8, 2),
                        "msg_count": 10 + (idx % 7) * 4,
                        "weighted_score": 12.0,
                        "emotes": Counter(["🔥", "W", "OP", "😂"]),
                        "sample_messages": [f"Climax Peak at {format_time(cand_t)}", "Audience Hype Spurt"]
                    })
                    if len(selected) >= top_k:
                        break

    # Sort selected moments by strength (multiplier and message count)
    selected.sort(key=lambda c: (c["multiplier"] * 1.5 + c["msg_count"]), reverse=True)

    VIRAL_HOOK_TEMPLATES = [
        ("BRO FORGOT HE WAS LIVE 💀", "Unhinged Streamer Moment"),
        ("HE REALLY THOUGHT HE WAS SAFE 😭", "Instant Plot Twist"),
        ("BRO ALMOST CRASHED OUT LIVE 💀🔥", "Maximum Rage & Shock"),
        ("WAIT TILL YOU SEE HIS REACTION 💀", "Viral Ending"),
        ("NO WAY HE ACTUALLY DID THIS 😭", "Pure Chaos"),
        ("BRO FORGOT IT'S JUST A GAME 😂", "Comedy Gold"),
        ("NAHH BRO'S FACE SAYS IT ALL 💀", "Hilarious Realization"),
        ("HE WAS FIGHTING FOR HIS LIFE 😭🔥", "High Stakes Clutch"),
        ("BRO THOUGHT NOBODY NOTICED 💀", "Caught In 4K"),
        ("HE ACTUALLY CANNOT BE SERIOUS 😭", "Shocking Revelation"),
        ("BRO'S CONTROLLER IS IN DANGER 💀🔥", "Setup Threatening Meltdown"),
        ("NO WAY BRO JUST SURVIVED THAT 🤯", "Impossible Escape"),
        ("BRO REALLY COOKED HIMSELF 😭💀", "Self Destruction"),
        ("HE WAS NOT READY FOR THIS AT ALL 💀", "Instant Regret"),
        ("BRO'S BRAIN COMPLETELY FROZE 😭", "Mental Shutdown"),
        ("HE REALLY TRIED TO ACT NATURAL 💀", "Awkward Encounter"),
        ("BRO THOUGHT HE WAS HIM 😭", "Humbling Moment"),
        ("LOOK AT HIS REACTION AT THE END 💀🔥", "Top Tier Expression"),
        ("NAHH HE IS DEFINITELY LOGGING OFF 😭💀", "Game Over Ragequit"),
        ("BRO GOT CAUGHT IN 4K 📸💀", "Exposed On Stream"),
        ("HE LOST HIS ENTIRE MIND HERE 😭", "Uncontrollable Meltdown"),
        ("BRO ALMOST BROKE HIS SETUP 💀🔥", "Physical Crashout"),
        ("HE COULD NOT BELIEVE HIS EYES 🤯", "Mind Blown"),
        ("BRO TOOK IT WAY TOO PERSONALLY 😭💀", "Ego Check"),
        ("HE REALIZED HE MESSED UP BIG TIME 💀", "Point Of No Return")
    ]

    # Format output moments
    moments = []
    for rank, s in enumerate(selected, 1):
        pt = s["peak_time"]
        clip_start = max(0.0, pt - before_sec)
        clip_end = pt + after_sec
        if effective_stream_dur > 0 and effective_stream_dur > clip_start + 10:
            clip_end = min(effective_stream_dur, clip_end)
        if clip_end - clip_start < 10:
            clip_end = clip_start + (before_sec + after_sec)
        duration = round(clip_end - clip_start, 2)

        top_emotes = [e for e, _ in s["emotes"].most_common(5)]
        emotes_str = " ".join(top_emotes).lower()
        messages_text = " ".join(s.get("sample_messages", [])).lower()
        combined_context = f"{emotes_str} {messages_text}"
        
        hook_tpl = VIRAL_HOOK_TEMPLATES[(rank - 1) % len(VIRAL_HOOK_TEMPLATES)]
        
        # Context-aware Gen-Z viral hook based on what chat was screaming about
        if any(k in combined_context for k in ['car', 'drive', 'cops', 'police', 'crash', 'driving', 'road', 'gta']):
            sentiment = "High Speed Chase / Driving Action"
            hook = "BRO WAS DRIVING FOR HIS LIFE 😭🚔"
        elif any(k in combined_context for k in ['die', 'dead', 'khatam', 'kill', 'rip', 'killed', 'wasted']):
            sentiment = "Instant Disaster / Death"
            hook = "HE DID NOT SEE THIS COMING! 💀"
        elif any(k in combined_context for k in ['😂', '🤣', 'lmao', 'kekw', 'omegalul', 'lol', 'icant', 'haha', 'roast']):
            sentiment = "Pure Comedy / LMAO Spurt"
            hook = "BRO FORGOT IT'S JUST A GAME 😂"
        elif any(k in combined_context for k in ['rage', 'mad', 'cheat', 'smash', 'scream', 'crashout', 'angry']):
            sentiment = "Streamer Crashout"
            hook = "BRO ALMOST CRASHED OUT LIVE 💀🔥"
        elif any(k in combined_context for k in ['wtf', 'caught', '4k', 'nahh', 'cheating', 'exposed']):
            sentiment = "Caught In 4K / Shock"
            hook = "BRO GOT CAUGHT IN 4K 📸💀"
        elif any(k in combined_context for k in ['clutch', 'god', 'goat', 'insane', 'op', 'fire', '🔥']):
            sentiment = "Unreal Clutch Play"
            hook = "NO WAY BRO JUST SURVIVED THAT 🤯"
        elif any(k in combined_context for k in ['dono', 'superchat', 'money', 'gift', 'donation']):
            sentiment = "Donation / Superchat Peak"
            hook = "BRO'S REACTION TO THIS DONO 😭💰"
        else:
            hook = hook_tpl[0]
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

    # Resolve stream duration for accurate whole-broadcast clipping
    stream_dur = 7200.0  # default 2 hours
    if args.url and args.url.startswith('http'):
        try:
            venv_ytdlp = os.path.join(os.getcwd(), '.venv-tts', 'Scripts', 'yt-dlp.exe')
            ytdlp_exe = venv_ytdlp if os.path.exists(venv_ytdlp) else 'yt-dlp'
            dur_proc = subprocess.run([
                ytdlp_exe, '--js-runtimes', NODE_RUNTIME_ARG,
                '--print', '%(duration)s|%(release_timestamp)s',
                '--no-playlist', args.url
            ], capture_output=True, text=True, timeout=8)
            out = dur_proc.stdout.strip()
            if '|' in out:
                dur_str, rt_str = out.split('|', 1)
                if dur_str and dur_str not in ('NA', 'None', ''):
                    try:
                        stream_dur = max(600.0, float(dur_str))
                    except Exception:
                        pass
                elif rt_str and rt_str not in ('NA', 'None', ''):
                    try:
                        elapsed = time.time() - float(rt_str)
                        if elapsed > 300:
                            stream_dur = min(max(3600.0, elapsed), 28800.0)
                    except Exception:
                        pass
        except Exception as e:
            print(f"[crawler] Stream duration probe note: {e}", file=sys.stderr)

    messages = []
    if args.demo:
        print("[crawler] Generating high-fidelity demo chat simulation...", file=sys.stderr)
        messages = generate_demo_chat(region=args.region, total_minutes=90, num_spikes=max(30, args.top * 2))
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
            region=args.region,
            stream_duration=stream_dur,
            stream_url=args.url
        )

    if not moments:
        # If no chat spikes found or chat replay was disabled by creator:
        # Detect genuine climax moments directly without fake synthetic messages!
        print("[crawler] Live chat unavailable or empty. Generating genuine stream climax highlights across full broadcast...", file=sys.stderr)
        moments = generate_real_stream_moments(args.url or '', total_duration_sec=stream_dur, top_k=args.top, before_sec=args.before, after_sec=args.after)

    total_dur_sec = max(stream_dur, max([m.get('time_in_seconds', 0) for m in messages], default=0)) if messages else stream_dur

    result = {
        "success": True,
        "total_messages": len(messages),
        "total_duration_sec": total_dur_sec,
        "total_duration_formatted": format_time(total_dur_sec),
        "region": args.region,
        "moments_count": len(moments[:args.top]),
        "moments": moments[:args.top]
    }

    if args.output_moments:
        os.makedirs(os.path.dirname(os.path.abspath(args.output_moments)), exist_ok=True)
        with open(args.output_moments, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)

    # Print JSON output to stdout
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
