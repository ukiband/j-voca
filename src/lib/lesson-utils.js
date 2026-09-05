/**
 * step(교재 단계) > chapter(레슨) 2단계 구조를 다루는 헬퍼 모음.
 *
 * step 2부터 chapter 번호가 1부터 다시 시작하므로, 레슨을 식별할 때는
 * 반드시 (step, chapter) 쌍을 함께 써야 한다. chapter 값만으로 그룹핑하면
 * "Step 1 Lesson 3"과 "Step 2 Lesson 3"이 섞인다.
 */

/**
 * 단어의 step을 반환한다. step 필드가 없는 단어는 step 1로 간주한다.
 * 이유: step 도입 전 데이터(오프라인 캐시에 남은 구버전 words.json 등)는
 * step 필드가 없고, 그 단어들은 모두 step 1 교재 것이기 때문이다.
 */
export function getStep(word) {
  return word?.step ?? 1;
}

/** (step, chapter)를 객체/Map 키용 문자열로 합친다. 예: "2-3" */
export function lessonKey(step, chapter) {
  return `${step}-${chapter}`;
}

/**
 * 단어가 (step, chapter) 레슨에 속하는지 판단한다.
 * 중복 제거·레슨 삭제처럼 데이터 손실과 직결되는 비교에 공통으로 쓴다.
 * - 단어의 step이 없으면 1로 간주한다 (getStep 규칙과 동일)
 * - step이나 chapter 인자가 비어 있으면(undefined/null) 어떤 단어도 매칭하지 않는다.
 *   호출 측 실수로 인자가 빠졌을 때 전체 단어가 삭제되는 사고를 막기 위한 안전장치다.
 */
export function isSameLesson(word, step, chapter) {
  if (step == null || chapter == null) return false;
  return getStep(word) === step && word?.chapter === chapter;
}

/**
 * step/chapter로 쓸 수 있는 값인지 검사한다. 1 이상의 정수만 허용한다.
 * 0, 음수, 소수, NaN이 words.json에 저장되면 "Lesson 0" 칩이 생기는 등 화면이 깨진다.
 */
export function isValidLessonNumber(value) {
  return Number.isInteger(value) && value >= 1;
}

/**
 * URL 쿼리나 입력 필드의 문자열을 step/chapter 숫자로 바꾼다.
 * 양의 정수로 해석되지 않으면(빈 값, "abc", "1.5", "-1") null을 반환한다.
 */
export function parseLessonNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(value);
  return isValidLessonNumber(n) ? n : null;
}

/**
 * 단어 목록에 존재하는 step을 중복 없이 숫자 오름차순으로 반환한다.
 * 기본 sort()는 숫자를 문자열로 비교해 10이 2 앞에 오므로 반드시 숫자 비교를 쓴다.
 */
export function getSteps(words) {
  return [...new Set(words.map(getStep))].sort((a, b) => a - b);
}

export function getChapters(words, step) {
  return [...new Set(words.filter(w => getStep(w) === step).map(w => w.chapter))]
    .sort((a, b) => a - b);
}

/**
 * 가장 최근(가장 큰) step을 반환한다. 단어가 없으면 1.
 * 대시보드/단어 목록/입력 화면에서 "지금 공부 중인 step"을 기본 선택으로 쓰기 위한 값이다.
 */
export function getLatestStep(words) {
  if (!words || words.length === 0) return 1;
  return Math.max(...words.map(getStep));
}

/**
 * 화면 표기용 레슨 라벨을 만든다.
 * - withStep=true  → "Step 2 · Lesson 3" (step 문맥이 없는 곳: 복습 세션 제목, 삭제 확인 문구 등)
 * - withStep=false → "Lesson 3"          (이미 step 섹션/탭 안에 있어 step이 자명한 곳)
 */
export function formatLesson(step, chapter, { withStep = true } = {}) {
  return withStep ? `Step ${step} · Lesson ${chapter}` : `Lesson ${chapter}`;
}
