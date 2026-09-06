/**
 * 예문 생성 배치. GitHub Actions 가 하루 1회(KST 07:00) 실행한다. 로컬에서는 GEMINI_API_KEY=... node scripts/generate-sentences.mjs
 *
 * 흐름
 * 1. words.json 에서 최신 레슨(가장 큰 step 의 가장 큰 chapter)을 찾는다. step 이 2 미만이면 아무것도 하지 않는다
 * 2. sentences.json 정리: 삭제된 단어의 예문은 지우고, 최신 레슨 단어의 source 가 현재 데이터와 다른 예문도 지운다
 *    (과거 레슨의 source 불일치는 파일에 남기고 화면에서만 제외한다 — 다시 생성하지 않기 때문)
 * 3. 최신 레슨에서 유효 예문이 7개 미만이고 오늘(KST) 만든 예문이 없는 단어를 골라 10개씩 묶어 최대 5회 호출한다
 * 4. 검증(validateSentence)을 통과한 결과만 추가하고, 변경이 있을 때만 파일을 다시 쓴다
 *
 * 종료 코드: 성공(변경 없음 포함) 0. 키 누락, 400/401/403 처럼 다시 돌려도 같은 결과인 치명 오류만 1.
 * 쿼터 소진·서버 장애·네트워크 오류는 성공분을 보존하고 0 으로 끝낸다 (다음 날 실행이 이어서 채운다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLatestLessonWords, pruneSentences, selectTargets, validateSentence } from '../src/lib/sentence-utils.js';
import { getKstDateString } from '../src/lib/date-utils.js';
import { generateSentences, GeminiRequestError } from './gemini-node.mjs';

const WORDS_PER_REQUEST = 10;
const MAX_REQUESTS_PER_RUN = 5;

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

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const today = getKstDateString();
  const words = readJson(WORDS_PATH, { words: [] }).words || [];
  const sentenceData = readJson(SENTENCES_PATH, { sentences: [] });
  const sentences = Array.isArray(sentenceData.sentences) ? sentenceData.sentences : [];

  const { step, chapter, words: lessonWords } = getLatestLessonWords(words);
  if (lessonWords.length === 0) {
    console.log(`최신 step 이 ${step} 이라 생성 대상이 없습니다 (step 2 이상만 생성).`);
    return 0;
  }
  console.log(`대상 레슨: Step ${step} · Lesson ${chapter} (단어 ${lessonWords.length}개), 오늘(KST): ${today}`);

  const wordsById = new Map(words.map(w => [w.id, w]));
  const kept = pruneSentences(sentences, words, new Set(lessonWords.map(w => w.id)));
  const removed = sentences.length - kept.length;
  if (removed > 0) console.log(`정리: 삭제된 단어·source 불일치 예문 ${removed}건 제거`);

  const byWord = new Map();
  for (const s of kept) {
    if (!byWord.has(s.wordId)) byWord.set(s.wordId, []);
    byWord.get(s.wordId).push(s);
  }
  const targets = selectTargets(lessonWords, byWord, today);
  console.log(`생성 대상 단어: ${targets.length}개`);

  const added = [];
  let fatalError = null;

  if (targets.length > 0) {
    if (!apiKey) {
      // 정리 결과는 아래에서 파일에 반영하되, 생성은 못 했으니 실패로 끝낸다
      fatalError = new Error('GEMINI_API_KEY 환경 변수가 없습니다.');
    } else {
      const batches = chunk(targets, WORDS_PER_REQUEST);
      if (batches.length > MAX_REQUESTS_PER_RUN) {
        console.log(`호출 상한 ${MAX_REQUESTS_PER_RUN}회 → ${targets.length - MAX_REQUESTS_PER_RUN * WORDS_PER_REQUEST}개 단어는 다음 실행으로 미룸`);
      }

      for (const batch of batches.slice(0, MAX_REQUESTS_PER_RUN)) {
        const items = batch.map(w => ({
          wordId: w.id,
          word: w.word,
          reading: w.reading,
          meaning: w.meaning,
          pos: w.pos,
          existing: (byWord.get(w.id) || []).map(s => s.sentence),
        }));

        let result;
        try {
          result = await generateSentences(items, apiKey);
        } catch (err) {
          console.error(`[batch] 실패: ${err.message}`);
          if (err instanceof GeminiRequestError) {
            // API 단계 실패(한도 초과·서버 장애·요청 오류)는 다음 묶음도 같은 결과일 가능성이 높아 여기서 멈춘다
            if (err.fatal) fatalError = err;
            break;
          }
          // 파싱 실패 등 응답 내용 문제는 다음 묶음에는 없을 수 있으니 계속 간다
          continue;
        }

        const batchIds = new Set(batch.map(w => w.id));
        const doneInBatch = new Set();
        for (const row of result.rows) {
          const word = wordsById.get(row.wordId);
          if (!word || !batchIds.has(row.wordId)) {
            console.warn(`  거부 wordId=${row.wordId}: 요청하지 않은 단어`);
            continue;
          }
          // 모델이 같은 단어를 두 번 돌려줘도 하루 1개 규칙을 지킨다
          if (doneInBatch.has(row.wordId)) continue;
          const reason = validateSentence(row, byWord.get(word.id) || []);
          if (reason) {
            console.warn(`  거부 ${word.word}(${word.id}): ${reason} — ${String(row.sentence).slice(0, 40)}`);
            continue;
          }
          const entry = {
            wordId: word.id,
            date: today,
            source: { word: word.word, reading: word.reading, meaning: word.meaning },
            sentence: row.sentence.trim(),
            reading: row.reading.trim(),
            meaning: row.meaning.trim(),
          };
          added.push(entry);
          doneInBatch.add(word.id);
          if (!byWord.has(word.id)) byWord.set(word.id, []);
          byWord.get(word.id).push(entry);
        }
        console.log(`[batch] ${result.model}: 요청 ${batch.length}개 → 저장 ${doneInBatch.size}개`);
      }
    }
  }

  // 정리와 추가를 합친 결과를 한 번에 쓴다. 변경이 없으면 파일을 건드리지 않아 불필요한 커밋이 생기지 않는다
  if (removed > 0 || added.length > 0) {
    const out = { sentences: [...kept, ...added] };
    fs.writeFileSync(SENTENCES_PATH, JSON.stringify(out, null, 2) + '\n');
    console.log(`sentences.json 저장: 제거 ${removed}건, 추가 ${added.length}건, 총 ${out.sentences.length}건`);
  } else {
    console.log('변경 없음. 파일을 쓰지 않습니다.');
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
