const test = require('node:test');
const assert = require('node:assert/strict');
const { configuredProviders, enhanceWithAI, ideaToPrompt, normalizeDraft, normalizeIdea, parseIdeaSuggestion } = require('../ai');

test('configured providers follow environment order', () => {
  assert.deepEqual(configuredProviders({ AI_PROVIDER_ORDER: 'apmix,groq,gemini', GROQ_API_KEY: 'x', GROQ_MODEL: 'm', GEMINI_API_KEY: 'y' }), ['groq', 'gemini']);
});

test('draft validation requires a task', () => {
  assert.throws(() => normalizeDraft({ task: '   ' }), /Add a task/);
});

test('rough ideas require a useful amount of input', () => {
  assert.throws(() => normalizeIdea({ idea: 'a ' }), /Describe your idea/);
  assert.equal(normalizeIdea({ idea: '  meal planning app  ' }), 'meal planning app');
});

test('idea response keeps ranked focus and flags missing details', () => {
  const result = parseIdeaSuggestion(JSON.stringify({
    data: { task: 'Plan a meal app', approach: '1. Define user needs\n2. Plan the first release', focus: '1. User needs\n2. Core workflow', depth: 'Deep', format: 'Step-by-step guide', tone: 'Invented tone' },
    interpretation: { goal: 'Plan the app', whyThisDepth: 'A product needs several decisions.', focusAreas: ['User needs', 'Core workflow'], missingDetails: ['Target users'] }
  }), 'meal app');
  assert.equal(result.data.focus, '1. User needs\n2. Core workflow');
  assert.equal(result.data.approach, '1. Define user needs\n2. Plan the first release');
  assert.equal(result.data.depth, 'Deep');
  assert.equal(result.data.tone, '');
  assert.deepEqual(result.interpretation.missingDetails, ['Target users']);
  assert.throws(() => parseIdeaSuggestion('{"data":{"task":"Plan an app"}}', 'app'), /Incomplete AI response/);
});

test('idea generation passes the raw idea and returns a structured prompt', async () => {
  const env = { AI_PROVIDER_ORDER: 'groq', GROQ_API_KEY: 'test', GROQ_MODEL: 'test' };
  let submitted;
  const fakeFetch = async (url, options) => {
    submitted = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      data: { task: 'Plan a meal app', role: 'Product strategist', approach: '1. Define user needs\n2. Plan the first release', focus: '1. User needs\n2. Core workflow', depth: 'Deep' },
      interpretation: { goal: 'Plan the product', focusAreas: ['User needs', 'Core workflow'], missingDetails: ['Target users'] }
    }) } }] }) };
  };
  const result = await ideaToPrompt({ idea: 'I want a meal planning app' }, env, fakeFetch);
  assert.equal(submitted.messages[1].content, 'I want a meal planning app');
  assert.equal(result.provider, 'groq');
  assert.equal(result.data.depth, 'Deep');
  assert.match(result.data.approach, /first release/);
  assert.equal(result.interpretation.focusAreas[0], 'User needs');
});

test('idea generation retries a transient connection failure', async () => {
  const env = { AI_PROVIDER_ORDER: 'groq', GROQ_API_KEY: 'test', GROQ_MODEL: 'test' };
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    if (calls === 1) throw new TypeError('fetch failed');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ data: { task: 'Plan an app', focus: '1. User needs', depth: 'Balanced' } }) } }] }) };
  };
  const result = await ideaToPrompt({ idea: 'Make a study app' }, env, fakeFetch);
  assert.equal(calls, 2);
  assert.equal(result.data.task, 'Plan an app');
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
