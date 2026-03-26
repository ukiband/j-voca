---
name: develop
description: "j-voca 기능 개발 전체 파이프라인을 자동 실행하는 오케스트레이터. Jira 이슈번호 또는 기능 설명을 받아 요구사항 분석 → 계획 수립 → 사용자 승인 → 구현 → 빌드/테스트 → 코드리뷰 → PR 생성까지 수행한다. '개발해줘', '구현해줘', '기능 추가', 'JVOCA-숫자', 이슈번호를 언급하면 반드시 이 스킬을 사용할 것."
---

# j-voca Develop Orchestrator

j-voca 프로젝트의 기능 개발 파이프라인을 자동 실행하는 오케스트레이터.
CLAUDE.md의 AI 개발 워크플로우(0~5단계)를 에이전트 팀으로 자동화한다.

## 실행 모드: 서브 에이전트 (순차 파이프라인 + 생성-검증 루프)

## 에이전트 구성

| 에이전트 | subagent_type | 역할 | 출력 |
|---------|--------------|------|------|
| analyst | Explore | 요구사항 + 코드베이스 분석 | 분석 보고서 |
| coder | general-purpose | 코드 구현 + 빌드/테스트 | 커밋된 코드 |
| reviewer | general-purpose | 코드리뷰 + 품질 검증 | 리뷰 결과 (PASS/FAIL) |

## 워크플로우

### Phase 0: 프로젝트 환경 확인

1. 프로젝트 루트에 `CLAUDE.md`가 있는지 확인한다
2. 없으면 코드베이스를 탐색하여 자동 생성한다

### Phase 1: 입력 분석

사용자 입력을 파싱한다:

- **Jira 이슈번호** (예: `JVOCA-123`): Jira에서 이슈를 읽어 기술 스펙을 추출한다
- **텍스트 설명** (예: `"동사 퀴즈 추가"`): 그대로 요구사항으로 사용한다

### Phase 2: 요구사항 분석 (analyst 에이전트)

analyst 에이전트를 호출한다:

```
Agent(
  subagent_type: "Explore",
  prompt: ".claude/agents/analyst.md의 역할과 원칙을 따른다.

    [요구사항]: {Phase 1에서 파악한 요구사항}

    프로젝트 루트: /Users/ukiband/develop/workspaces/my_workspace/j-voca
    분석 보고서를 출력 형식에 맞게 작성하라."
)
```

analyst의 분석 보고서에 "불명확한 부분"이 있으면, 사용자에게 질문하여 해소한다.

### Phase 3: 계획 수립 + 사용자 승인

analyst의 분석 보고서를 바탕으로 계획을 수립한다:

1. **수정 대상 파일 목록** 작성
2. **PR 분리 단위** 결정 (CLAUDE.md 기준):
   - 소규모 (파일 5개 이하): PR 1개
   - 중규모 (파일 6~15개): 기능별 2~3개 PR
   - 대규모 (파일 15개 이상): 레이어별/모듈별 분리
3. **브랜치 명명**:
   - Jira 있는 경우: `feature/{이슈번호}-{기능요약}`
   - Jira 없는 경우: `feature/{기능요약}`
4. PR이 2개 이상이면 의존관계와 머지 순서를 명시한다

**사용자에게 계획을 제시하고 승인을 받는다.** 승인 없이 구현에 진입하지 않는다.

Jira 이슈가 있는 경우, 승인 후 Jira에 계획을 댓글로 기록한다.

### Phase 4: 구현 (coder 에이전트) — PR 단위별 반복

승인된 PR 단위별로 다음을 반복한다:

1. 브랜치를 생성한다 (main에서 분기)
2. coder 에이전트를 호출한다:

