// Make the walkthrough video of a guide, in English or Malayalam, with no paid tool.
//   GUIDE_PASSWORD=... node scripts/videos/make.mjs <flow id | all> [--lang=en|ml] [--base=http://localhost:5173] [--force]
//   node scripts/videos/make.mjs <flow id | all> --lang=en --revoice      speak again with the current voice (VOICE_EN / VOICE_ML),
//                                                                          reusing the pictures kept in out/_kept: no browser needed
// 1. the walker (scripts/guides/walk.mjs) does the guide on the demo company and takes one picture per card;
// 2. Piper speaks each card (title, then text); a Malayalam line's English on-screen names are spoken by the English voice;
// 3. ffmpeg shows each picture for as long as its card is spoken and joins them into out/<flow>.<lang>.mp4.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=").slice(1).join("=");
const lang = opt("lang", "en");
const base = opt("base", "http://localhost:5173");
if (!which || !["en", "ml"].includes(lang)) { console.error("usage: make.mjs <flow id|all> --lang=en|ml"); process.exit(2); }

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
fs.mkdirSync(out, { recursive: true });
const ffmpeg = process.env.FFMPEG || "ffmpeg";
// the narration runs in the environment that holds Piper AND Parler-TTS (see tts.py), else in the ordinary python
const venvPython = path.join(here, ".venv-parler", "Scripts", "python.exe");
const ttsPython = process.env.TTS_PYTHON || (fs.existsSync(venvPython) ? venvPython : "python");
const run = (cmd, a, o = {}) => { const r = spawnSync(cmd, a, { encoding: "utf8", ...o }); if (r.status !== 0) throw new Error(`${cmd} failed:\n${(r.stderr || "") + (r.stdout || "")}`.slice(-1500)); return r; };

// A narration as voiced segments. Malayalam is spoken ENTIRELY in the one Malayalam voice: every English on-screen name,
// example and abbreviation is said as its Malayalam-script form from ml-speech.json (the screen still shows the English).
// A name missing from that file stops the video, with the name, rather than being spoken wrongly.
const SPEECH = lang === "ml" ? JSON.parse(fs.readFileSync(path.join(here, "ml-speech.json"), "utf8")) : {};
const LATIN = /([A-Za-z][A-Za-z0-9 .'&/-]*[A-Za-z0-9]|[A-Za-z])/g;
const said = (name) => {
  const v = SPEECH[name.trim()];
  if (!v) throw new Error(`ml-speech.json has no Malayalam for "${name.trim()}": add it, then make the video again`);
  return v;
};
function segments(card) {
  const bits = [{ fixed: false, s: `${card.title}. ` }, ...card.parts];
  const segs = [];
  for (const b of bits) {
    if (lang === "en") { segs.push({ v: "en", t: b.s }); continue; }
    if (b.fixed) { segs.push({ v: "ml", t: said(b.s) }); continue; }
    segs.push({ v: "ml", t: b.s.replace(LATIN, (m) => said(m)) });
  }
  return segs;
}

function makeOne(flow, revoice) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `video-${flow}-`));
  // the pictures and card wording of a walk are kept, so a new voice never needs the browser again
  const kept = path.join(out, "_kept", `${flow}.${lang}`);
  const manifest = path.join(kept, "manifest.json");
  if (revoice) {
    if (!fs.existsSync(manifest)) throw new Error(`nothing kept for ${flow} (${lang}): walk it once without --revoice`);
  } else {
    fs.rmSync(kept, { recursive: true, force: true });
    fs.mkdirSync(kept, { recursive: true });
    const walk = spawnSync("node", ["scripts/guides/walk.mjs", flow, `--lang=${lang}`, `--base=${base}`, `--shots=${kept}`, `--manifest=${manifest}`], { encoding: "utf8", timeout: 6 * 60 * 1000 });
    if (walk.status !== 0) throw new Error(`the walk of ${flow} failed:
${walk.stdout.slice(-600)}${walk.stderr}`);
  }
  const cards = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const jobs = cards.map((c, i) => ({ out: path.join(work, `a${i}.wav`), segs: segments(c) }));
  fs.writeFileSync(path.join(work, "jobs.json"), JSON.stringify(jobs), "utf8");
  run(ttsPython, [path.join(here, "tts.py"), path.join(work, "jobs.json")], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });

  // one clip per card: the picture held for its narration plus a breath
  const clips = cards.map((c, i) => {
    const clip = path.join(work, `c${i}.mp4`);
    run(ffmpeg, ["-y", "-loop", "1", "-framerate", "25", "-i", c.shot, "-i", jobs[i].out, "-af", "apad=pad_dur=0.8", "-shortest",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=1280:-2", "-c:a", "aac", "-ar", "44100", clip]);
    return clip;
  });
  fs.writeFileSync(path.join(work, "list.txt"), clips.map((c) => `file '${c.split(path.sep).join("/")}'`).join("\n"));
  const target = path.join(out, `${flow}.${lang}.mp4`);
  run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", path.join(work, "list.txt"), "-c", "copy", target]);
  fs.rmSync(work, { recursive: true, force: true });
  return target;
}

let flows = [which];
if (which === "all") {
  // every guide id named in a group's `ids: [...]` (groups.js), in the order a new client learns them
  const groups = fs.readFileSync("src/guides/groups.js", "utf8");
  flows = [...groups.matchAll(/ids:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]));
}
// Resumable: a video already made is kept unless --force. A failed walk is tried once more (a slow page, a hung
// browser call), then reported and the run goes on to the next guide.
const force = args.includes("--force");
const revoice = args.includes("--revoice");
let failed = 0;
for (const f of flows) {
  if (!force && !revoice && fs.existsSync(path.join(out, `${f}.${lang}.mp4`))) { console.log("kept", f); continue; }
  let done = false;
  for (let attempt = 1; attempt <= 2 && !done; attempt += 1) {
    try { console.log("made", makeOne(f, revoice)); done = true; } catch (e) { if (attempt === 2) { failed += 1; console.error(`FAILED ${f} (${lang}): ${e.message.slice(0, 400)}`); } }
  }
}
process.exit(failed ? 1 : 0);
