# Speak each line with Kokoro (https://huggingface.co/hexgrad/Kokoro-82M) into a WAV file.
# Called by scripts/make-voice.js: python voice-tts.py <lines.json> <out dir> <voice> <speed>
# lines.json is [{"id": ..., "text": ...}]; writes <out dir>/<id>.wav (24 kHz mono).
import json
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline

lines_file, out_dir, voice, speed = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
lines = json.load(open(lines_file))
pipeline = KPipeline(lang_code=voice[0], repo_id='hexgrad/Kokoro-82M')

for n, line in enumerate(lines, 1):
    audio = np.concatenate([a.numpy() for _, _, a in pipeline(line['text'], voice=voice, speed=speed)])
    # Trim near-silence at both ends, keep a short tail, and even out the loudness.
    loud = np.nonzero(np.abs(audio) > 0.01)[0]
    if len(loud):
        audio = audio[max(0, loud[0] - 480):loud[-1] + 2400]
    audio = audio * (0.9 / max(1e-6, float(np.max(np.abs(audio)))))
    sf.write(f"{out_dir}/{line['id']}.wav", audio, 24000)
    print(f"{n}/{len(lines)} {line['text']}", flush=True)
