const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);

const fieldNames = ['task', 'role', 'audience', 'context', 'format', 'tone', 'approach', 'focus', 'depth', 'constraints'];
const formats = ['Bulleted list', 'Step-by-step guide', 'Table', 'Email', 'Social post', 'Article', 'Code with explanation', 'JSON'];
const tones = ['Clear and concise', 'Friendly', 'Professional', 'Persuasive', 'Creative', 'Educational'];
const depths = ['Quick', 'Balanced', 'Deep'];

function configuredProviders(env = process.env) {
  const available = {
    apmix: Boolean(env.APMIX_API_KEY && env.APMIX_BASE_URL && env.APMIX_MODEL),
    groq: Boolean(env.GROQ_API_KEY && env.GROQ_MODEL),
    gemini: Boolean(env.GEMINI_API_KEY)
  };
  const order = (env.AI_PROVIDER_ORDER || 'apmix,groq,gemini').split(',').map(name => name.trim().toLowerCase());
  return [...new Set(order)].filter(name => available[name]);
}

function normalizeDraft(input) {
  const data = {};
  for (const field of fieldNames) data[field] = typeof input?.[field] === 'string' ? input[field].trim().slice(0, 6000) : '';
  if (JSON.stringify(data).length > 18000) throw new Error('Draft is too long.');
  if (!data.task) throw new Error('Add a task before enhancing.');
  return data;
}

function parseSuggestion(content, original) {
  if (typeof content !== 'string') throw new Error('Empty AI response');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Invalid AI response');
  const parsed = JSON.parse(content.slice(start, end + 1));
  const result = {};
  for (const field of fieldNames) result[field] = typeof parsed[field] === 'string' ? parsed[field].trim().slice(0, 6000) : original[field];
  if (!result.task) result.task = original.task;
  if (!formats.includes(result.format)) result.format = original.format;
  if (!tones.includes(result.tone)) result.tone = original.tone;
  if (!depths.includes(result.depth)) result.depth = original.depth;
  return result;
}

function normalizeIdea(input) {
  const idea = typeof input?.idea === 'string' ? input.idea.trim() : '';
  if (idea.length < 4) throw new Error('Describe your idea in a few words.');
  if (idea.length > 6000) throw new Error('Idea is too long.');
  return idea;
}

function parseIdeaSuggestion(content, idea) {
  if (typeof content !== 'string') throw new Error('Empty AI response');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Invalid AI response');
  const parsed = JSON.parse(content.slice(start, end + 1));
  const source = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
  const data = {};
  for (const field of fieldNames) data[field] = typeof source[field] === 'string' ? source[field].trim().slice(0, 6000) : '';
  if (!data.task || !data.focus) throw new Error('Incomplete AI response');
  if (!formats.includes(data.format)) data.format = '';
  if (!tones.includes(data.tone)) data.tone = '';
  if (!depths.includes(data.depth)) data.depth = 'Balanced';
  const raw = parsed.interpretation || {};
  const list = (value, limit) => Array.isArray(value) ? value.filter(item => typeof item === 'string').map(item => item.trim().slice(0, 160)).filter(Boolean).slice(0, limit) : [];
  const interpretation = {
    goal: typeof raw.goal === 'string' ? raw.goal.trim().slice(0, 180) : data.task.slice(0, 180),
    whyThisDepth: typeof raw.whyThisDepth === 'string' ? raw.whyThisDepth.trim().slice(0, 240) : '',
    focusAreas: list(raw.focusAreas, 4),
    missingDetails: list(raw.missingDetails, 3)
  };
  if (!interpretation.focusAreas.length) interpretation.focusAreas = data.focus.split(/\n|;/).map(item => item.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).slice(0, 4);
  return { idea, data, interpretation };
}

