import whisper

model = whisper.load_model('base')
result = model.transcribe('test_extracted.wav')
print("Full text:", result['text'])
for seg in result['segments']:
    print(f"{seg['start']:.2f}s - {seg['end']:.2f}s: {seg['text']}")
