# J-VOCA

일본어 교재 사진을 찍으면 단어를 자동 추출하고, FSRS 알고리즘으로 복습하는 PWA 단어장.

## 사용법

1. https://ukiband.github.io/j-voca/ 접속
2. 설정에서 Gemini API 키 + GitHub PAT 입력
3. 입력 탭 > Step/레슨 확인 > 교재 사진 촬영 > 단어 추출 > 저장
4. 단어 탭에서 플래시카드로 자유 열람 또는 듣기 모드로 암기
5. 복습 탭에서 FSRS 스케줄에 따라 복습 (모름/애매/앎 3단계)

iPhone/Android에서 "홈 화면에 추가"하면 앱처럼 사용 가능.

## 주요 기능

- **사진 OCR**: Gemini Vision API로 교재 사진에서 단어 자동 추출
- **간격 반복**: FSRS (Free Spaced Repetition Scheduler) 알고리즘 기반 날짜 단위 복습 스케줄링
- **3단계 평가**: 모름(Again) / 애매(Hard) / 앎(Good) 직관적 복습 버튼 — "모름" 단어는 같은 세션에서 재출제
- **교재 구조**: 단어를 Step(교재 단계) > Lesson 2단계로 관리. 복습 선택, 단어 목록, 대시보드 진행률을 Step별로 확인
- **플래시카드 열람**: Step/Lesson별 단어를 랜덤 셔플 플래시카드로 자유 탐색
- **듣기 모드**: 일본어 발음 자동 재생 (3초 간격) + Wake Lock으로 화면 꺼짐 방지
- **단어 검색**: 단어, 읽기, 뜻으로 검색
- **오답노트**: 오답률 기반 취약 단어 모아보기 및 집중 연습
- **학습 통계**: 일별 복습 수, 정확도, 연속 학습일(streak) 추이
- **업데이트 알림**: 새 버전 배포 시 앱 내 배너로 안내 + 원터치 업데이트
- **GitHub 동기화**: 단어 데이터를 GitHub repo에 자동 커밋
- **PWA**: 홈 화면 설치, 오프라인에서 기존 데이터 열람/복습 가능

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Vite 6 |
| 데이터 | IndexedDB (Dexie), GitHub Contents API |
| 복습 알고리즘 | FSRS (ts-fsrs) |
| AI | Gemini API (Vision) |
| 배포 | GitHub Pages, GitHub Actions |

## 로컬 개발

```bash
npm install
npm run dev -- --host
```

http://localhost:5173/j-voca/ 에서 확인.

## 테스트

```bash
npm test
```

## 필요한 키

| 키 | 발급처 |
|---|---|
| Gemini API Key | https://aistudio.google.com/apikey |
| GitHub PAT (Fine-grained) | https://github.com/settings/personal-access-tokens/new |

GitHub PAT에는 해당 repo의 Contents 읽기/쓰기 권한이 필요합니다.
