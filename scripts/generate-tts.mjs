#!/usr/bin/env node
// VOICEVOX Nemo 엔진을 호출해 words.json의 각 단어에 대한 wav 파일을 생성한다.
// - 이미 존재하는 파일은 스킵 (멱등성)
// - 출력: public/audio/{hash}.wav, public/audio/index.json
// - 환경변수 VOICEVOX_ENGINE_URL (기본 http://127.0.0.1:50121)

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WORDS_PATH = join(ROOT, 'public/data/words.json');
const AUDIO_DIR = join(ROOT, 'public/audio');
const INDEX_PATH = join(AUDIO_DIR, 'index.json');

const ENGINE_URL = process.env.VOICEVOX_ENGINE_URL || 'http://127.0.0.1:50121';
const SPEAKER_ID = 10005; // 女声1 ノーマル

// 단어 텍스트를 안정적인 짧은 해시로 변환 (파일명 충돌 방지 + 멱등)
function hashWord(text) {
  return createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 12);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// VOICEVOX 합성 2단계: audio_query → synthesis
async function synthesize(text) {
  const queryRes = await fetch(
    `${ENGINE_URL}/audio_query?speaker=${SPEAKER_ID}&text=${encodeURIComponent(text)}`,
    { method: 'POST' }
  );
  if (!queryRes.ok) throw new Error(`audio_query failed: ${queryRes.status}`);
  const query = await queryRes.json();

  const synthRes = await fetch(
    `${ENGINE_URL}/synthesis?speaker=${SPEAKER_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    }
  );
  if (!synthRes.ok) throw new Error(`synthesis failed: ${synthRes.status}`);
  return Buffer.from(await synthRes.arrayBuffer());
}

async function main() {
  // 엔진 헬스체크
  try {
    const v = await fetch(`${ENGINE_URL}/version`);
    if (!v.ok) throw new Error(`status ${v.status}`);
    console.log(`✓ Nemo engine: ${(await v.text()).trim()}`);
  } catch (e) {
    console.error(`✗ Nemo engine 응답 없음 (${ENGINE_URL}): ${e.message}`);
    process.exit(1);
  }

  await mkdir(AUDIO_DIR, { recursive: true });

  const raw = await readFile(WORDS_PATH, 'utf8');
  const data = JSON.parse(raw);
  const words = data.words || [];
  console.log(`총 단어 수: ${words.length}`);

  const index = {};
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const w of words) {
    const text = w.word;
    if (!text) continue;
    const hash = hashWord(text);
    const filename = `${hash}.wav`;
    const filepath = join(AUDIO_DIR, filename);
    index[text] = filename;

    if (await fileExists(filepath)) {
      skipped++;
      continue;
    }

    try {
      const audio = await synthesize(text);
      await writeFile(filepath, audio);
      generated++;
      console.log(`  + ${text} → ${filename} (${audio.length} bytes)`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${text}: ${e.message}`);
    }
  }

  // 인덱스 파일 작성 (정렬해서 diff 안정성 확보)
  const sortedIndex = Object.fromEntries(
    Object.entries(index).sort(([a], [b]) => a.localeCompare(b))
  );
  await writeFile(INDEX_PATH, JSON.stringify(sortedIndex, null, 2) + '\n');

  console.log(`\n생성: ${generated}, 스킵: ${skipped}, 실패: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
