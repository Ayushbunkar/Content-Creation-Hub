#!/usr/bin/env python3
"""
segment_subject.py
High-performance subject segmentation for the Word-Behind-Head effect.
Extracts speaker foreground matte using OpenCV face detection + GrabCut + Gaussian feathering.
Generates RGBA cutout and alpha mask for browser live preview and FFmpeg video compositing.
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

def segment_speaker_frame(
    video_path: str,
    timestamp: float,
    output_dir: str,
    feather_radius: int = 15,
    custom_rect: list = None
) -> dict:
    if not OPENCV_AVAILABLE:
        return {
            "success": False,
            "mode": "manual",
            "message": "OpenCV not installed in environment",
            "fallback": True
        }

    if not os.path.exists(video_path):
        return {
            "success": False,
            "mode": "manual",
            "message": f"Video file not found: {video_path}",
            "fallback": True
        }

    os.makedirs(output_dir, exist_ok=True)
    base_name = f"subject_{int(timestamp * 1000)}"
    raw_frame_path = os.path.join(output_dir, f"{base_name}_raw.jpg")
    mask_path = os.path.join(output_dir, f"{base_name}_mask.png")
    fg_path = os.path.join(output_dir, f"{base_name}_fg.png")

    # 1. Extract exact frame via FFmpeg
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{timestamp:.3f}",
        "-i", video_path,
        "-vframes", "1",
        "-q:v", "2",
        raw_frame_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if not os.path.exists(raw_frame_path):
        return {
            "success": False,
            "mode": "manual",
            "message": "Failed to extract video frame",
            "fallback": True
        }

    img = cv2.imread(raw_frame_path)
    if img is None:
        return {
            "success": False,
            "mode": "manual",
            "message": "Could not read extracted frame",
            "fallback": True
        }

    height, width = img.shape[:2]

    # 2. Face Detection for Subject Anchor
    face_detected = False
    fx, fy, fw, fh = 0, 0, 0, 0

    if custom_rect and len(custom_rect) == 4:
        fx, fy, fw, fh = custom_rect
        face_detected = True
    else:
        cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
        if os.path.exists(cascade_path):
            face_cascade = cv2.CascadeClassifier(cascade_path)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40))
            if len(faces) > 0:
                # Pick largest face (primary speaker)
                faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                fx, fy, fw, fh = faces[0]
                face_detected = True

    # 3. Formulate Subject Bounding Region
    if face_detected:
        # Subject occupies head above face, hair, and torso downward
        head_top = max(0, int(fy - fh * 0.45))
        subj_left = max(0, int(fx - fw * 0.65))
        subj_right = min(width - 1, int(fx + fw * 1.65))
        subj_bottom = height - 1  # Torso usually extends to bottom of screen
        rect = (subj_left, head_top, subj_right - subj_left, subj_bottom - head_top)
    else:
        # Fallback bounding box: centered vertical third (typical talking head)
        rect = (int(width * 0.22), int(height * 0.08), int(width * 0.56), int(height * 0.90))

    # 4. GrabCut Segmentation
    try:
        mask = np.zeros(img.shape[:2], np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)

        cv2.grabCut(img, mask, rect, bgd_model, fgd_model, 4, cv2.GC_INIT_WITH_RECT)

        # Foreground is where mask is 1 (GC_FGD) or 3 (GC_PR_FGD)
        bin_mask = np.where((mask == 2) | (mask == 0), 0, 255).astype('uint8')

        # 5. Clean up mask: close small holes inside person
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        bin_mask = cv2.morphologyEx(bin_mask, cv2.MORPH_CLOSE, kernel)

        # 6. Feather edges with Gaussian Blur for seamless blending
        ksize = max(3, feather_radius if feather_radius % 2 == 1 else feather_radius + 1)
        feathered_mask = cv2.GaussianBlur(bin_mask, (ksize, ksize), 0)

        # Save Grayscale Mask PNG
        cv2.imwrite(mask_path, feathered_mask)

        # 7. Generate RGBA Cutout (Person with transparent background)
        b, g, r = cv2.split(img)
        rgba = cv2.merge([b, g, r, feathered_mask])
        cv2.imwrite(fg_path, rgba)

        # Clean up raw frame
        try:
            os.remove(raw_frame_path)
        except:
            pass

        return {
            "success": True,
            "mode": "ai" if face_detected else "fallback_rect",
            "face_detected": face_detected,
            "face": {
                "x": int(fx),
                "y": int(fy),
                "width": int(fw),
                "height": int(fh),
                "head_center_x": int(fx + fw / 2),
                "head_center_y": int(fy + fh * 0.35)
            },
            "subject_bounds": {
                "x": int(rect[0]),
                "y": int(rect[1]),
                "width": int(rect[2]),
                "height": int(rect[3])
            },
            "mask_path": mask_path.replace("\\", "/"),
            "fg_path": fg_path.replace("\\", "/"),
            "width": width,
            "height": height,
            "fallback": not face_detected
        }

    except Exception as e:
        return {
            "success": False,
            "mode": "manual",
            "message": f"GrabCut error: {str(e)}",
            "fallback": True
        }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Segment speaker subject for Word-Behind-Head effect")
    parser.add_argument("video_path", help="Path to source video")
    parser.add_argument("--time", type=float, default=2.0, help="Timestamp in seconds to segment")
    parser.add_argument("--outdir", default="storage/masks", help="Output directory for masks")
    parser.add_argument("--feather", type=int, default=15, help="Edge feathering radius")
    parser.add_argument("--rect", type=str, default="", help="Custom rect x,y,w,h")

    args = parser.parse_args()

    custom_rect = None
    if args.rect:
        try:
            custom_rect = [int(v) for v in args.rect.split(',')]
        except:
            pass

    res = segment_speaker_frame(args.video_path, args.time, args.outdir, args.feather, custom_rect)
    print(json.dumps(res))
