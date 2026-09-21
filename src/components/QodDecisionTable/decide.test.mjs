// Acceptance tests from specs/qod-decision-table-spec.md, table driven.
// Run with: yarn test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decide, defaultAnswers, readAnswers, toQuery } from './decide.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  fs.readFileSync(path.join(here, 'decision-table.json'), 'utf8'),
);

// # | who | data | history | nodes | stage | setup | notes
const CASES = [
  [1, 'me', 'files', 'no', 'one', 'eval', 'duckdb', []],
  [2, 'me', 'none', 'no', 'one', 'pilot', 'duckdb', []],
  [3, 'others', 'files', 'no', 'one', 'eval', 'files', ['start-here']],
  [4, 'others', 'files', 'no', 'several', 'pilot', 'files', ['duckdb-file-single-node']],
  [5, 'others', 'iceberg', 'no', 'one', 'pilot', 'iceberg', []],
  [6, 'others', 'iceberg', 'no', 'several', 'prod', 'iceberg', ['iceberg-prod']],
  [7, 'others', 'iceberg', 'yes', 'one', 'pilot', 'lake', ['iceberg-on-lake']],
  [8, 'others', 'none', 'no', 'one', 'pilot', 'lake', []],
  [9, 'others', 'ducklake', 'no', 'one', 'prod', 'lake', []],
  [10, 'me', 'files', 'yes', 'one', 'pilot', 'lake', []],
  [11, 'me', 'files', 'no', 'several', 'pilot', 'files', ['duckdb-file-single-node', 'laptop-cluster']],
  [12, 'others', 'files', 'yes', 'several', 'eval', 'lake', ['start-here']],
];

for (const [n, who, data, history, nodes, stage, setup, notes] of CASES) {
  test(`case ${n}: ${who}/${data}/${history}/${nodes}/${stage} -> ${setup}`, () => {
    const verdict = decide(config, { who, data, history, nodes, stage });
    assert.equal(verdict.setup, setup);
    assert.deepEqual(verdict.notes.map((note) => note.id), notes);
  });
}

test('every verdict names a setup the matrix can highlight', () => {
  const ids = new Set(config.setups.map((s) => s.id));
  for (const [, who, data, history, nodes, stage] of CASES) {
    assert.ok(ids.has(decide(config, { who, data, history, nodes, stage }).setup));
  }
});

test('case 10 puts the QoD reason before the DuckLake reason', () => {
  const verdict = decide(config, {
    who: 'me', data: 'files', history: 'yes', nodes: 'one', stage: 'pilot',
  });
  assert.equal(
    verdict.reason,
    'History features need QoD. Undo, time travel and audit come with DuckLake.',
  );
});

test('defaults are the first option of each question and yield plain DuckDB', () => {
  const answers = defaultAnswers(config);
  assert.deepEqual(answers, {
    who: 'me', data: 'files', history: 'no', nodes: 'one', stage: 'eval',
  });
  assert.equal(decide(config, answers).setup, 'duckdb');
});

test('an unknown value in the query string falls back to that question default', () => {
  const answers = readAnswers(config, '?who=others&data=foo&nodes=several');
  assert.equal(answers.data, 'files');
  assert.equal(answers.who, 'others');
  assert.equal(answers.nodes, 'several');
  assert.equal(answers.stage, 'eval');
});

test('the query string round trips every answer', () => {
  const answers = readAnswers(config, '?who=others&data=iceberg&history=no&nodes=several&stage=prod');
  assert.equal(toQuery(answers), 'who=others&data=iceberg&history=no&nodes=several&stage=prod');
});
