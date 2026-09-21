/**
 * Decision logic for the QoD decision table, per specs/qod-decision-table-spec.md.
 *
 * Pure functions over the `decision-table.json` config: same answers, same
 * verdict. Kept free of React and of the JSON import so `node --test` and the
 * browser bundle share the exact same code.
 */

/** The first option of every question, which is its default. */
export function defaultAnswers(config) {
  const answers = {};
  for (const question of config.questions) {
    answers[question.id] = question.options[0].id;
  }
  return answers;
}

/** Read answers from a query string, ignoring unknown ids and values. */
export function readAnswers(config, search) {
  const params = new URLSearchParams(
    typeof search === 'string' ? search.replace(/^\?/, '') : '',
  );
  const answers = defaultAnswers(config);
  for (const question of config.questions) {
    const value = params.get(question.id);
    if (value && question.options.some((option) => option.id === value)) {
      answers[question.id] = value;
    }
  }
  return answers;
}

/** Serialise answers back into a query string, without the leading "?". */
export function toQuery(answers) {
  return new URLSearchParams(answers).toString();
}

function matches(when, state) {
  return Object.entries(when).every(([key, expected]) =>
    Array.isArray(expected) ? expected.includes(state[key]) : expected === state[key],
  );
}

/**
 * Four rules, checked in order.
 * Returns { setup, reason, notes } where `setup` is a setup id and `notes`
 * are the matching note objects, in config order.
 */
export function decide(config, answers) {
  const { who, data, history, nodes } = answers;
  const copy = config.reasons;

  let setup;
  let reason;
  if (who === 'me' && history === 'no' && nodes === 'one') {
    setup = 'duckdb';
    reason = copy.duckdb;
  } else if (history === 'yes') {
    setup = 'lake';
    reason = copy.history;
  } else if (data === 'ducklake' || data === 'none') {
    setup = 'lake';
    reason = data === 'none' ? copy.fresh : copy.ducklake;
  } else if (data === 'iceberg') {
    setup = 'iceberg';
    reason = copy.iceberg;
  } else {
    setup = 'files';
    reason = copy.files;
  }

  if (setup !== 'duckdb' && who === 'me') {
    const lead = nodes === 'several' ? copy.severalNodes : copy.historyNeedsQod;
    reason = `${lead} ${reason}`;
  }

  const state = { ...answers, setup };
  const notes = config.notes.filter((note) => matches(note.when, state));
  return { setup, reason, notes };
}
