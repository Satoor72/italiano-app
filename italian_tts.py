#!/usr/bin/env python3
"""
Generate natural-sounding Italian audio files (mp3) from a list of words/phrases.

Install:   pip install edge-tts
Usage:     python italian_tts.py words.txt
           python italian_tts.py "Buongiorno" "Come stai?" "Gnocchi"
Options:   --voice it-IT-IsabellaNeural   (or it-IT-ElsaNeural, it-IT-DiegoNeural)
           --rate=-10%                    (slower = clearer for learners)
           --out audio                    (output folder)

Output:    audio/<slug>.mp3  + audio/index.json (word -> file mapping)
Your app just plays the mp3 with QMediaPlayer. No internet needed at runtime.
"""
import argparse
import asyncio
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

import edge_tts


def slugify(text: str) -> str:
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s).strip("_").lower()
    h = hashlib.md5(text.encode("utf-8")).hexdigest()[:6]
    return f"{s[:40] or 'item'}_{h}"


async def synth(text: str, path: Path, voice: str, rate: str, sem: asyncio.Semaphore):
    async with sem:
        for attempt in range(3):
            try:
                # Trailing period gives the sentence a natural falling intonation
                t = text if text.endswith((".", "?", "!")) else text + "."
                await edge_tts.Communicate(t, voice, rate=rate).save(str(path))
                return True
            except Exception as e:  # network hiccup -> retry
                if attempt == 2:
                    print(f"FAILED: {text} ({e})", file=sys.stderr)
                    return False
                await asyncio.sleep(1.5)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="a .txt file (one item per line) or words/phrases")
    ap.add_argument("--voice", default="it-IT-ElsaNeural")
    ap.add_argument("--rate", default="-10%")
    ap.add_argument("--out", default="audio")
    args = ap.parse_args()

    items = []
    if len(args.inputs) == 1 and Path(args.inputs[0]).is_file():
        items = [l.strip() for l in Path(args.inputs[0]).read_text(encoding="utf-8").splitlines() if l.strip()]
    else:
        items = args.inputs

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    index_path = out / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}

    sem = asyncio.Semaphore(5)
    tasks, todo = [], []
    for text in items:
        fname = f"{slugify(text)}.mp3"
        index[text] = fname
        if (out / fname).exists():
            continue  # already generated
        todo.append(text)
        tasks.append(synth(text, out / fname, args.voice, args.rate, sem))

    results = await asyncio.gather(*tasks)
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done: {sum(bool(r) for r in results)}/{len(todo)} new, {len(items) - len(todo)} cached -> {out}/")


if __name__ == "__main__":
    asyncio.run(main())
