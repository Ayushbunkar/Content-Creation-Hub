import os
import subprocess

SFX_DIR = os.path.join(os.getcwd(), 'public', 'audio', 'sound-effects')
os.makedirs(SFX_DIR, exist_ok=True)

sfx_recipes = {
    'whoosh.wav': '-f lavfi -i "anoisesrc=d=0.6:c=white,bandpass=f=900:w=600,afade=t=in:ss=0:d=0.25,afade=t=out:st=0.25:d=0.35,volume=2.2"',
    'swish.wav': '-f lavfi -i "anoisesrc=d=0.35:c=white,bandpass=f=2200:w=1200,afade=t=in:ss=0:d=0.10,afade=t=out:st=0.10:d=0.25,volume=2.0"',
    'click.wav': '-f lavfi -i "sine=frequency=2200:duration=0.04,afade=t=out:st=0.01:d=0.03,volume=1.5"',
    'paper-movement.wav': '-f lavfi -i "anoisesrc=d=0.7:c=pink,bandpass=f=1800:w=1200,tremolo=f=8:d=0.8,afade=t=in:ss=0:d=0.15,afade=t=out:st=0.3:d=0.4,volume=2.0"',
    'newspaper-impact.wav': '-f lavfi -i "sine=frequency=95:duration=0.6,afade=t=in:ss=0:d=0.02,afade=t=out:st=0.1:d=0.5,volume=2.4"',
    'camera-shutter.wav': '-f lavfi -i "sine=frequency=3200:duration=0.08,afade=t=out:st=0.01:d=0.07,volume=2.0"',
    'bass-impact.wav': '-f lavfi -i "sine=frequency=48:duration=1.8,afade=t=in:ss=0:d=0.03,afade=t=out:st=0.4:d=1.4,volume=2.5"',
    'subtle-riser.wav': '-f lavfi -i "anoisesrc=d=2.4:c=pink,bandpass=f=750:w=500,afade=t=in:ss=0:d=2.0,afade=t=out:st=2.0:d=0.4,volume=2.0"',
    'cinematic-transition.wav': '-f lavfi -i "sine=frequency=75:duration=2.2,afade=t=in:ss=0:d=0.04,afade=t=out:st=0.5:d=1.7,flanger=delay=5:depth=2,volume=2.2"',
    'typing.wav': '-f lavfi -i "sine=frequency=1800:duration=0.05,afade=t=out:st=0.01:d=0.04,tremolo=f=20:d=0.9,volume=1.6"',
    'digital-interface.wav': '-f lavfi -i "sine=frequency=1400:duration=0.15,afade=t=out:st=0.05:d=0.10,volume=1.8"',
    'ambient-sound.wav': '-f lavfi -i "anoisesrc=d=4.5:c=pink,lowpass=f=120,volume=2.5"',
    'sub-bass-impact.wav': '-f lavfi -i "sine=frequency=52:duration=1.8,afade=t=in:ss=0:d=0.04,afade=t=out:st=0.5:d=1.3,volume=2.5"',
    'cinematic-hit.wav': '-f lavfi -i "sine=frequency=80:duration=1.5,afade=t=in:ss=0:d=0.03,afade=t=out:st=0.3:d=1.2,volume=2.2"',
    'riser.wav': '-f lavfi -i "anoisesrc=d=2.4:c=pink,bandpass=f=600:w=400,afade=t=in:ss=0:d=2.0,afade=t=out:st=2.0:d=0.4,volume=2.0"',
    'digital-glitch.wav': '-f lavfi -i "anoisesrc=d=0.35:c=white,bandpass=f=1400:w=1000,tremolo=f=45:d=0.9,afade=t=out:st=0.15:d=0.2,volume=1.8"',
    'ticking.wav': '-f lavfi -i "sine=frequency=1400:duration=0.06,afade=t=out:st=0.01:d=0.05,volume=1.4"',
    'metallic-impact.wav': '-f lavfi -i "sine=frequency=440:duration=1.4,afade=t=in:ss=0:d=0.02,afade=t=out:st=0.2:d=1.2,flanger=delay=4:depth=3,volume=2.0"',
    'ambient-drone.wav': '-f lavfi -i "anoisesrc=d=4.0:c=pink,lowpass=f=140,volume=2.5"',
    'low-rumble.wav': '-f lavfi -i "sine=frequency=42:duration=3.5,afade=t=in:ss=0:d=0.8,afade=t=out:st=2.0:d=1.5,volume=2.2"',
    'page-turn.wav': '-f lavfi -i "anoisesrc=d=0.5:c=pink,bandpass=f=1600:w=1000,afade=t=in:ss=0:d=0.1,afade=t=out:st=0.2:d=0.3,volume=1.8"'
}

for name, recipe in sfx_recipes.items():
    out_path = os.path.join(SFX_DIR, name)
    cmd = f'ffmpeg -y {recipe} -ar 48000 -ac 2 "{out_path}"'
    subprocess.run(cmd, shell=True, check=True)
    print(f"Generated SFX: {name}")

print(f"All {len(sfx_recipes)} professional SFX generated successfully in public/audio/sound-effects/")
