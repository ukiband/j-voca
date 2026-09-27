/**
 * 예문 검사·보정 배치. GitHub Actions 가 생성 배치(generate-sentences.mjs) 바로 다음 스텝으로 실행한다.
 * 로컬에서는 GEMINI_API_KEY=... node scripts/check-sentences.mjs [--dry-run] (--dry-run 은 결과만 출력하고 파일을 쓰지 않는다)
 *
 * 생성 배치의 저장 검증(validateSentence)은 표기 대응만 보므로, 형식은 맞아도 문법·단어의 쓰임·한자 읽기·번역이 틀린 예문이 저장된다.
 * 그래서 새로 만든 예문을 Gemini 로 한 번 더 검사해, 틀린 것은 고치고 고치지 못하면 앱에서 숨긴다.
 *
 * 흐름
 * 1. 대상(selectCheckTargets): 만든 지 7일 안이고 아직 검사하지 않은 예문과, 전에 틀렸다고 판정해 숨긴 예문. 없으면 아무것도 하지 않는다
 * 2. 1차 검사: 10건씩 묶어 검사한다. 통과하면 check 를 ok 로 표시한다. 틀렸다는 판정과 함께 온 수정안은
 *    형식 검증(validateCheckFix)을 통과하면 재검사 후보로 두고, 통과하지 못하면 원래 예문을 숨긴다
 * 3. 재검사: 후보의 수정안만 모아 같은 방식으로 한 번 더 검사한다. 통과하면 수정안으로 교체하고, 아니면(틀림·응답 누락·요청 상한·API 오류)
 *    원래 예문을 1차 판정 이유로 숨긴다. 재검사까지만 하고 더 반복하지 않는다. 숨긴 예문은 다음 실행에서 다시 대상이 된다
 * 4. 요청은 1차 검사와 재검사를 합쳐 한 실행에 최대 8회. 응답에서 빠졌거나 요청하지 못한 대상은 그대로 두어 다음 실행에서 다시 본다
 * 5. 결과를 제자리에 반영(applyCheckResults)하고, 바뀐 것이 있을 때만 파일을 다시 쓴다
 *
 * 종료 코드: 성공(변경 없음 포함) 0. 대상이 있는데 키가 없거나, 400/401/403 처럼 다시 돌려도 같은 결과인 치명 오류만 1.
 * 쿼터 소진·서버 장애·네트워크 오류는 성공분을 저장하고 0 으로 끝낸다 (남은 대상은 다음 실행이 이어서 검사한다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectCheckTargets, validateCheckFix, applyCheckResults, isRejectedByCheck } from '../src/lib/sentence-utils.js';
import { verbReading } from '../src/lib/verb-utils.js';
import { getKstDateString } from '../src/lib/date-utils.js';
import { checkSentences, GeminiRequestError } from './gemini-node.mjs';

const SENTENCES_PER_REQUEST = 10;
// 생성 배치가 한 실행에 최대 50건(5묶음)을 만들므로, 그 1차 검사 5회에 재검사를 더해도 들어가는 크기로 잡는다
const MAX_REQUESTS_PER_RUN = 8;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORDS_PATH = path.join(root, 'public/data/words.json');
const SENTENCES_PATH = path.join(root, 'public/data/sentences.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toCheckItem(word, example) {
  return {
    wordId: word.id,
    word: word.word,
    // 가타카나 단어의 읽기가 히라가나로 저장돼 있어도(ページ/ぺーじ) 예문의 가타카나 표기를 틀린 읽기로 판정하지 않게 한다
    reading: verbReading(word),
    meaning: word.meaning,
    pos: word.pos,
    example,
  };
}

// problem 은 필수 필드가 아니라 빠질 수 있다. 숨긴 예문에는 이유가 남아야 나중에 보고 고칠 수 있다
function problemOf(row) {
  return typeof row.problem === 'string' && row.problem.trim() ? row.problem.trim() : '이유 없이 틀렸다고 판정됨';
}

// 수정안은 모델 응답 그대로라 필드가 빠져 있을 수 있다
function exampleFields(example) {
  return [example?.sentence, example?.reading, example?.meaning].map(v => (typeof v === 'string' && v.trim()) || '(없음)');
}

/** Actions 실행 화면의 요약에 결과를 남긴다. 로그를 열지 않고도 무엇이 바뀌었는지 볼 수 있게 한다 */
function writeStepSummary({ today, dryRun, counts, wrong, wordsById }) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  // 셀 안의 | 는 열 구분자로 읽히고 줄바꿈은 표를 끊으므로 바꿔 쓴다
  const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const exampleCell = example => exampleFields(example).map(cell).join('<br>');

  const lines = [`### 예문 검사 ${today}${dryRun ? ' (dry-run, 파일 미반영)' : ''}`, '', counts, ''];
  if (wrong.length > 0) {
    lines.push('| 단어 | 문제 | 원래 예문 | 수정 예문 | 처리 |', '|---|---|---|---|---|');
    for (const w of wrong) {
      const word = wordsById.get(w.original.wordId);
      lines.push(`| ${cell(`${word.word}(${word.id})`)} | ${cell(w.problem)} | ${exampleCell(w.original)} | ${exampleCell(w.fix)} | ${cell(w.outcome)} |`);
    }
    lines.push('');
  }
  fs.appendFileSync(summaryPath, lines.join('\n') + '\n');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apiKey = process.env.GEMINI_API_KEY;
  const today = getKstDateString();
  const words = readJson(WORDS_PATH, { words: [] }).words || [];
  const sentenceData = readJson(SENTENCES_PATH, { sentences: [] });
  const sentences = Array.isArray(sentenceData.sentences) ? sentenceData.sentences : [];

  const targets = selectCheckTargets(sentences, words, today);
  if (targets.length === 0) {
    console.log(`검사할 예문이 없습니다. 오늘(KST): ${today}`);
    return 0;
  }
  const retrying = targets.filter(isRejectedByCheck).length;
  console.log(`검사 대상 ${targets.length}건 (검사 전 ${targets.length - retrying}건, 숨긴 예문 ${retrying}건), 오늘(KST): ${today}`);
  if (!apiKey) {
    console.error('치명 오류: GEMINI_API_KEY 환경 변수가 없습니다.');
    return 1;
  }

  const wordsById = new Map(words.map(w => [w.id, w]));
  const passed = new Set();
  const fixed = new Map();
  const rejected = new Map();
  // 틀렸다고 판정된 항목: { original, problem, fix, outcome }. 로그와 Actions 요약에 쓴다
  const wrong = [];
  let requestsLeft = MAX_REQUESTS_PER_RUN;
  let stopped = false;
  let fatalError = null;

  // 1차 검사와 재검사가 요청 상한과 오류 처리를 함께 쓴다. 요청하지 못했거나 응답을 읽지 못하면 null
  async function requestCheck(label, examples) {
    if (stopped || requestsLeft === 0) return null;
    requestsLeft -= 1;
    let result;
    try {
      result = await checkSentences(examples.map(e => toCheckItem(wordsById.get(e.wordId), e)), apiKey);
    } catch (err) {
      console.error(`[${label}] 실패: ${err.message}`);
      if (err instanceof GeminiRequestError) {
        // API 단계 실패(한도 초과·서버 장애·요청 오류)는 다음 묶음도 같은 결과일 가능성이 높아 남은 요청을 모두 멈춘다
        if (err.fatal) fatalError = err;
        stopped = true;
      }
      // 파싱 실패 등 응답 내용 문제는 다음 묶음에는 없을 수 있으니 계속 간다
      return null;
    }
    const requested = new Set(examples.map(e => e.wordId));
    const rows = new Map();
    for (const row of result.rows) {
      if (!requested.has(row.wordId)) {
        console.warn(`  무시 wordId=${row.wordId}: 요청하지 않은 항목`);
        continue;
      }
      // 판정이 없는 행은 응답에서 빠진 것과 같이 보고, 같은 항목이 두 번 오면 첫 판정만 쓴다
      if (typeof row.ok !== 'boolean' || rows.has(row.wordId)) continue;
      rows.set(row.wordId, row);
    }
    console.log(`[${label}] ${result.model}: 요청 ${examples.length}건 → 판정 ${rows.size}건`);
    return rows;
  }

  const candidates = [];
  let firstRequested = 0;
  for (const batch of chunk(targets, SENTENCES_PER_REQUEST)) {
    if (stopped || requestsLeft === 0) break;
    firstRequested += batch.length;
    const rows = await requestCheck('1차 검사', batch);
    if (!rows) continue;
    for (const s of batch) {
      const row = rows.get(s.wordId);
      if (!row) continue;
      if (row.ok) {
        passed.add(s.wordId);
        continue;
      }
      const problem = problemOf(row);
      const reason = validateCheckFix(s, row);
      if (reason) {
        rejected.set(s.wordId, `${problem} (수정안 거부: ${reason})`);
        wrong.push({ original: s, problem, fix: row, outcome: `숨김 (수정안 거부: ${reason})` });
      } else {
        const fix = { wordId: s.wordId, sentence: row.sentence.trim(), reading: row.reading.trim(), meaning: row.meaning.trim() };
        candidates.push({ original: s, problem, fix });
      }
    }
  }
  if (firstRequested < targets.length) {
    console.log(`요청 상한 또는 API 오류로 ${targets.length - firstRequested}건은 검사하지 못해 다음 실행으로 미룸`);
  }

  // 수정안이 또 틀릴 수 있어 재검사를 통과한 것만 교체한다. 확인하지 못한 수정안은 버리고 원래 예문을 숨겨, 다음 실행에서 처음부터 다시 검사한다
  for (const batch of chunk(candidates, SENTENCES_PER_REQUEST)) {
    const rows = await requestCheck('재검사', batch.map(c => c.fix));
    for (const c of batch) {
      const row = rows?.get(c.original.wordId);
      if (row?.ok === true) {
        fixed.set(c.original.wordId, c.fix);
        wrong.push({ ...c, outcome: '교체' });
        continue;
      }
      rejected.set(c.original.wordId, c.problem);
      const why = row ? `재검사 불통과: ${problemOf(row)}` : rows ? '재검사 응답 누락' : '재검사 못 함';
      wrong.push({ ...c, outcome: `숨김 (${why})` });
    }
  }

  wrong.sort((a, b) => targets.indexOf(a.original) - targets.indexOf(b.original));
  for (const w of wrong) {
    const word = wordsById.get(w.original.wordId);
    console.log(`[틀림] ${word.word}(${word.id}): ${w.problem}`);
    console.log(`  원래: ${exampleFields(w.original).join(' / ')}`);
    console.log(`  수정: ${exampleFields(w.fix).join(' / ')}`);
    console.log(`  처리: ${w.outcome}`);
  }
  const unprocessed = targets.length - passed.size - fixed.size - rejected.size;
  const counts = `통과 ${passed.size}건, 교체 ${fixed.size}건, 숨김 ${rejected.size}건, 미처리 ${unprocessed}건`;
  console.log(`결과: ${counts}`);
  writeStepSummary({ today, dryRun, counts, wrong, wordsById });

  const next = applyCheckResults(sentences, { passed, fixed, rejected }, today);
  // 같은 날 다시 실행해 숨긴 예문이 같은 이유로 또 숨겨지면 내용이 그대로이므로 판정 개수가 아니라 내용으로 비교한다
  if (JSON.stringify(next) === JSON.stringify(sentences)) {
    console.log('변경 없음. 파일을 쓰지 않습니다.');
  } else if (dryRun) {
    console.log('--dry-run: 파일을 쓰지 않습니다.');
  } else {
    fs.writeFileSync(SENTENCES_PATH, JSON.stringify({ sentences: next }, null, 2) + '\n');
    console.log(`sentences.json 저장: 총 ${next.length}건`);
  }

  if (fatalError) {
    console.error(`치명 오류: ${fatalError.message}`);
    return 1;
  }
  return 0;
}

main().then(
  code => process.exit(code),
  err => {
    console.error(err);
    process.exit(1);
  }
);
