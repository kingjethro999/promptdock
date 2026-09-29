const test = require('node:test');
const assert = require('node:assert/strict');
const { configuredProviders, enhanceWithAI, normalizeDraft } = require('../ai');

test('configured providers follow environment order', () => {
  assert.deepEqual(configuredProviders({ AI_PROVIDER_ORDER: 'apmix,groq,gemini', GROQ_API_KEY: 'x', GROQ_MODEL: 'm', GEMINI_API_KEY: 'y' }), ['groq', 'gemini']);
});

test('draft validation requires a task', () => {
  assert.throws(() => normalizeDraft({ task: '   ' }), /Add a task/);
});

test('AI enhancement falls back and keeps unknown details blank', async () => {
  const env = { AI_PROVIDER_ORDER: 'apmix,groq', AI_MAX_FALLBACKS: '1', APMIX_API_KEY: 'x', APMIX_BASE_URL: 'https://example.com/v1', APMIX_MODEL: 'test', GROQ_API_KEY: 'y', GROQ_MODEL: 'test' };
  const calls = [];
  const fakeFetch = async url => {
    calls.push(url);
    if (calls.length === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ task: 'Write a clear launch email', role: 'Copywriter', format: 'Email', tone: 'Friendly' }) } }] }) };
  };
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const result = await enhanceWithAI({ task: 'write launch email' }, env, fakeFetch);
    assert.equal(result.provider, 'groq');
    assert.equal(result.data.task, 'Write a clear launch email');
    assert.equal(result.data.context, '');
    assert.equal(result.data.format, 'Email');
    assert.equal(calls.length, 2);
  } finally { console.warn = originalWarn; }
});
