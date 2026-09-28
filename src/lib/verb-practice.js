import { shuffle } from './shuffle.js';
import { compareLessonDesc } from './lesson-utils.js';
import { buildVerbQuestions, VERB_FORMS } from './verb-utils.js';

export function selectedVerbForms(value) {
  const selected = VERB_FORMS.filter(f => Array.isArray(value) && value.includes(f.id)).map(f => f.id);
  return selected.length ? selected : ['te'];
}

// 최근 step·lesson 의 문제부터 내되 같은 lesson 안에서는 순서를 섞는다.
// 최근 레슨 순으로 정렬해 같은 레슨의 문제를 붙여 놓은 뒤 레슨 묶음 안에서만 섞는다. 묶는 기준도 정렬과 같은 비교(compareLessonDesc)를 써서
// 정렬에서 같은 레슨으로 본 문제가 다른 묶음으로 갈라지지 않게 한다.
export function orderByRecentLesson(questions) {
  const groups = [];
  for (const question of [...questions].sort((a, b) => compareLessonDesc(a.word, b.word))) {
    const group = groups[groups.length - 1];
    if (group && compareLessonDesc(group[0].word, question.word) === 0) group.push(question);
    else groups.push([question]);
  }
  return groups.flatMap(group => shuffle(group));
}

export function startVerbPractice(words, forms) {
  const queue = orderByRecentLesson(buildVerbQuestions(words, forms));
  return { queue, initialCount: queue.length, index: 0, flipped: false };
}

// 연속 클릭으로 다음 카드의 앞면까지 건너뛰지 않게 한다.
export function verbPracticeReducer(state, action) {
  if (action.type === 'start') return action.session;
  if (!state || !state.queue[state.index]) return state;
  if (action.type === 'flip') return { ...state, flipped: true };
  if (!state.flipped || !['again', 'next'].includes(action.type)) return state;
  return {
    ...state,
    queue: action.type === 'again' ? [...state.queue, state.queue[state.index]] : state.queue,
    index: state.index + 1,
    flipped: false,
  };
}
