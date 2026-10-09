# 한자 데이터

이 디렉터리는 `scripts/build-kanji-data.py`가 만드는 정적 사전입니다. 총 6,417자이며, 문자 코드의 상위 바이트로 나눈 87개 파일을 필요할 때만 불러옵니다. 예를 들어 `待`(U+5F85)는 `05f.json`에 들어 있습니다. 현재 단어·예문 481자의 한국어 뜻과 획순을 테스트로 확인합니다.

## 출처와 이용 조건

- **획순:** [KanjiVG r20260714](https://github.com/KanjiVG/kanjivg/releases/tag/r20260714), Copyright © 2009–2013 Ulrich Apel and contributors. [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). 원본 순서와 SVG 경로를 유지하고 JSON으로 추출했습니다. 일본 한자의 획순이며 중국어 간체자 획순을 대신 사용하지 않습니다.
- **일본어 읽기·영어 뜻·자형 대응:** [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project), 2026-10-09판. Copyright © Electronic Dictionary Research and Development Group. [CC BY-SA 4.0 / EDRDG 이용 조건](https://www.edrdg.org/edrdg/licence.html). 읽기, 의미, 문자 코드 및 이체자 대응만 사용하며 SKIP 코드는 사용하지 않습니다.
- **한국어 훈음:** [libhangul hanja.txt](https://github.com/libhangul/libhangul/blob/main/data/hanja/hanja.txt), Copyright © 2005, 2006 Choe Hwanjin. 데이터 파일 자체의 BSD 3-Clause 조건을 따릅니다(라이브러리 코드의 LGPL과 구분). 원문 고지 전문은 [NOTICE.txt](NOTICE.txt)에 포함되어 있습니다.
- **이체자 대응 보완:** [Unicode Unihan 17.0.0](https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip), Unicode License V3. [NOTICE.txt](NOTICE.txt)에 이용 조건을 포함했습니다.

한국어 훈음은 KANJIDIC2의 한국어 음과 일치하는 항목을 고릅니다. 신자체에 뜻이 없으면 사전에 기록된 이체자를 찾습니다. `体`를 ‘용렬할 분’으로 잘못 표시하지 않도록 한국어 음으로 구분합니다. 일부 일본 고유 한자와 별도 뜻은 생성 스크립트의 `KOREAN_OVERRIDES`에서 보완합니다. 보완한 한국어 짧은 뜻과 이 결합 데이터베이스는 CC BY-SA 4.0으로 제공합니다. 원본별 저작권과 이용 조건은 유지됩니다.

드문 한자 중 한국어 훈음이 없는 항목은 사전의 영어 뜻을 ‘뜻 (영어)’로 구분해서 표시합니다. 획순 데이터가 없는 문자는 조회 불가 안내를 표시합니다. 공개 API 호출이나 API 키 없이 동작하며, 한 번 받아 둔 묶음은 기존 PWA 캐시로 오프라인에서도 사용할 수 있습니다.

## 다시 만들기

원본은 아래 주소에서 받습니다. 각 입력 파일의 SHA-256과 사전 날짜는 [sources.json](sources.json)에 기록합니다. 갱신되는 사전 파일은 버전과 해시를 확인하고 데이터 검사를 다시 실행해야 합니다.

```sh
curl -L --fail https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714.xml.gz -o /tmp/kanjivg.xml.gz
curl -L --fail https://www.edrdg.org/kanjidic/kanjidic2.xml.gz -o /tmp/kanjidic2.xml.gz
curl -L --fail https://raw.githubusercontent.com/libhangul/libhangul/main/data/hanja/hanja.txt -o /tmp/hanja.txt
curl -L --fail https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip -o /tmp/Unihan.zip
python3 scripts/build-kanji-data.py --kanjivg /tmp/kanjivg.xml.gz --kanjidic /tmp/kanjidic2.xml.gz --hanja /tmp/hanja.txt --unihan /tmp/Unihan.zip
npm test
```

일반 앱 빌드는 이 생성 작업이나 외부 데이터 다운로드를 실행하지 않습니다.