```
Agent(
  subagent_type: "general-purpose",
  prompt: ".claude/agents/coder.md의 역할과 원칙을 따른다.

    [분석 보고서]: {analyst 출력}
    [승인된 계획]: {Phase 3 계획}
    [현재 PR 단위]: {N번째 PR — 수정 파일 목록}

    코드를 구현하고, npm run build와 npm run test를 통과시켜라.
    실패 시 수정 후 재시도하라."
)
```

3. coder가 완료하면 빌드/테스트 통과 여부를 확인한다

### Phase 5: 코드리뷰 + 수정 루프

reviewer 에이전트를 호출한다:

```
Agent(
  subagent_type: "general-purpose",
  prompt: ".claude/agents/reviewer.md의 역할과 원칙을 따른다.

    [수정된 파일 목록]: {coder가 수정한 파일들}

    코드를 직접 읽고 리뷰 결과를 출력 형식에 맞게 작성하라."
)
```

**리뷰 결과에 따라 분기:**

- **PASS**: Phase 6으로 진행
- **FAIL**: coder 에이전트를 재호출하여 이슈를 수정한다. 수정 후 reviewer를 다시 호출한다. **PASS가 나올 때까지 반복한다. 최대 3회.**
  - 3회 반복 후에도 FAIL이면 사용자에게 알리고 수동 개입을 요청한다.

```
[coder 구현] → [reviewer 리뷰] → FAIL → [coder 수정] → [reviewer 재리뷰] → ... → PASS
```

### Phase 6: PR 생성 + 기록

1. 변경사항을 원격에 push한다
2. `gh pr create`로 PR을 생성한다:
   - 제목: 기능 요약 (70자 이내)
   - 본문: 변경 요약 + 테스트 계획
3. Jira 이슈가 있는 경우, PR 링크를 Jira에 댓글로 기록한다
4. 사용자에게 PR URL을 보고한다

## 데이터 흐름

```
[사용자 입력] → Phase 1: 파싱
                    ↓
              Phase 2: [analyst] → 분석 보고서
                    ↓
              Phase 3: 계획 수립 → 사용자 승인
                    ↓
              Phase 4: [coder] → 구현 + 빌드/테스트
                    ↓
              Phase 5: [reviewer] → PASS? ──No──→ [coder 수정] → [reviewer 재리뷰]
                    │                                                    │
                    Yes                                                  │
                    ↓                                              (최대 3회)
              Phase 6: PR 생성 + Jira 기록
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| Jira 이슈 읽기 실패 | 사용자에게 이슈 내용을 직접 입력받는다 |
| analyst 실패 | 1회 재시도. 재실패 시 오케스트레이터가 직접 코드를 분석한다 |
| 빌드/테스트 실패 | coder가 최대 3회 수정 시도. 실패 시 사용자에게 알린다 |
| 리뷰 루프 3회 초과 | 사용자에게 알리고 수동 개입을 요청한다 |
| PR 생성 실패 | 에러 메시지를 사용자에게 보여주고 수동 생성을 안내한다 |

## 테스트 시나리오

### 정상 흐름 (Jira 기반)
1. 사용자: `/develop JVOCA-42`
2. Phase 1: Jira에서 이슈 읽기 → "플래시카드에 예문 표시 기능 추가"
3. Phase 2: analyst가 FlashCard.jsx, words.json 구조 분석
4. Phase 3: 계획 제시 → 사용자 승인 → Jira 댓글
5. Phase 4: coder가 구현 → 빌드/테스트 통과
6. Phase 5: reviewer PASS
7. Phase 6: PR 생성 → Jira에 PR 링크

### 정상 흐름 (텍스트 기반)
1. 사용자: `/develop "레슨별 진도율 표시"`
2. Phase 1: 텍스트에서 요구사항 파악
3. Phase 2~6: 동일 (Jira 댓글 생략)

### 에러 흐름
1. Phase 5에서 reviewer가 FAIL (HIGH: IndexedDB 타입 불일치)
2. coder 재호출 → 수정 → reviewer 재리뷰
3. 2회차에서 PASS → Phase 6 진행
