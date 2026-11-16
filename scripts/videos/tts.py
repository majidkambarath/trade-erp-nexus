"""Speak a list of narrations (free, runs on this machine).
Input JSON: [{ "out": "x.wav", "segs": [{ "v": "en" | "ml", "t": "text" }] }]. Each narration is one wav: its segments
spoken in turn (a Malayalam line with an English on-screen name in it switches voice for that name), 0.25 s apart.
usage: python tts.py jobs.json

Voices (environment):
  VOICE_EN   a Piper voice in voices/ (default en_US-ljspeech-medium)
  VOICE_ML   "azure:ml-IN-SobhanaNeural" (female) or "azure:ml-IN-MidhunNeural" (male): Microsoft's neural Malayalam voices, on
             the free Azure Speech tier (500,000 characters a month; the whole set needs about 40,000). The key and region
             come from AZURE_SPEECH_KEY / AZURE_SPEECH_REGION, or from scripts/videos/azure.env (two lines, git-ignored).
             The text is sent to Microsoft. Or "parler:Anjali" (default; AI4Bharat Indic Parler-TTS, Apache 2.0, needs a Hugging Face login that has
             accepted the model's terms) or "parler:Harish", or a Piper voice in voices/ such as ml_IN-meera-medium.
  Either     "elevenlabs:<voice id>": an ElevenLabs voice (paid account; Malayalam needs model eleven_v4 or eleven_v3).
             Key and model from ELEVENLABS_API_KEY / ELEVENLABS_MODEL, or scripts/videos/elevenlabs.env (git-ignored).
Parler is about 10x slower than the speech it makes on a laptop CPU, so each spoken sentence is kept in
voices/.cache and spoken only once, whatever guide it appears in.
Everything is written at 22,050 Hz mono 16-bit."""
import hashlib, json, os, sys, wave
from pathlib import Path

import numpy as np

here = Path(__file__).parent
voices_dir = here / "voices"
cache_dir = voices_dir / ".cache"
cache_dir.mkdir(parents=True, exist_ok=True)
RATE = 22050
VOICE_EN = os.environ.get("VOICE_EN", "en_US-ljspeech-medium")
VOICE_ML = os.environ.get("VOICE_ML", "azure:ml-IN-SobhanaNeural")

_piper = {}
_parler = {}


def piper_voice(name):
    if name not in _piper:
        from piper import PiperVoice
        _piper[name] = PiperVoice.load(str(voices_dir / f"{name}.onnx"))
    return _piper[name]


def resample(x, src, dst=RATE):
    """A proper band-limited resample (torchaudio). The first version interpolated without a low-pass filter, which
    folds the top of a 44.1 kHz voice back into the audible range and makes it sound harsh and metallic."""
    if src == dst:
        return x
    import torch, torchaudio
    return torchaudio.functional.resample(torch.from_numpy(x).unsqueeze(0), src, dst).squeeze(0).numpy()


def to_pcm(x):
    return (np.clip(x, -1.0, 1.0) * 32767).astype("<i2").tobytes()


def speak_piper(name, text):
    v = piper_voice(name)
    data = b""
    for chunk in v.synthesize(text):
        data += chunk.audio_int16_bytes
        rate = chunk.sample_rate
    x = np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768.0
    return to_pcm(resample(x, rate))


def parler_models():
    if not _parler:
        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer
        name = "ai4bharat/indic-parler-tts"
        torch.set_num_threads(os.cpu_count() or 4)
        model = ParlerTTSForConditionalGeneration.from_pretrained(name).eval()
        _parler.update(model=model, tok=AutoTokenizer.from_pretrained(name),
                       dtok=AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path), torch=torch)
    return _parler


def speak_parler(speaker, text):
    p = parler_models()
    torch = p["torch"]
    desc = f"{speaker}'s voice is clear and calm, speaking at a moderate pace and moderate pitch, in a close-sounding recording with no background noise."
    ids = p["dtok"](desc, return_tensors="pt")
    prompt = p["tok"](text, return_tensors="pt")
    torch.manual_seed(7)  # the same words in the same voice every time
    with torch.no_grad():
        gen = p["model"].generate(input_ids=ids.input_ids, attention_mask=ids.attention_mask,
                                  prompt_input_ids=prompt.input_ids, prompt_attention_mask=prompt.attention_mask)
    x = gen.cpu().numpy().squeeze().astype(np.float32)
    return to_pcm(resample(x, p["model"].config.sampling_rate))


def azure_settings():
    key, region = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
    f = here / "azure.env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            k, _, v = line.partition("=")
            if k.strip() == "AZURE_SPEECH_KEY" and not key: key = v.strip()
            if k.strip() == "AZURE_SPEECH_REGION" and not region: region = v.strip()
    return (key, region) if key and region else None


