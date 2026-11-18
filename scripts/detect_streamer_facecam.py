#!/usr/bin/env python3
"""
detect_streamer_facecam.py
Uses OpenCV Computer Vision to automatically detect the streamer's face and webcam
position across video frames, returning exact pixel crop coordinates for split-screen reels.
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

    cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
    if not os.path.exists(cascade_path):
        return {
            "success": False,
            "face_detected": False,
            "position_label": "top_left",
            "ffmpeg_cam_crop": "crop=iw*0.42:ih*0.52:0:0",
            "message": "Haar cascade xml missing"
        }

    face_cascade = cv2.CascadeClassifier(cascade_path)
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

    # Sample up to 8 frames across the video to reliably identify the persistent streamer webcam
    sample_indices = [
        int(total_frames * 0.15),
        int(total_frames * 0.30),
        int(total_frames * 0.50),
        int(total_frames * 0.70),
        int(total_frames * 0.85)
    ]

    all_faces = []

    for f_idx in sample_indices:
        if f_idx >= total_frames:
            continue
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
        ret, frame = cap.read()
        if not ret or frame is None:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Enhance contrast for webcam detection
        gray = cv2.equalizeHist(gray)

        # Detect faces: min size 50x50
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.15,
            minNeighbors=5,
            minSize=(50, 50)
        )

        for (x, y, w, h) in faces:
            # Score face based on size (streamer webcam faces are typically >= 70px)
            # and ignore full-screen cutscene faces if corner faces exist
            all_faces.append({
                "x": int(x),
                "y": int(y),
                "w": int(w),
                "h": int(h),
                "cx": int(x + w / 2),
                "cy": int(y + h / 2),
                "frame": f_idx
            })

    cap.release()

    if not all_faces:
        # No face detected: default to top-left (standard streamer layout)
        return {
            "success": True,
            "face_detected": False,
            "position_label": "top_left",
            "ffmpeg_cam_crop": "crop=iw*0.42:ih*0.52:0:0",
            "message": "No clear face detected, using top-left streamer layout"
        }

    # Streamer facecam is stationary across frames.
    # Group faces by proximity (within 120px of each other) to find the persistent streamer webcam box
    clusters = []
    for f in all_faces:
        matched = False
        for c in clusters:
            if abs(f["cx"] - c["cx"]) < 120 and abs(f["cy"] - c["cy"]) < 120:
                c["faces"].append(f)
                c["cx"] = sum(x["cx"] for x in c["faces"]) // len(c["faces"])
                c["cy"] = sum(y["cy"] for y in c["faces"]) // len(c["faces"])
                c["w"] = max(c["w"], f["w"])
                c["h"] = max(c["h"], f["h"])
                matched = True
                break
        if not matched:
            clusters.append({
                "cx": f["cx"],
                "cy": f["cy"],
                "w": f["w"],
                "h": f["h"],
                "faces": [f]
            })

    # Pick cluster with highest frequency (most consistent face across sampled frames)
    clusters.sort(key=lambda c: len(c["faces"]), reverse=True)
    best_cluster = clusters[0]

    fc_x = best_cluster["cx"]
    fc_y = best_cluster["cy"]
    fw = best_cluster["w"]
    fh = best_cluster["h"]

    # Classify region label
    pos_x = "left" if fc_x < (video_w * 0.40) else ("right" if fc_x > (video_w * 0.60) else "center")
    pos_y = "top" if fc_y < (video_h * 0.45) else ("bottom" if fc_y > (video_h * 0.55) else "center")

    if pos_x == "center" and pos_y == "center":
        position_label = "auto_center"
    elif pos_x == "center":
        position_label = f"{pos_y}_center"
    else:
        position_label = f"{pos_y}_{pos_x}"

    # Calculate optimal camera crop window centered on the detected face
    # We want a comfortable bust shot (face + shoulders) with 9:16 or split target aspect ratio
    desired_ratio = 1080.0 / float(target_cam_h)  # e.g. 1080/768 = 1.406 (approx 16:11)
    
    # Crop width should be ~2.8x to 3.5x face width to include streamer's headphones and mic
    crop_w = int(max(fw * 3.2, video_w * 0.35))
    crop_h = int(crop_w / desired_ratio)

    # Ensure crop doesn't exceed video dimensions
    if crop_w > video_w:
        crop_w = video_w
        crop_h = int(crop_w / desired_ratio)
    if crop_h > video_h:
        crop_h = video_h
        crop_w = int(crop_h * desired_ratio)

    # Center crop on face center (fc_x, fc_y) with headroom offset (face slightly above center)
    crop_x = int(fc_x - (crop_w // 2))
    crop_y = int(fc_y - int(crop_h * 0.42))  # 42% headroom so face isn't clipped at the top

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
