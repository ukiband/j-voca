"""Regression tests for source descriptions that are not ready-made glosses.

Run: python3 -m unittest discover -s scripts/tests
The small source fixtures need no network or third-party Python packages.
"""
from contextlib import redirect_stdout
import gzip
import importlib.util
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('builder', Path(__file__).parents[1] / 'build-kanji-data.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class KoreanGlossTests(unittest.TestCase):
    def gloss(self, text, character, readings=(), candidates=(), overrides=None):
        return builder.korean_glosses(character, list(readings), candidates,
                                     builder.parse_hanja(text), overrides or {})

    def test_actual_description_after_variant_note(self):
        self.assertEqual(self.gloss('자:姉:姊의 俗字, 손윗누이 자', '姉', ['자']), ['손윗누이 자'])

    def test_variant_references_resolve_recursively(self):
        source = '철:鉄:鐡의 古字\n철:鐡:鐵과 同字\n철:鐵:쇠 철'
        self.assertEqual(self.gloss(source, '鉄', ['철']), ['쇠 철'])

    def test_cycles_and_unresolved_notes_do_not_become_glosses(self):
        source = '안:顔:顏과 同字\n안:顏:顔의 俗字'
        self.assertEqual(self.gloss(source, '顔', ['안']), [])
        self.assertEqual(self.gloss('안:顏:顏과 同字', '顏', ['안']), [])

    def test_missing_sounds_and_commas_without_spaces(self):
        self.assertEqual(self.gloss('강:強:강할', '強', ['강']), ['강할 강'])
        self.assertEqual(self.gloss('앙:昂:밝을,높을', '昂', ['앙']), ['밝을 앙'])
        self.assertEqual(self.gloss('당:糖:엿 당', '糖', ['당']), ['엿 당'])

    def test_variant_with_a_different_korean_sound_is_rejected(self):
        source = '분:体:용렬할 분\n체:體:몸 체'
        self.assertEqual(self.gloss(source, '体', ['체'], ['體']), ['몸 체'])
        self.assertEqual(self.gloss('두:亠:의미없는 토', '亠', ['두']), [])

    def test_compatibility_ideographs_do_not_override_exact_source_rows(self):
        source = '록:錄:적을 록\n록:錄:기록할 록'
        self.assertEqual(self.gloss(source, '錄', ['록']), ['기록할 록'])
        self.assertEqual(self.gloss('록:錄:기록할 록', '錄', ['록']), ['기록할 록'])

    def test_corrections_reach_variants_and_keep_sound_filtering(self):
        overrides = {'準': ['준할 준']}
        self.assertEqual(self.gloss('준:準:수준기 준', '凖', ['준'], ['準'], overrides), ['준할 준'])
        self.assertEqual(self.gloss('', '凖', ['절'], ['準'], overrides), [])

    def test_reviewed_corrections_win_over_upstream_typos(self):
        overrides = builder.load_overrides()
        self.assertEqual(self.gloss('비:備:깆출 비, 갖출 비', '備', ['비'], overrides=overrides), ['갖출 비'])
        self.assertEqual(self.gloss('답:答:젖을 답, 대답 답', '答', ['답'], overrides=overrides), ['대답 답'])


class BuildTests(unittest.TestCase):
    def test_source_comparison_is_read_only_and_detects_tampering(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'public/data/kanji'
            output.parent.mkdir(parents=True)
            for file in ['words', 'sentences']:
                (output.parent / f'{file}.json').write_text('[]', encoding='utf-8')
            # A semantic relative's meaning must not be copied into 冑.
            (root / 'hanja.txt').write_text('강:強:강할\n주:胄:후사 주', encoding='utf-8')
            (root / 'kanjidic.gz').write_bytes(gzip.compress('''<kanjidic2>
                <header><date_of_creation>2026-10-09</date_of_creation></header>
                <character><literal>強</literal><reading_meaning><rmgroup>
                  <reading r_type="korean_h">강</reading><reading r_type="ja_on">キョウ</reading>
                  <reading r_type="ja_kun">つよ.い</reading><meaning>strong</meaning>
                </rmgroup></reading_meaning></character>
                <character><literal>冑</literal><reading_meaning><rmgroup>
                  <reading r_type="korean_h">주</reading><meaning>helmet</meaning>
                </rmgroup></reading_meaning></character>
                </kanjidic2>'''.encode()))
            (root / 'kanjivg.gz').write_bytes(gzip.compress('''<kanjivg>
                <kanji id="kvg:kanji_05f37"><g><path d="M1 1L2 2" /></g></kanji>
                <kanji id="kvg:kanji_05191"><g><path d="M3 3L4 4" /></g></kanji>
                </kanjivg>'''.encode()))
            with zipfile.ZipFile(root / 'unihan.zip', 'w') as archive:
                archive.writestr('Unihan_Variants.txt', 'U+5191\tkSemanticVariant\tU+80C4\n')
            args = SimpleNamespace(hanja=root / 'hanja.txt', kanjidic=root / 'kanjidic.gz',
                                   kanjivg=root / 'kanjivg.gz', unihan=root / 'unihan.zip',
                                   output=output, check=False)
            with patch.object(builder, 'ROOT', root), patch.object(builder, 'load_overrides', return_value={}), redirect_stdout(io.StringIO()):
                builder.build(args)
                entry = json.loads((output / '05f.json').read_text())['強']
                self.assertEqual(entry, {'meaningsKo': ['강할 강'], 'meaningsEn': ['strong'],
                                         'on': ['キョウ'], 'kun': ['つよ.い'], 'strokes': ['M1 1L2 2']})
                self.assertEqual(json.loads((output / '051.json').read_text())['冑']['meaningsKo'], [])
                args.check = True
                before = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in output.iterdir()}
                builder.build(args)
                self.assertEqual(before, {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in output.iterdir()})
                (output / '05f.json').write_text('{}')
                with self.assertRaisesRegex(SystemExit, '05f.json'):
                    builder.build(args)
                self.assertEqual((output / '05f.json').read_text(), '{}')


if __name__ == '__main__':
    unittest.main()