def speak_edge(voice, text):
    """The same Microsoft neural voice with no account, through Edge's read-aloud service (edge-tts). Unofficial: use
    the Azure key (azure.env) for anything that ships. Decoded to PCM with ffmpeg (FFMPEG env or the one on PATH)."""
    import asyncio, subprocess
    import edge_tts

    async def fetch():
        audio = b""
        async for chunk in edge_tts.Communicate(text, voice, rate="-5%").stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]
        return audio

    mp3 = asyncio.run(fetch())
    if not mp3:
        sys.exit(f"Edge returned no audio for the {voice} voice")
    r = subprocess.run([os.environ.get("FFMPEG", "ffmpeg"), "-v", "error", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", str(RATE), "pipe:1"],
                       input=mp3, capture_output=True)
    if r.returncode != 0:
        sys.exit(f"ffmpeg could not decode the voice: {r.stderr[:200]!r}")
    return r.stdout


def speak_azure(voice, text):
    import urllib.request, urllib.error
    from xml.sax.saxutils import escape
    settings = azure_settings()
    if not settings:
        return speak_edge(voice, text)  # no Azure key yet: the same voice through Edge's read-aloud service
    key, region = settings
    ssml = (f"<speak version='1.0' xml:lang='ml-IN'><voice xml:lang='ml-IN' name='{voice}'>"
            f"<prosody rate='-5%'>{escape(text)}</prosody></voice></speak>")
    req = urllib.request.Request(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml.encode("utf-8"), method="POST",
                                 headers={"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
                                          "X-Microsoft-OutputFormat": "raw-24khz-16bit-mono-pcm", "User-Agent": "guide-videos"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"Azure Speech refused the request ({e.code}): {e.read()[:200]!r}. Check the key and region.")
    x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    return to_pcm(resample(x, 24000))


def env_file(name, keys):
    """Values from the environment, else from a git-ignored KEY=value file beside this script."""
    found = {k: os.environ.get(k) for k in keys}
    f = here / name
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            k, _, v = line.partition("=")
            if k.strip() in found and not found[k.strip()]:
                found[k.strip()] = v.strip()
    return found


def speak_elevenlabs(voice, text, lang):
    """An ElevenLabs voice over its official API. Raw 16-bit mono PCM at 22,050 Hz comes back, so no decoding or
    resampling. language_code forces the language (Malayalam is only in eleven_v4 / eleven_v3)."""
    import urllib.request, urllib.error
    cfg = env_file("elevenlabs.env", ["ELEVENLABS_API_KEY", "ELEVENLABS_MODEL"])
    key = cfg["ELEVENLABS_API_KEY"]
    if not key:
        sys.exit("No ElevenLabs key: put ELEVENLABS_API_KEY=... in scripts/videos/elevenlabs.env")
    body = json.dumps({"text": text, "model_id": cfg["ELEVENLABS_MODEL"] or "eleven_v4", "language_code": lang}).encode("utf-8")
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_{RATE}", data=body, method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/pcm"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = e.read()[:300]
        why = {401: "the key was refused", 402: "the account has no credits left", 404: "that voice id does not exist",
               422: "the request was refused (model or language)", 429: "too many requests or the plan's limit"}.get(e.code, "it failed")
        sys.exit(f"ElevenLabs: {why} ({e.code}): {detail!r}")


def speak(lang, text):
    voice = VOICE_EN if lang == "en" else VOICE_ML
    key = hashlib.sha1(f"v2|{lang}|{voice}|{text}".encode("utf-8")).hexdigest()
    cached = cache_dir / f"{key}.pcm"
    if cached.exists():
        return cached.read_bytes()
    if voice.startswith("elevenlabs:"): pcm = speak_elevenlabs(voice.split(":", 1)[1], text, lang)
    elif voice.startswith("azure:"): pcm = speak_azure(voice.split(":", 1)[1], text)
    elif voice.startswith("parler:"): pcm = speak_parler(voice.split(":", 1)[1], text)
    else: pcm = speak_piper(voice, text)
    cached.write_bytes(pcm)
    return pcm


def sentences(text):
    """Parler is steadier on one sentence at a time; Piper does not care."""
    import re
    parts = [s.strip() for s in re.split(r"(?<=[.!?।])\s+", text) if s.strip()]
    return parts or [text]


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    gap = b"\x00\x00" * int(RATE * 0.25)
    for job in jobs:
        data = b""
        for seg in job["segs"]:
            t = seg["t"].strip()
            if not t or not any(c.isalnum() for c in t):
                continue
            pieces = sentences(t) if seg["v"] == "ml" and VOICE_ML.startswith("parler:") else [t]
            for piece in pieces:
                data += speak(seg["v"], piece) + gap
        with wave.open(job["out"], "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
            w.writeframes(data)
        print("spoke", job["out"], round(len(data) / 2 / RATE, 1), "s", flush=True)
