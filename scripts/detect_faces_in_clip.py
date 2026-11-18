import sys
import json
import os
import subprocess
import cv2

def analyze_clip(video_path, start_time, duration):
    try:
        sample_fractions = [0.15, 0.40, 0.65, 0.85]
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        max_faces = 0
        samples = []

        temp_dir = os.path.join("storage", "temp_frames")
        os.makedirs(temp_dir, exist_ok=True)

        for idx, frac in enumerate(sample_fractions):
            t = start_time + (duration * frac)
            tmp_img = os.path.join(temp_dir, f"frame_{idx}_{os.getpid()}.jpg")
            cmd = ["ffmpeg", "-y", "-ss", f"{t:.2f}", "-i", video_path, "-vframes", "1", "-q:v", "4", tmp_img]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if os.path.exists(tmp_img):
                img = cv2.imread(tmp_img)
                try:
                    os.remove(tmp_img)
                except:
                    pass
                if img is not None:
                    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
                    cnt = len(faces)
                    samples.append(cnt)
                    if cnt > max_faces:
                        max_faces = cnt

        avg_faces = (sum(samples) / len(samples)) if samples else 0.0
        # If any sample had 2 or more faces or average faces > 1.2, it's a multi-person / crowd frame
        is_single = (max_faces <= 1) and (avg_faces <= 1.0)

        print(json.dumps({
            "is_single_person": is_single,
            "max_faces": max_faces,
            "avg_faces": round(avg_faces, 2),
            "samples": samples
        }))

    except Exception as e:
        print(json.dumps({"is_single_person": False, "max_faces": 0, "error": str(e)}))

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(json.dumps({"is_single_person": False, "max_faces": 0, "error": "Insufficient arguments"}))
        sys.exit(0)

    v_path = sys.argv[1]
    s_time = float(sys.argv[2])
    d_time = float(sys.argv[3])
    analyze_clip(v_path, s_time, d_time)
