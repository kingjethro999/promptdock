const test = require('node:test');
const assert = require('node:assert/strict');
const { nextVersion } = require('../scripts/bump-version');

test('version milestones follow the project convention', () => {
  assert.equal(nextVersion('0.0.1'), '0.0.2');
  assert.equal(nextVersion('0.0.9'), '0.1.0');
  assert.equal(nextVersion('0.1.0'), '0.1.1');
  assert.equal(nextVersion('0.1.8'), '0.1.9');
  assert.equal(nextVersion('0.1.9'), '0.2.0');
  assert.equal(nextVersion('0.598.9'), '0.599.0');
  assert.equal(nextVersion('0.599.0'), '1.0.0');
  assert.equal(nextVersion('1.0.0'), '1.0.1');
});
