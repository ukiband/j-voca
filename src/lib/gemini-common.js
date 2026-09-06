/**
 * 브라우저(gemini.js)와 GitHub Actions 배치(scripts/gemini-node.mjs)가 함께 쓰는 Gemini 규칙.
 * 두 곳이 같은 모델 순서·같은 대체 판정을 써야 하므로 한 파일에 둔다. 환경 의존(localStorage, import.meta.env) 코드를 넣지 않는다.
 */

// 사용자가 모델을 고르지 않고, 이 순서대로 시도하다가 503/404/429(또는 그 외 5xx)가 나면 다음 모델로 넘어간다.
// 순서 근거 (교재 사진 7장 실측):
// - 3.5-flash-lite: 2~4초로 가장 빠르고 503 이 없었으며, 추출 정확도도 가장 높았다
// - 3.8-flash: 결과는 정확하지만 무료 등급에서 절반 이상 503 이 나서 두 번째로 둔다
// - 2.5-flash: 15~28초로 느리고 예문 속 단어까지 대량으로 추출해서 최후 수단이다
// gemini-2.0 계열은 2026-06-01 서비스 종료(404)라 넣지 않는다. Pro 계열은 무료가 아니다.
export const MODEL_CHAIN = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'];

// 503 이거나 메시지가 과부하를 뜻하면 true. 재시도 판단과 오류 메시지 생성이 같은 기준을 쓰도록 분리했다.
// 429 는 메시지에 "high demand" 가 섞여 있어도 쿼터 초과로만 본다. 과부하로 보면 재시도까지 하게 되는데,
// 쿼터는 기다려도 바로 풀리지 않으므로 재시도 없이 다음 모델로 넘기는 편이 맞다.
export function isOverloaded(status, msg) {
  return status === 503 || (status !== 429 && /high demand|overloaded/i.test(msg));
}

// 429 이거나 메시지가 쿼터 초과를 뜻하면 true. 무료 등급 쿼터는 모델별로 따로 걸리므로 체인에서 다음 모델로 넘기는 기준이 된다
export function isQuotaExceeded(status, msg) {
  return status === 429 || /quota|rate limit/i.test(msg);
}

// 모델을 바꾸면 해결될 수 있는 실패인지 판단한다:
// - 과부하(재시도까지 실패), 모델 사용 불가(404)
// - 쿼터 초과(429): 무료 등급 쿼터가 모델별로 따로 걸려서(실측: 3.8-flash 만 429, lite 는 정상) 다른 모델은 쓸 수 있다
// - 그 외 5xx(500/502/504 등): 서버 쪽 일시 장애라 다른 모델 엔드포인트는 정상일 수 있다
// 그 외(400 요청 오류, 401/403 키 문제 등)는 모델을 바꿔도 같으므로 false.
export function shouldTryNextModel(status, msg) {
  return isOverloaded(status, msg) || isQuotaExceeded(status, msg) || status === 404 || status >= 500;
}

// 모델 계열별 출력 안정화 설정.
// Gemini 3 계열은 temperature 를 기본값(1.0)에서 낮추면 오히려 반복 출력이나 성능 저하가 생긴다고
// 공식 문서가 안내하므로 temperature 를 넣지 않고 사고(thinking) 양을 thinkingLevel 로 조절한다.
// - 3.5-flash-lite: LOW 에서는 회차마다 결과가 달라 예문 단어를 초과 추출하거나 단어 칸 항목을 누락했고,
//   MEDIUM 에서는 사진 7장 모두(4회 반복 포함) 누락·초과 0 이었다. 7~14초로 느려지지만 정확도가 우선이다.
// - 그 외 3 계열(3.8-flash): LOW 로도 정확했고 기본값(MEDIUM)보다 빨라서 LOW 를 유지한다.
// Gemini 2.5 계열은 thinkingLevel 을 지원하지 않고, 낮은 temperature 로 일관된 출력을 얻는 기존 방식이 유효하다.
export function getModelTuning(model) {
  if (model.startsWith('gemini-3')) {
    return { thinkingConfig: { thinkingLevel: model === 'gemini-3.5-flash-lite' ? 'MEDIUM' : 'LOW' } };
  }
  return { temperature: 0.1 };
}
