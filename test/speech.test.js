const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_AUDIO_BYTES, normalizeAudioType, transcribeAudio } = require('../speech');

test('audio MIME types are checked before upload', () => {
  assert.deepEqual(normalizeAudioType('audio/webm;codecs=opus'), { mime: 'audio/webm', extension: 'webm' });
  assert.deepEqual(normalizeAudioType('audio/mp4'), { mime: 'audio/mp4', extension: 'mp4' });
  assert.throws(() => normalizeAudioType('text/plain'), /not supported/);
});

test('transcription sends audio as a multipart file and returns text', async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ text: '  I want a study app.  ' }) };
  };
  const text = await transcribeAudio(Buffer.alloc(256, 1), 'audio/webm;codecs=opus', { GROQ_API_KEY: 'test-key' }, fakeFetch);
  assert.equal(text, 'I want a study app.');
  assert.equal(request.url, 'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(request.options.body.get('model'), 'whisper-large-v3-turbo');
  assert.equal(request.options.body.get('file').name, 'idea.webm');
  assert.equal(request.options.body.get('file').type, 'audio/webm');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
});

test('short, oversized, and silent recordings do not produce prompts', async () => {
  const env = { GROQ_API_KEY: 'test-key' };
  await assert.rejects(transcribeAudio(Buffer.alloc(20), 'audio/webm', env), /too short/);
  await assert.rejects(transcribeAudio(Buffer.alloc(MAX_AUDIO_BYTES + 1), 'audio/webm', env), /too large/);
  await assert.rejects(transcribeAudio(Buffer.alloc(256), 'audio/webm', env, async () => ({ ok: true, json: async () => ({ text: '  ' }) })), /No speech/);
});
