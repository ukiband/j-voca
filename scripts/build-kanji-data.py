#!/usr/bin/env python3
"""Build local, lazily loaded kanji data from the four credited source files.

See public/data/kanji/README.md for source URLs and licenses. No API keys or
network requests are needed at runtime. Only SVG path coordinates are retained.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]

# Japanese-created characters and Japanese senses not supplied by hanja.txt.
# These short Korean glosses are maintained by J-VOCA (CC BY-SA 4.0).
KOREAN_OVERRIDES = {
    '働': ['일할 동'],
    '畑': ['밭 전'],
    '峠': ['고개 상'],
    '込': ['들 입'],
    '弁': ['분별할 변', '말씀 변', '꽃잎 판'],
    '机': ['책상 궤'],
    '歩': ['걸을 보'],
    '楽': ['즐거울 락', '풍류 악'],
    '毎': ['매양 매'],
    '青': ['푸를 청'],
}


def build(args):
    hanja = {}
    for line in args.hanja.read_text().splitlines():
        parts = line.split(':', 2)
        if len(parts) != 3 or len(parts[1]) != 1 or not parts[2]:
            continue
        reading, character, meanings = parts
        hanja.setdefault(character, []).append((reading, meanings.split(', ')[0]))

    dictionary = ET.fromstring(gzip.decompress(args.kanjidic.read_bytes()))
    records = {row.findtext('literal'): row for row in dictionary.findall('character')}
    codepoints = {
        (cp.get('cp_type'), cp.text): row.findtext('literal')
        for row in records.values() for cp in row.findall('./codepoint/cp_value')
    }
    variants = {}
    with zipfile.ZipFile(args.unihan) as archive:
        for line in archive.read('Unihan_Variants.txt').decode().splitlines():
            if not line or line.startswith('#'):
                continue
            code, kind, targets = line.split('\t')
            if kind not in ('kTraditionalVariant', 'kSemanticVariant', 'kZVariant'):
                continue
            variants.setdefault(chr(int(code[2:], 16)), []).extend(
                chr(int(target.split('<')[0][2:], 16)) for target in targets.split()
            )

    def meanings_ko(character, row):
        if character in KOREAN_OVERRIDES:
            return KOREAN_OVERRIDES[character]
        korean_readings = {e.text for e in row.findall('./reading_meaning/rmgroup/reading')
                           if e.get('r_type') == 'korean_h'}
        candidates = [character]
        candidates.extend(codepoints.get((v.get('var_type'), v.text))
                          for v in row.findall('./misc/variant'))
        candidates.extend(variants.get(character, []))
        found = []
        for candidate in candidates:
            if not candidate:
                continue
            candidate = unicodedata.normalize('NFKC', candidate)
            for reading, meaning in hanja.get(candidate, []):
                if korean_readings and reading not in korean_readings:
                    continue
                if meaning not in found:
                    found.append(meaning)
            if found:
                break
        return found[:3]

    chunks = {}
    for kanji in ET.fromstring(gzip.decompress(args.kanjivg.read_bytes())):
        match = re.fullmatch(r'kvg:kanji_([0-9a-f]{5})', kanji.get('id', ''))
        if not match:
            continue
        code = int(match[1], 16)
        character = chr(code)
        if character not in records:
            continue
        row = records[character]
        strokes = [p.get('d') for p in kanji.iter('path')]
        if not strokes:
            continue
        readings = row.findall('./reading_meaning/rmgroup/reading')
        entry = {
            'meaningsKo': meanings_ko(character, row),
            'meaningsEn': [e.text for e in row.findall('./reading_meaning/rmgroup/meaning')
                           if not e.get('m_lang')][:3],
            'on': list(dict.fromkeys(e.text for e in readings if e.get('r_type') == 'ja_on')),
            'kun': list(dict.fromkeys(e.text for e in readings if e.get('r_type') == 'ja_kun')),
            'strokes': strokes,
        }
        chunks.setdefault(f'{code >> 8:03x}', {})[character] = entry

    output = ROOT / 'public/data/kanji'
    output.mkdir(parents=True, exist_ok=True)
    for name, entries in sorted(chunks.items()):
        # One record per line keeps diffs reviewable without inflating SVG paths.
        text = '{\n' + ',\n'.join(
            json.dumps(char, ensure_ascii=False) + ':' + json.dumps(entry, ensure_ascii=False, separators=(',', ':'))
            for char, entry in sorted(entries.items())
        ) + '\n}\n'
        (output / f'{name}.json').write_text(text)
    provenance = {
        'kanjivgRelease': 'r20260714',
        'kanjidicDate': dictionary.findtext('./header/date_of_creation'),
        'unicodeVersion': '17.0.0',
        'sourceSha256': {name: hashlib.sha256(getattr(args, name).read_bytes()).hexdigest()
                         for name in ('kanjivg', 'kanjidic', 'hanja', 'unihan')},
        'characters': sum(len(entries) for entries in chunks.values()),
        'chunks': sorted(chunks),
    }
    (output / 'sources.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
    bundled = {c: entry for entries in chunks.values() for c, entry in entries.items()}
    current = set()
    for filename, field in [('words.json', 'word'), ('sentences.json', 'sentence')]:
        data = json.loads((ROOT / 'public/data' / filename).read_text())
        rows = data if isinstance(data, list) else data[filename.removesuffix('.json')]
        for row in rows:
            current.update(c for c in row.get(field, '') if '\u3400' <= c <= '\u9fff')
    print(f'{len(bundled)} kanji in {len(chunks)} chunks; {len(current)} characters in current learning content')
    print('Missing stroke data:', ''.join(sorted(current - bundled.keys())) or 'none')
    print('Missing Korean gloss:', ''.join(sorted(c for c in current if not bundled.get(c, {}).get('meaningsKo'))) or 'none')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('kanjivg', 'kanjidic', 'hanja', 'unihan'):
        parser.add_argument(f'--{name}', type=Path, required=True)
    build(parser.parse_args())
