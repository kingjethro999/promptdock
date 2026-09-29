const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);

const fieldNames = ['task', 'role', 'audience', 'context', 'format', 'tone', 'constraints'];
const formats = ['Bulleted list', 'Step-by-step guide', 'Table', 'Email', 'Social post', 'Article', 'Code with explanation', 'JSON'];
const tones = ['Clear and concise', 'Friendly', 'Professional', 'Persuasive', 'Creative', 'Educational'];

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
  return result;
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

async function enhanceWithAI(input, env = process.env, request = fetch) {
  const original = normalizeDraft(input);
  const providers = configuredProviders(env);
  if (!providers.length) throw new Error('No AI provider is configured.');
  const system = `You improve prompts for use with AI assistants. Return only a JSON object with these string keys: ${fieldNames.join(', ')}. Improve clarity and specificity while preserving the user's intent. Do not answer the task. Do not invent facts or requirements. Keep existing details. Leave unknown details blank. Format must be one of: ${formats.join(', ')}. Tone must be one of: ${tones.join(', ')}. Use empty strings when no format or tone fits.`;
  const messages = [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(original) }];
  const timeout = Math.min(Math.max(Number(env.AI_REQUEST_TIMEOUT_MS) || 12000, 1000), 60000);
  const maxAttempts = Math.min(providers.length, Math.max(1, (Number(env.AI_MAX_FALLBACKS) || 0) + 1));
  for (const provider of providers.slice(0, maxAttempts)) {
    try {
      const config = providerRequest(provider, messages, env);
      const response = await request(config.url, { method: 'POST', headers: config.headers, body: JSON.stringify(config.body), signal: AbortSignal.timeout(timeout) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = config.extract(await response.json());
      return { data: parseSuggestion(content, original), provider };
    } catch (error) {
      console.warn(`AI provider ${provider} failed: ${error.message?.slice(0, 100) || 'Unknown error'}`);
    }
  }
  throw new Error('AI suggestions are temporarily unavailable. Please try again.');
}

module.exports = { configuredProviders, normalizeDraft, parseSuggestion, enhanceWithAI };
