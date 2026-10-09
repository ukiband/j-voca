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
OVERRIDES_PATH = Path(__file__).with_name('kanji-korean-overrides.json')

HAN = re.compile(r'[\u3400-\u9fff\uf900-\ufaff]')
GLOSS = re.compile(r'[가-힣(][가-힣 ()·/ㆍa-zA-Z-]* [가-힣]')
ALIAS = re.compile(r'([\u3400-\u9fff·]+)(?:의|과|와) (?:同字|俗字|略字|本字|古字|譌字|갖은자)')


def load_overrides():
    overrides = {}
    for group in json.loads(OVERRIDES_PATH.read_text(encoding='utf-8'))['groups']:
        for character, meanings in group['entries'].items():
            if character in overrides:
                raise ValueError(f'Duplicate Korean override: {character}')
            if not meanings or any(not GLOSS.fullmatch(m) for m in meanings):
                raise ValueError(f'Invalid Korean override: {character} {meanings}')
            overrides[character] = meanings
    return overrides


def parse_hanja(text):
    hanja = {}
    for line in text.splitlines():
        parts = line.split(':', 2)
        if len(parts) != 3 or len(parts[1]) != 1 or not parts[2]:
            continue
        reading, character, meanings = parts
        if not re.fullmatch('[가-힣]', reading):
            continue
        hanja.setdefault(character, []).append((reading, re.split(r',\s*', meanings)))
    # Use the exact character's descriptions before compatibility spellings.
    for character, rows in list(hanja.items()):
        normalized = unicodedata.normalize('NFKC', character)
        if normalized != character:
            hanja.setdefault(normalized, []).extend(rows)
    return hanja


def korean_glosses(character, readings, candidates, hanja, overrides):
    """Resolve actual glosses, never display an IME's variant-reference notes.

    Keep Korean-reading matching: Japanese 体 must resolve to 體 (체), not
    the unrelated Korean sense of 体 (분). Explicit overrides also apply to
    referenced traditional characters, so fixes reach their Japanese variants.
    """
    if character in overrides:
        return overrides[character]

    def lookup(candidate, allowed, seen):
        candidate = unicodedata.normalize('NFKC', candidate)
        if candidate in seen:
            return []
        seen = seen | {candidate}
        if candidate in overrides:
            return [m for m in overrides[candidate] if not allowed or m[-1] in allowed]
        rows = hanja.get(candidate, [])
        # Neither hanja.txt nor KANJIDIC's Korean readings rank common senses.
        # Change primary senses only through reviewed, character-specific data.
        found = []
        resolved_readings = set()
        for reading, meanings in rows:
            if (allowed and reading not in allowed) or reading in resolved_readings:
                continue
            gloss = None
            for meaning in meanings:
                if HAN.search(meaning):
                    continue
                meaning = meaning.strip()
                if not meaning:
                    continue
                # Some IME descriptions omit the sound: 강:強:강할.
                if not re.search(r' [가-힣]$', meaning):
                    meaning = f'{meaning} {reading}'
                if GLOSS.fullmatch(meaning) and meaning[-1] == reading:
                    gloss = meaning
                    break
            if gloss:
                found.append(gloss)
                resolved_readings.add(reading)
                continue
            for meaning in meanings:
                alias = ALIAS.fullmatch(meaning)
                if alias:
                    for target in alias[1].split('·'):
                        resolved = lookup(target, [reading], seen)
                        if resolved:
                            found.extend(resolved)
                            resolved_readings.add(reading)
                            break
                if reading in resolved_readings:
                    break
        return list(dict.fromkeys(found))

    for candidate in dict.fromkeys([character, *candidates]):
        if candidate:
            found = lookup(candidate, readings, set())
            if found:
                return found[:3]
    return []


def build(args):
    hanja = parse_hanja(args.hanja.read_text(encoding='utf-8'))
    overrides = load_overrides()

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
            # Semantic variants can share just one sense, e.g. 冑 (helmet)
            # and 胄 (descendants). They are not safe spelling replacements.
            if kind not in ('kTraditionalVariant', 'kZVariant'):
                continue
            variants.setdefault(chr(int(code[2:], 16)), []).extend(
                chr(int(target.split('<')[0][2:], 16)) for target in targets.split()
            )

    def meanings_ko(character, row):
        korean_readings = [e.text for e in row.findall('./reading_meaning/rmgroup/reading')
                           if e.get('r_type') == 'korean_h']
        candidates = []
        candidates.extend(codepoints.get((v.get('var_type'), v.text))
                          for v in row.findall('./misc/variant'))
        candidates.extend(variants.get(character, []))
        return korean_glosses(character, korean_readings, candidates, hanja, overrides)

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

    output = args.output
    files = {}
    for name, entries in sorted(chunks.items()):
        # One record per line keeps diffs reviewable without inflating SVG paths.
        text = '{\n' + ',\n'.join(
            json.dumps(char, ensure_ascii=False) + ':' + json.dumps(entry, ensure_ascii=False, separators=(',', ':'))
            for char, entry in sorted(entries.items())
        ) + '\n}\n'
        files[f'{name}.json'] = text
    provenance = {
        'kanjivgRelease': 'r20260714',
        'kanjidicDate': dictionary.findtext('./header/date_of_creation'),
        'unicodeVersion': '17.0.0',
        'sourceSha256': {name: hashlib.sha256(getattr(args, name).read_bytes()).hexdigest()
                         for name in ('kanjivg', 'kanjidic', 'hanja', 'unihan')},
        'koreanOverridesSha256': hashlib.sha256(OVERRIDES_PATH.read_bytes()).hexdigest(),
        'characters': sum(len(entries) for entries in chunks.values()),
        'chunks': sorted(chunks),
    }
    files['sources.json'] = json.dumps(provenance, ensure_ascii=False, indent=2) + '\n'
    bundled = {c: entry for entries in chunks.values() for c, entry in entries.items()}
    for character, entry in bundled.items():
        if any(not GLOSS.fullmatch(m) for m in entry['meaningsKo']):
            raise ValueError(f'Invalid Korean gloss: {character} {entry["meaningsKo"]}')
    current = set()
    for filename, field in [('words.json', 'word'), ('sentences.json', 'sentence')]:
        data = json.loads((ROOT / 'public/data' / filename).read_text())
        rows = data if isinstance(data, list) else data[filename.removesuffix('.json')]
        for row in rows:
            current.update(c for c in row.get(field, '') if '\u3400' <= c <= '\u9fff')
    print(f'{len(bundled)} kanji in {len(chunks)} chunks; {len(current)} characters in current learning content')
    print('Missing stroke data:', ''.join(sorted(current - bundled.keys())) or 'none')
    print('Missing Korean gloss:', ''.join(sorted(c for c in current if not bundled.get(c, {}).get('meaningsKo'))) or 'none')
    if args.check:
        mismatches = [name for name, text in files.items()
                      if not (output / name).exists() or (output / name).read_text(encoding='utf-8') != text]
        extra = sorted(p.name for p in output.glob('*.json') if p.name not in files)
        if mismatches or extra:
            raise SystemExit(f'Kanji data differs: {", ".join(mismatches + extra)}')
        print('All bundled records and provenance match the source files and reviewed overrides.')
    else:
        output.mkdir(parents=True, exist_ok=True)
        for name, text in files.items():
            (output / name).write_text(text, encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('kanjivg', 'kanjidic', 'hanja', 'unihan'):
        parser.add_argument(f'--{name}', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/kanji')
    parser.add_argument('--check', action='store_true', help='Verify all generated files without writing')
    build(parser.parse_args())
