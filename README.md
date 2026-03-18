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
