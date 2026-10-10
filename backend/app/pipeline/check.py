

segments, info = model.transcribe(r"D:\Projects\tsumari\backend\how to be confident in 5 minutes ( NO BULLSHIT).mp3", beam_size=5)

print("Detected language '%s' with probability %f" % (info.language, info.language_probability))

for segment in segments:
    print("[%.2fs -> %.2fs] %s" % (segment.start, segment.end, segment.text))