# 한자 데이터

이 디렉터리는 `scripts/build-kanji-data.py`로 한 번 생성해 저장한 정적 사전입니다. 총 6,417자이며, 문자 코드의 상위 바이트로 나눈 87개 파일을 필요할 때만 불러옵니다. 예를 들어 `待`(U+5F85)는 `05f.json`에 들어 있습니다. 단어·예문이 추가되어도 한자 사전은 자동 생성·변경되지 않습니다. `Generate and check sentences`는 예문만 다루므로 한자용 정기 GitHub Action은 두지 않습니다.

전체 사전의 형식·훈음·출처 기록과 현재 단어·예문 481자의 한국어 뜻·획순을 테스트로 확인합니다. 한국어 훈음은 5,868자에 있습니다.

## 출처와 이용 조건

- **획순:** [KanjiVG r20260714](https://github.com/KanjiVG/kanjivg/releases/tag/r20260714), Copyright © 2009–2013 Ulrich Apel and contributors. [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). 원본 순서와 SVG 경로를 유지하고 JSON으로 추출했습니다. 일본 한자의 획순이며 중국어 간체자 획순을 대신 사용하지 않습니다.
- **일본어 읽기·영어 뜻·자형 대응:** [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project), 2026-10-09판. Copyright © Electronic Dictionary Research and Development Group. [CC BY-SA 4.0 / EDRDG 이용 조건](https://www.edrdg.org/edrdg/licence.html). 읽기, 의미, 문자 코드 및 이체자 대응만 사용하며 SKIP 코드는 사용하지 않습니다.
- **한국어 훈음:** [libhangul hanja.txt](https://github.com/libhangul/libhangul/blob/main/data/hanja/hanja.txt), Copyright © 2005, 2006 Choe Hwanjin. 데이터 파일 자체의 BSD 3-Clause 조건을 따릅니다(라이브러리 코드의 LGPL과 구분). 원문 고지 전문은 [NOTICE.txt](NOTICE.txt)에 포함되어 있습니다.
- **이체자 대응 보완:** [Unicode Unihan 17.0.0](https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip), Unicode License V3. [NOTICE.txt](NOTICE.txt)에 이용 조건을 포함했습니다.

한국어 훈음은 KANJIDIC2의 한국어 음과 일치하는 항목을 고릅니다. 신자체에 뜻이 없으면 사전에 기록된 자형 대응을 찾습니다. `体`를 ‘용렬할 분’으로 잘못 표시하지 않도록 한국어 음으로 구분합니다. libhangul의 `同字`·`俗字` 같은 메모는 풀이로 표시하지 않고 실제 훈음을 찾으며, `강:強:강할`처럼 음이 생략된 설명은 원본의 독음으로 보완합니다. 참조가 순환하거나 올바른 풀이를 찾지 못하면 한국어 뜻을 추측하지 않습니다.

Unihan의 `kSemanticVariant`는 한국어 대표 훈음이 같은 자형이라는 보장이 없어 자동 대응에 사용하지 않습니다. 실제로 `冑`(투구 주)에 `胄`(후사 주)의 풀이가 붙어 있었습니다. 필요한 대응은 글자별로 검토한 [한국어 보정 사전](../../../scripts/kanji-korean-overrides.json)에 기록합니다. 이 파일에는 원본 오타, 대표 뜻의 선택, 일본 신자체·국자 및 한국어 음 누락의 보정 이유도 구분되어 있습니다. 보정은 해당 글자뿐 아니라 그 글자를 참조하는 이체자에도 적용됩니다.

보완한 한국어 짧은 뜻과 이 결합 데이터베이스는 CC BY-SA 4.0으로 제공합니다. 원본별 저작권과 이용 조건은 유지됩니다.

한국어 훈음이 미수록된 549자는 영어 뜻이 있으면 ‘뜻 (영어)’로 구분해서 표시합니다. 영어 뜻도 없는 부수 `𠆢`·`𦥑`는 글자 자체를 표시합니다. 획순 데이터가 없는 문자는 조회 불가 안내를 표시합니다. 공개 API 호출이나 API 키 없이 동작하며, 한 번 받아 둔 묶음은 기존 PWA 캐시로 오프라인에서도 사용할 수 있습니다. 온라인에서는 묶음을 다시 요청할 때 새 데이터를 우선 사용합니다.

## 2026-10-09 전체 점검

6,417자의 한국어 풀이를 검토하고 일본어 읽기·영어 뜻·획 경로를 원본과 대조했습니다. 기존 생성에 사용된 원본 4개의 SHA-256이 모두 같음을 확인한 뒤 재생성하여, 원본 갱신에 따른 변경과 훈음 보정이 섞이지 않게 했습니다.

- **455자 보정:** 오타, 음 누락, 자형 설명 노출, 부적절한 이체자 대응 및 대표 뜻 선택을 수정했습니다. 이 중 23자는 한국어 훈음을 새로 보완했습니다. 모든 변경이 오타 수정인 것은 아니며, 유효하지만 드문 뜻을 대표 뜻으로 교체한 경우도 포함합니다.
- **현재 학습 콘텐츠:** 481자 중 36자의 훈음이 바뀌었고, 전체 481자의 한국어 훈음·획순이 모두 있습니다.
- **일본어 읽기·영어 뜻·획순:** 6,417자 모두 입력 사전과 일치하며 변경하지 않았습니다. 화면의 획수는 일본어 KanjiVG의 실제 획 경로 수입니다. 한국 한자나 다른 자형의 사전 획수와 다를 수 있습니다.
- **재발 방지:** 전체 파일에 훈음 형식·읽기 형식·파일 구분·출처 해시 검사를 적용하고, 원본 추출기의 이체자 참조·음 누락·오타 보정·읽기 구분에 회귀 테스트를 추가했습니다. `--check`는 파일을 쓰지 않고 원본으로 다시 계산한 결과와 배포 파일 전체를 비교합니다.

| 글자 | 점검 전 | 점검 후 |
| --- | --- | --- |
| 備 | 깆출 비 | 갖출 비 |
| 準 | 수준기 준 | 준할 준 |
| 強 | 강할 | 강할 강 |
| 答 | 젖을 답 | 대답 답 |
| 景 | 별 경 | 볕 경 |
| 姉 | 姊의 俗字 | 손윗누이 자 |
| 鉄 | 鐵의 古字 | 쇠 철 |
| 顔 | 顏과 同字 | 얼굴 안 |
| 冑 | 후사 주 | 투구 주 |
| 金 | 성 금 · 사람의 성 김 | 쇠 금 · 성 김 |

검토에는 libhangul의 생략되었던 후속 풀이와 KANJIDIC2의 일본어 의미를 함께 사용했습니다. 예를 들어 원문에 `비:備:깆출 비, 갖출 비`, `경:景:별 경, 볕 경`이 있지만 이전 추출기는 쉼표 앞 풀이만 사용했습니다. 외부 교차 확인 자료로 [국립국어원 준비성의 한자 정보](https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=76755)(備 ‘갖출 비’, 準 ‘법도 준’), [準의 대표 훈음과 용례](https://hanja.wordrow.kr/한자/準/)(‘준할 준’), [국립국어원 마비시키다의 한자 정보](https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=85427)(痺 ‘저릴 비’), [한국학중앙연구원 안강망의 한자 정보](https://encykorea.aks.ac.kr/Article/E0034486)(鱇 ‘아귀 강’), [한자페디아 鰺](https://www.kanjipedia.jp/kanji/0004313700), [Unicode 자형 대응 설명](https://unicode.org/reports/tr38/#Variants)을 참고했습니다. 긴 사전 설명을 복제하지 않고 짧은 훈음과 대응 관계를 보정했습니다.

이 검사는 원본 일치·데이터 구조와 발견한 훈음 문제를 확인하는 절차입니다. 드문 한자의 모든 뜻과 역사적 독음을 새로 편찬하거나 검증했다는 뜻은 아닙니다.

## 다시 만들기

원본은 아래 주소에서 받습니다. 각 입력 파일의 SHA-256, 한국어 보정 사전의 SHA-256과 사전 날짜는 [sources.json](sources.json)에 기록합니다. 갱신되는 사전 파일은 버전과 해시를 확인하고 데이터 검사를 다시 실행해야 합니다. 한국어 보정 파일을 수정했을 때도 재생성합니다.

```sh
curl -L --fail https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714.xml.gz -o /tmp/kanjivg.xml.gz
curl -L --fail https://www.edrdg.org/kanjidic/kanjidic2.xml.gz -o /tmp/kanjidic2.xml.gz
curl -L --fail https://raw.githubusercontent.com/libhangul/libhangul/main/data/hanja/hanja.txt -o /tmp/hanja.txt
curl -L --fail https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip -o /tmp/Unihan.zip
python3 scripts/build-kanji-data.py --kanjivg /tmp/kanjivg.xml.gz --kanjidic /tmp/kanjidic2.xml.gz --hanja /tmp/hanja.txt --unihan /tmp/Unihan.zip
python3 -m unittest discover -s scripts/tests
npm test
python3 scripts/build-kanji-data.py --kanjivg /tmp/kanjivg.xml.gz --kanjidic /tmp/kanjidic2.xml.gz --hanja /tmp/hanja.txt --unihan /tmp/Unihan.zip --check
```

일반 앱 빌드는 이 생성 작업이나 외부 데이터 다운로드를 실행하지 않습니다.
