const REPO_OWNER = 'ukiband';
const REPO_NAME = 'j-voca';
const FILE_PATH = 'public/data/words.json';

export function getGithubToken() {
  return localStorage.getItem('github-pat') || '';
}

export function setGithubToken(token) {
  localStorage.setItem('github-pat', token);
}

export function hasGithubToken() {
  return !!getGithubToken();
}

function utf8ToBase64(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export async function fetchWordsData() {
  // 1. GitHub raw URL (항상 최신, public repo는 토큰 불필요)
  try {
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}?t=${Date.now()}`;
    const res = await fetch(rawUrl);
    if (res.ok) return res.json();
  } catch {}

  // 2. Fallback: 정적 빌드 파일
  try {
    const url = import.meta.env.BASE_URL + 'data/words.json';
    const res = await fetch(url);
    if (res.ok) return res.json();
  } catch {}

  return { lastId: 0, words: [] };
}

async function getFileFromGithub() {
  const token = getGithubToken();
  if (!token) throw new Error('GitHub PAT를 설정해주세요.');

  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (res.status === 404) return { data: { lastId: 0, words: [] }, sha: null };
  if (!res.ok) {
    if (res.status === 401) throw new Error('GitHub PAT가 유효하지 않습니다.');
    throw new Error(`GitHub API 오류 (${res.status})`);
  }

  const file = await res.json();
  const content = JSON.parse(decodeURIComponent(escape(atob(file.content))));
  return { data: content, sha: file.sha };
}

async function commitFile(data, sha, message) {
  const token = getGithubToken();
  const json = JSON.stringify(data, null, 2) + '\n';

  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: utf8ToBase64(json),
        ...(sha ? { sha } : {}),
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub 커밋 실패 (${res.status})`);
  }
}

export async function addWordsToRepo(newWords) {
  const { data, sha } = await getFileFromGithub();

  // 같은 레슨 내 중복 제거 (word 기준)
  const existingWords = new Set(
    data.words.filter(w => w.chapter === newWords[0]?.chapter).map(w => w.word)
  );
  const unique = newWords.filter(w => !existingWords.has(w.word));
  const skipped = newWords.length - unique.length;

  let nextId = data.lastId;
  const wordsWithIds = unique.map(w => ({ ...w, id: ++nextId }));

  data.words.push(...wordsWithIds);
  data.lastId = nextId;

  if (wordsWithIds.length > 0) {
    await commitFile(data, sha, `단어 ${wordsWithIds.length}개 추가`);
  }
  return { data, wordsWithIds, skipped };
}

export async function updateWordInRepo(id, changes) {
  const { data, sha } = await getFileFromGithub();

  const index = data.words.findIndex(w => w.id === id);
  if (index === -1) throw new Error('단어를 찾을 수 없습니다.');

  data.words[index] = { ...data.words[index], ...changes };

  await commitFile(data, sha, `단어 수정: ${data.words[index].word}`);
  return data;
}

export async function deleteWordFromRepo(id) {
  const { data, sha } = await getFileFromGithub();

  const word = data.words.find(w => w.id === id);
  data.words = data.words.filter(w => w.id !== id);

  await commitFile(data, sha, `단어 삭제: ${word?.word || id}`);
  return data;
}

export async function deleteChapterFromRepo(chapter) {
  const { data, sha } = await getFileFromGithub();

  const deletedIds = data.words.filter(w => w.chapter === chapter).map(w => w.id);
  data.words = data.words.filter(w => w.chapter !== chapter);

  await commitFile(data, sha, `Lesson ${chapter} 단어 ${deletedIds.length}개 삭제`);
  return { data, deletedIds };
}

export async function resetWordsInRepo() {
  const { sha } = await getFileFromGithub();
  await commitFile({ lastId: 0, words: [] }, sha, '전체 단어 초기화');
}
