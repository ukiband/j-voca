# J-VOCA

일본어 교재 사진을 찍으면 단어를 자동 추출하고, 간격 반복(SM-2)으로 복습하는 PWA 단어장.

## 사용법

1. https://ukiband.github.io/j-voca/ 접속
2. 설정에서 Gemini API 키 + GitHub PAT 입력
3. 입력 탭 > 교재 사진 촬영 > 단어 추출 > 저장
4. 복습 탭에서 플래시카드로 복습

iPhone/Android에서 "홈 화면에 추가"하면 앱처럼 사용 가능.

## 주요 기능

- **사진 OCR**: Gemini Vision API로 교재 사진에서 단어 자동 추출
- **간격 반복**: SM-2 알고리즘 기반 복습 스케줄링
- **발음 듣기**: Web Speech API로 일본어 발음 재생
- **GitHub 동기화**: 단어 데이터를 GitHub repo에 자동 커밋
- **PWA**: 오프라인 지원, 홈 화면 설치

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Vite 6 |
| 데이터 | IndexedDB (Dexie), GitHub Contents API |
| AI | Gemini API (Vision) |
| 배포 | GitHub Pages, GitHub Actions |

## 로컬 개발

```bash
npm install
npm run dev -- --host
```

http://localhost:5173/j-voca/ 에서 확인.

## 필요한 키

| 키 | 발급처 |
|---|---|
| Gemini API Key | https://aistudio.google.com/apikey |
| GitHub PAT (Fine-grained) | https://github.com/settings/personal-access-tokens/new |

GitHub PAT에는 해당 repo의 Contents 읽기/쓰기 권한이 필요합니다.

## 설계 결정

### 단어 추출: "교재 메인 표기 그대로" 원칙 (2026-03-19)

**배경**: QA 중 Gemini가 사진에서 한자를 word로 추출하는 문제 발견. 초급 교재는 `おおきい(大きい)` 처럼 히라가나가 메인이고 한자는 괄호 안 보조 표기인데, 기존 프롬프트가 "한자가 있으면 한자 표기"로 지시하고 있어 교재 의도와 반대로 동작.

**결정**: `word` 필드는 교재에서 가장 크게/중심으로 인쇄된 표기를 그대로 추출한다.
- 초급 교재 `おおきい(大きい)` → word: `おおきい`
- 중급 교재 `大きい(おおきい)` → word: `大きい`
- 후리가나 표기 `大きい` → word: `大きい`
- 괄호 안 보조 표기나 후리가나는 word에 넣지 않고 reading 작성 시 참고만

**검토했으나 채택하지 않은 안**:
- `kanji` 필드 추가 + 한자/히라가나 표시 전환 설정 → 교재별로 word가 자연스럽게 나뉘므로 불필요
- Phase 분리 (히라가나 먼저, 한자 나중에) → 교재 중심 원칙으로 통합됨

**근거**: 교재 자체가 학습자 레벨에 맞는 표기를 선택하고 있으므로, 앱이 이를 그대로 따르는 것이 자연스럽다.
