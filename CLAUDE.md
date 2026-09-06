# j-voca

일본어 PWA 단어장 앱. 모바일 우선 설계.

## 기술 스택

- React 19 + React Router 7 (HashRouter)
- Vite 6 + Tailwind CSS 4
- IndexedDB (Dexie 4) — words, reviews, reviewLogs 테이블
- ts-fsrs 5 — 간격 반복 복습 알고리즘
- Web Speech API — 일본어 TTS
- PWA (Service Worker + manifest)
- GitHub Pages 배포

## 디렉토리 구조

```
src/
├── components/    # React 컴포넌트 (Dashboard, ReviewSession, FlashCard 등)
├── hooks/         # useBrowseMode 등
├── lib/           # db.js, fsrs.js, review-utils.js, lesson-utils.js(step/chapter 헬퍼) 등 유틸리티
│   └── __tests__/ # Vitest 테스트
├── styles/        # Tailwind CSS
├── main.jsx       # 엔트리 + 버전 체크
└── App.jsx        # 라우팅 + Lazy loading
public/
├── data/words.json  # 단어 데이터 (정적 파일)
├── sw.js            # Service Worker
└── manifest.json    # PWA 설정
```

## 명령어

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run test       # Vitest 테스트
```

## 개발 워크플로우

- 기능 개발은 `feature/{기능요약}` 브랜치에서 진행하고, 빌드/테스트/리뷰 통과 후 **PR 없이 main에 직접 머지**한다 (개인 앱이므로 리뷰어 승인 절차 불필요)
- main push 시 GitHub Pages 배포가 자동 실행된다

## 주요 패턴

- Safari dexie-react-hooks 버그로 useLiveQuery 대신 직접 async/await 쿼리 사용
- FSRS 날짜 단위 스케줄링 (밤 12시 기준)
- words.json은 public/ 정적 파일 → 빌드 없이 네트워크 우선 전략으로 최신 데이터 제공
- 단어는 step(교재 단계) > chapter(레슨) 2단계 구조. step 2부터 chapter가 1부터 다시 시작하므로 레슨 식별은 (step, chapter) 복합 키. step 누락 시 1로 간주 (`getStep()`)
- words.json 정합성은 `src/lib/__tests__/words-data.test.js`가 검증 (모든 단어에 step/chapter 양의 정수, id 유일). 데이터만 바꿔도 `npm run test`로 확인
- Gemini 모델은 사용자가 고르지 않고 `gemini.js`의 MODEL_CHAIN 순서(3.5-flash-lite → 3.8-flash → 2.5-flash)로 503/404/429 시 자동 대체. 프롬프트는 교재 하단 '단어' 칸 항목과 손글씨(단어·문장, 손글씨 뜻이 붙은 인쇄 표현)만 추출하도록 설계. 예문·회화문의 인쇄 단어는 제외
- 예문은 words.json 과 분리된 `public/data/sentences.json`(Dexie `sentences` 테이블, PK `[wordId+date]`)에 두고 앱은 읽기만 한다. `.github/workflows/generate-sentences.yml`이 매일 KST 07시에 `scripts/generate-sentences.mjs`로 최신 레슨(step ≥ 2) 단어에 단어당 최대 7개까지 Gemini 로 생성해 커밋한다
- 예문의 목표 단어 강조는 문자열 검색이 아니라 생성 시 `sentence`·`reading` 양쪽에 넣은 `[[ ]]` 표식을 `parseHighlight()`로 풀어 그린다. 후리가나는 쓰지 않고 가나 읽기 줄을 따로 둔다. 순수 함수는 `src/lib/sentence-utils.js`(브라우저·Node 공용)
- version.json 폴링으로 앱 업데이트 감지
- base path: `/j-voca/`
