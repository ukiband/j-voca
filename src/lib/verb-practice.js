import { shuffle } from './shuffle.js';
import { buildVerbQuestions, VERB_FORMS } from './verb-utils.js';

export function selectedVerbForms(value) {
  const selected = VERB_FORMS.filter(f => Array.isArray(value) && value.includes(f.id)).map(f => f.id);
  return selected.length ? selected : ['te'];
}

export function startVerbPractice(words, forms) {
  const queue = shuffle(buildVerbQuestions(words, forms));
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
