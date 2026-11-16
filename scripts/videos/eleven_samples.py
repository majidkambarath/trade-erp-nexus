"""Try ElevenLabs voices for the Malayalam narration before re-recording anything.
  python eleven_samples.py voices              list the voices this account can use, and Malayalam voices in the library
  python eleven_samples.py speak <voice id>... speak the same three guide cards with each voice (and with today's voice)
Samples go to samples/eleven-<voice id>.wav and samples/eleven-current.wav. Each run costs a few hundred characters.
The key comes from scripts/videos/elevenlabs.env (git-ignored) or ELEVENLABS_API_KEY."""
import json, os, sys, urllib.request, wave
from pathlib import Path

here = Path(__file__).parent
sys.path.insert(0, str(here))
import tts  # noqa: E402  (the narration engine itself, so a sample sounds exactly like a video)

# Three cards as the Malayalam videos speak them: plain wording, an on-screen name, and numbers.
CARDS = [
    "ഒരു ജോബ് കാർഡ് തുറക്കുക. ഒരു ജോബ് കാർഡ് ഒരു വെഹിക്കിളിനെ വർക്ക്ഷോപ്പിലൂടെ പിന്തുടരുന്നു: പരാതി, എസ്റ്റിമേറ്റ്, ടാസ്കുകൾ.",
    "ന്യൂ ജോബ് കാർഡ് അമർത്തുക. എന്നിട്ട് വെഹിക്കിളിന്റെ പ്ലേറ്റ് നമ്പർ തിരഞ്ഞെടുക്കുക.",
    "എക്സസ്. കസ്റ്റമർ സ്വയം അടയ്ക്കുന്ന തുക, ഉദാഹരണത്തിന് അഞ്ഞൂറ് ദിർഹം. നാല്പതിനായിരം കിലോമീറ്റർ സർവീസ്.",
]


def key():
    k = tts.env_file("elevenlabs.env", ["ELEVENLABS_API_KEY"])["ELEVENLABS_API_KEY"]
    if not k:
        sys.exit("Put ELEVENLABS_API_KEY=... in scripts/videos/elevenlabs.env first")
    return k


def get(url):
    req = urllib.request.Request(url, headers={"xi-api-key": key()})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def voices():
    mine = get("https://api.elevenlabs.io/v2/voices?page_size=100").get("voices", [])
    print("Voices in your account:")
    for v in mine:
        print(f"  {v['voice_id']}  {v.get('name')}  ({v.get('category')}, {(v.get('labels') or {}).get('gender', '')})")
    try:
        shared = get("https://api.elevenlabs.io/v1/shared-voices?language=ml&page_size=30").get("voices", [])
    except Exception as e:  # the library listing is a nicety; the account's own voices are what matter
        shared = []
        print(f"(could not list the Malayalam voice library: {e})")
    if shared:
        print("\nMalayalam voices in the ElevenLabs library (add one to your account in the website to use it):")
        for v in shared:
            print(f"  {v['voice_id']}  {v.get('name')}  ({v.get('gender', '')}, {v.get('accent', '')}) {v.get('description', '')[:60]}")


def save(path, pcm):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(tts.RATE)
        w.writeframes(pcm)
    print("made", path, round(len(pcm) / 2 / tts.RATE, 1), "s")


def speak(ids):
    out = here / "samples"
    out.mkdir(exist_ok=True)
    gap = b"\x00\x00" * int(tts.RATE * 0.4)
    save(out / "eleven-current.wav", gap.join(tts.speak("ml", c) for c in CARDS))  # today's voice, for comparison
    for vid in ids:
        tts.VOICE_ML = f"elevenlabs:{vid}"
        save(out / f"eleven-{vid}.wav", gap.join(tts.speak("ml", c) for c in CARDS))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) >= 2 and sys.argv[1] == "voices":
        voices()
    elif len(sys.argv) >= 3 and sys.argv[1] == "speak":
        speak(sys.argv[2:])
    else:
        print(__doc__)
