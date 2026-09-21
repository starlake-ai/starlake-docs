// The matrix is pure data, so the tests guard the data's invariants.
// Run with: yarn test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(here, 'capabilities.json'), 'utf8'));
const setupIds = config.setups.map((setup) => setup.id);

test('setups are the four from the spec, lightest first', () => {
  assert.deepEqual(setupIds, ['duckdb', 'files', 'iceberg', 'lake']);
});

test('every capability covers only known setups', () => {
  for (const capability of config.capabilities) {
    for (const id of capability.coveredBy) {
      assert.ok(setupIds.includes(id), `${capability.id} names unknown setup ${id}`);
    }
  }
});

test('capability ids are unique', () => {
  const ids = config.capabilities.map((capability) => capability.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('rows of a group are contiguous, so each group heading is rendered once', () => {
  const seen = [];
  let previous = null;
  for (const capability of config.capabilities) {
    if (capability.group !== previous) {
      assert.ok(!seen.includes(capability.group), `${capability.group} is split apart`);
      seen.push(capability.group);
      previous = capability.group;
    }
  }
});

test('coverage is monotonic: a heavier setup covers everything a lighter one does', () => {
  // qod serve on files, + Iceberg, then DuckLake each add to the one before.
  const ladder = ['files', 'iceberg', 'lake'];
  for (const capability of config.capabilities) {
    for (let i = 1; i < ladder.length; i += 1) {
      if (capability.coveredBy.includes(ladder[i - 1])) {
        assert.ok(
          capability.coveredBy.includes(ladder[i]),
          `${capability.id} is covered by ${ladder[i - 1]} but not ${ladder[i]}`,
        );
      }
    }
  }
});