function providerRequest(provider, messages, env) {
  if (provider === 'gemini') {
    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: { contents: [{ role: 'user', parts: [{ text: `${messages[0].content}\n\nDraft:\n${messages[1].content}` }] }], generationConfig: { responseMimeType: 'application/json' } },
      extract: json => json.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')
    };
  }
  const base = provider === 'apmix' ? env.APMIX_BASE_URL : 'https://api.groq.com/openai/v1';
  const endpoint = base.replace(/\/+$/, '').replace(/\/chat\/completions$/, '') + '/chat/completions';
  if (new URL(endpoint).protocol !== 'https:') throw new Error('Provider URL must use HTTPS');
  return {
    url: endpoint,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider === 'apmix' ? env.APMIX_API_KEY : env.GROQ_API_KEY}` },
    body: { model: provider === 'apmix' ? env.APMIX_MODEL : env.GROQ_MODEL, messages, max_tokens: 1600 },
    extract: json => json.choices?.[0]?.message?.content
  };
}

async function generateWithProviders(messages, parse, env, request) {
  const providers = configuredProviders(env);
  if (!providers.length) throw new Error('No AI provider is configured.');
  const timeout = Math.min(Math.max(Number(env.AI_REQUEST_TIMEOUT_MS) || 12000, 1000), 60000);
  const maxAttempts = Math.min(providers.length, Math.max(1, (Number(env.AI_MAX_FALLBACKS) || 0) + 1));
  for (const provider of providers.slice(0, maxAttempts)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config = providerRequest(provider, messages, env);
        const response = await request(config.url, { method: 'POST', headers: config.headers, body: JSON.stringify(config.body), signal: AbortSignal.timeout(timeout) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = config.extract(await response.json());
        return { ...parse(content), provider };
      } catch (error) {
        if (attempt === 0 && error.message === 'fetch failed') { await new Promise(resolve => setTimeout(resolve, 250)); continue; }
        console.warn(`AI provider ${provider} failed: ${error.message?.slice(0, 100) || 'Unknown error'}`);
        break;
      }
    }
  }
  throw new Error('AI suggestions are temporarily unavailable. Please try again.');
}

async function enhanceWithAI(input, env = process.env, request = fetch) {
  const original = normalizeDraft(input);
  const system = `You improve prompts for use with AI assistants. Return only a JSON object with these string keys: ${fieldNames.join(', ')}. Improve clarity and specificity while preserving the user's intent. Do not answer the task. Do not invent facts or requirements. Keep existing details. Leave unknown details blank. Format must be one of: ${formats.join(', ')}. Tone must be one of: ${tones.join(', ')}. Depth must be Quick, Balanced, or Deep. Use empty strings when no format or tone fits.`;
  const messages = [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(original) }];
  return generateWithProviders(messages, content => ({ data: parseSuggestion(content, original) }), env, request);
}

async function ideaToPrompt(input, env = process.env, request = fetch) {
  const idea = normalizeIdea(input);
  const system = `You turn a person's rough idea into a useful prompt for another AI assistant. Return ONLY valid JSON with this shape: {"data":{"task":"","role":"","audience":"","context":"","format":"","tone":"","approach":"","focus":"","depth":"","constraints":""},"interpretation":{"goal":"","whyThisDepth":"","focusAreas":[],"missingDetails":[]}}. Preserve the person's intent and every stated constraint. Do not answer the idea. Do not invent facts, audience, deadlines, or requirements. Make task a clear action and deliverable. Infer the user's intended workflow and request intensity: Quick for a small or explicitly brief ask, Deep for complex plans, product design, builds, or requests stressing rigor, otherwise Balanced. For multi-step work, approach must describe 2 to 4 ordered stages, one per line, that lead to the deliverable; leave it blank for simple one-step asks. Focus must contain 2 to 4 specific, ranked priorities, separated by newlines; the target AI should spend the most effort on the first. Match depth to that intensity. Include only context the user supplied. When essential information is missing, list it in missingDetails, and have constraints tell the target AI to ask up to 3 targeted questions before making consequential assumptions; for minor gaps, tell it to state assumptions and proceed. Do not list optional business decisions as missing unless the user asked for a business plan. Choose format only from ${formats.join(', ')} or leave blank. Choose tone only from ${tones.join(', ')} or leave blank. Give a brief plain-language goal and whyThisDepth, 2 to 4 focusAreas, and at most 3 missingDetails. Use concise, concrete language; avoid generic phrases like 'provide a detailed response'.`;
  const messages = [{ role: 'system', content: system }, { role: 'user', content: idea }];
  return generateWithProviders(messages, content => parseIdeaSuggestion(content, idea), env, request);
}

module.exports = { configuredProviders, normalizeDraft, normalizeIdea, parseSuggestion, parseIdeaSuggestion, enhanceWithAI, ideaToPrompt };
