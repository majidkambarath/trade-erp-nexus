import sys, time, torch, soundfile as sf
sys.stdout.reconfigure(encoding="utf-8")
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer
t0 = time.time()
name = "ai4bharat/indic-parler-tts"
model = ParlerTTSForConditionalGeneration.from_pretrained(name)
tok = AutoTokenizer.from_pretrained(name)
dtok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
print("loaded", round(time.time() - t0), "s")
text = "ഒരു കസ്റ്റമറെ ചേർക്കാൻ ആഡ് കസ്റ്റമർ അമർത്തുക. ഇൻവോയ്സ് അപ്രൂവ് ചെയ്യുമ്പോൾ സ്റ്റോക്ക് കുറയും."
for who in ("Anjali", "Harish"):
    desc = f"{who}'s voice is clear and calm, speaking at a moderate pace and moderate pitch, in a close-sounding recording with no background noise."
    t1 = time.time()
    ids = dtok(desc, return_tensors="pt"); prompt = tok(text, return_tensors="pt")
    with torch.no_grad():
        gen = model.generate(input_ids=ids.input_ids, attention_mask=ids.attention_mask, prompt_input_ids=prompt.input_ids, prompt_attention_mask=prompt.attention_mask)
    audio = gen.cpu().numpy().squeeze()
    dur = len(audio) / model.config.sampling_rate
    sf.write(f"samples/parler-{who.lower()}.wav", audio, model.config.sampling_rate)
    print(who, "audio", round(dur, 1), "s, took", round(time.time() - t1), "s")
