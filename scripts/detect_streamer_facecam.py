#!/usr/bin/env python3
"""
detect_streamer_facecam.py
Uses OpenCV Computer Vision to automatically detect the streamer's face and webcam
position across video frames, returning exact pixel crop coordinates for split-screen reels.
Optimized for high-speed multi-cascade execution (under 2 seconds).
"""

import sys
import os
import json
import argparse
import subprocess
from pathlib import Path

try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

def detect_facecam(video_path: str, target_cam_h: int = 768, target_cam_w: int = 1080) -> dict:
    if not OPENCV_AVAILABLE or not os.path.exists(video_path):
        return {
            "success": False,
            "face_detected": False,
            "position_label": "top_left",
            "ffmpeg_cam_crop": "crop=iw*0.42:ih*0.52:0:0",
            "message": "OpenCV not available or video file missing"
        }

    # Load multi-cascade classifiers for maximum recall (frontal, tilted, angled)
    cascades = []
    cascade_names = [
        'haarcascade_frontalface_alt2.xml',
        'haarcascade_profileface.xml',
        'haarcascade_frontalface_default.xml'
    ]
    for cname in cascade_names:
        cpath = os.path.join(cv2.data.haarcascades, cname)
        if os.path.exists(cpath):
            cascades.append(cv2.CascadeClassifier(cpath))

    if not cascades:
        return {
            "success": False,
            "face_detected": False,
            "position_label": "top_left",
            "ffmpeg_cam_crop": "crop=iw*0.42:ih*0.52:0:0",
            "message": "Haar cascades missing"
        }

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {
            "success": False,
            "face_detected": False,
            "position_label": "top_left",
            "ffmpeg_cam_crop": "crop=iw*0.42:ih*0.52:0:0",
            "message": "Could not open video file"
        }

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 100)
    video_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
    video_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)

    # Sample 4 keyframes evenly across the video
    sample_indices = [
        int(total_frames * 0.15),
        int(total_frames * 0.40),
        int(total_frames * 0.65),
        int(total_frames * 0.85)
    ]

    all_faces = []
    scale_factor = 0.5  # downsample for 4x faster detection

    for f_idx in sample_indices:
        if f_idx >= total_frames:
            continue
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
        ret, frame = cap.read()
        if not ret or frame is None:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small_gray = cv2.resize(gray, (0, 0), fx=scale_factor, fy=scale_factor)
        small_gray = cv2.equalizeHist(small_gray)

        # Detect faces: min size 25x25 in downsampled space (= 50x50 in 1080p)
        frame_faces = []
        for cascade in cascades:
            dets = cascade.detectMultiScale(
                small_gray,
                scaleFactor=1.15,
                minNeighbors=3,
                minSize=(25, 25)
            )
            for (x, y, w, h) in dets:
                orig_x = int(x / scale_factor)
                orig_y = int(y / scale_factor)
                orig_w = int(w / scale_factor)
                orig_h = int(h / scale_factor)
                frame_faces.append({
                    "x": orig_x,
                    "y": orig_y,
                    "w": orig_w,
                    "h": orig_h,
                    "cx": int(orig_x + orig_w / 2),
                    "cy": int(orig_y + orig_h / 2),
                    "frame": int(f_idx)
                })
            if len(dets) > 0:
                break  # Got high-confidence detections on this frame

        all_faces.extend(frame_faces)

    cap.release()

    if not all_faces:
        # Fallback to middle-left / top-left safe window
        return {
            "success": True,
            "face_detected": False,
            "position_label": "center_left",
            "ffmpeg_cam_crop": "crop=iw*0.42:ih*0.52:0:ih*0.25",
            "message": "No clear face detected, using safe center-left streamer layout"
        }

    # Group faces by spatial proximity to find the persistent streamer webcam box
    clusters = []
    for f in all_faces:
        matched = False
        for c in clusters:
            if abs(f["cx"] - c["cx"]) < 140 and abs(f["cy"] - c["cy"]) < 140:
                c["faces"].append(f)
                c["cx"] = int(sum(x["cx"] for x in c["faces"]) // len(c["faces"]))
                c["cy"] = int(sum(y["cy"] for y in c["faces"]) // len(c["faces"]))
                c["w"] = int(max(c["w"], f["w"]))
                c["h"] = int(max(c["h"], f["h"]))
                matched = True
                break
        if not matched:
            clusters.append({
                "cx": int(f["cx"]),
                "cy": int(f["cy"]),
                "w": int(f["w"]),
                "h": int(f["h"]),
                "faces": [f]
            })

    # Pick cluster with highest frequency (persistent stationary webcam)
    clusters.sort(key=lambda c: len(c["faces"]), reverse=True)
    best_cluster = clusters[0]

    fc_x = int(best_cluster["cx"])
    fc_y = int(best_cluster["cy"])
    fw = int(best_cluster["w"])
    fh = int(best_cluster["h"])

    # Classify region label
    pos_x = "left" if fc_x < (video_w * 0.40) else ("right" if fc_x > (video_w * 0.60) else "center")
    pos_y = "top" if fc_y < (video_h * 0.40) else ("bottom" if fc_y > (video_h * 0.65) else "center")

    if pos_x == "center" and pos_y == "center":
        position_label = "auto_center"
    elif pos_x == "center":
        position_label = f"{pos_y}_center"
    elif pos_y == "center":
        position_label = f"center_{pos_x}"
    else:
        position_label = f"{pos_y}_{pos_x}"

    # Calculate optimal camera crop window tightly zoomed on the streamer's face
    desired_ratio = 1080.0 / float(target_cam_h)  # e.g. 1080/768 = 1.406

    # Tight punch-in zoom: 2.25x face width so streamer's face, expressions & chest fill the top reel frame
    crop_w = int(max(fw * 2.25, 160))
    crop_h = int(crop_w / desired_ratio)

    # Ensure crop doesn't exceed video dimensions
    if crop_w > video_w:
        crop_w = video_w
        crop_h = int(crop_w / desired_ratio)
    if crop_h > video_h:
        crop_h = video_h
        crop_w = int(crop_h * desired_ratio)

    # Center crop on face center (fc_x, fc_y) with 45% headroom above face so head & hair are never cut
    crop_x = int(fc_x - (crop_w // 2))
    crop_y = int(fc_y - int(crop_h * 0.45))

    # Clamp bounds inside frame
    crop_x = max(0, min(video_w - crop_w, crop_x))
    crop_y = max(0, min(video_h - crop_h, crop_y))

    ffmpeg_cam_crop = f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}"

    return {
        "success": True,
        "face_detected": True,
        "position_label": position_label,
        "face_center": {"x": fc_x, "y": fc_y},
        "face_size": {"w": fw, "h": fh},
        "crop_box": {"x": crop_x, "y": crop_y, "w": crop_w, "h": crop_h},
        "ffmpeg_cam_crop": ffmpeg_cam_crop,
        "message": f"Streamer face detected at ({fc_x}, {fc_y}) in {position_label} region. Crop: {ffmpeg_cam_crop}"
    }

def main():
    parser = argparse.ArgumentParser(description="Detect streamer facecam region in video footage")
    parser.add_argument("video_path", help="Path to input stream clip video")
    parser.add_argument("--cam_h", type=int, default=768, help="Target height for top camera section in split screen")
    parser.add_argument("--output_json", default=None, help="Optional output JSON path")
    args = parser.parse_args()

    result = detect_facecam(args.video_path, target_cam_h=args.cam_h)

    if args.output_json:
        with open(args.output_json, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)

    print(json.dumps(result))

if __name__ == "__main__":
    main()
