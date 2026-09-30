const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const audioTypes = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/x-m4a": "m4a",
};

function normalizeAudioType(contentType) {
  const mime = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!Object.hasOwn(audioTypes, mime))
    throw new Error("This audio format is not supported.");
  return { mime, extension: audioTypes[mime] };
}

async function transcribeAudio(
  audio,
  contentType,
  env = process.env,
  request = fetch,
) {
  if (!env.GROQ_API_KEY)
    throw new Error("Voice transcription is not configured.");
  const { mime, extension } = normalizeAudioType(contentType);
  if (!Buffer.isBuffer(audio) || audio.length < 100)
    throw new Error("Recording is too short. Try speaking again.");
  if (audio.length > MAX_AUDIO_BYTES)
    throw new Error("Recording is too large. Keep it under 4 MB.");

  const form = new FormData();
  form.append("file", new Blob([audio], { type: mime }), `idea.${extension}`);
  form.append(
    "model",
    env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
  );
  form.append("response_format", "json");
  const timeout = Math.min(
    Math.max(Number(env.TRANSCRIPTION_TIMEOUT_MS) || 45000, 5000),
    120000,
  );
  let response;
  try {
    response = await request(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(timeout),
      },
    );
  } catch {
    throw new Error("Transcription is unavailable. Please try again.");
  }
  if (!response.ok)
    throw new Error("Transcription is unavailable. Please try again.");
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Transcription returned an invalid response.");
  }
  const text = typeof result.text === "string" ? result.text.trim() : "";
  if (!text) throw new Error("No speech was detected. Try speaking again.");
  if (text.length > 6000)
    throw new Error("Transcript is too long. Try a shorter recording.");
  return text;
}

module.exports = { MAX_AUDIO_BYTES, normalizeAudioType, transcribeAudio };
