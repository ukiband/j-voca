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
├── lib/           # db.js, fsrs.js, review-utils.js 등 유틸리티
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

## 주요 패턴

- Safari dexie-react-hooks 버그로 useLiveQuery 대신 직접 async/await 쿼리 사용
- FSRS 날짜 단위 스케줄링 (밤 12시 기준)
- words.json은 public/ 정적 파일 → 빌드 없이 네트워크 우선 전략으로 최신 데이터 제공
- version.json 폴링으로 앱 업데이트 감지
- base path: `/j-voca/`
