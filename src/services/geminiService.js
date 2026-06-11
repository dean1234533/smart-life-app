const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || '';

// ── Admin API keys (fallback chain — any missing keys are simply skipped) ───
const ADMIN_GEMINI_KEY     = import.meta.env.VITE_GEMINI_API_KEY;
const ADMIN_GROQ_KEY       = import.meta.env.VITE_GROQ_API_KEY;
const ADMIN_CEREBRAS_KEY   = import.meta.env.VITE_CEREBRAS_API_KEY;
const ADMIN_MISTRAL_KEY    = import.meta.env.VITE_MISTRAL_API_KEY;
const ADMIN_TOGETHER_KEY   = import.meta.env.VITE_TOGETHER_API_KEY;
const ADMIN_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

const GEMINI_MODEL     = 'gemini-2.0-flash';
const GROQ_MODEL       = 'llama-3.3-70b-versatile';
const CEREBRAS_MODEL   = 'llama3.1-70b';
const MISTRAL_MODEL    = 'mistral-small-latest';
const TOGETHER_MODEL   = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
const OPENROUTER_MODEL = 'mistralai/mistral-7b-instruct:free';

// ── Local AI helpers ──────────────────────────────────────────────────────────

function hasChromeAI() {
  return typeof window !== 'undefined' && !!window.ai?.languageModel;
}

function hasOllama() {
  try { return !!localStorage.getItem('local_ai_url'); } catch { return false; }
}

// Chrome's built-in Gemini Nano — zero credits, runs fully on-device.
async function callChromeAI(prompt, jsonSchema) {
  if (!window.ai?.languageModel) throw new Error('Chrome AI not available');
  const caps = await window.ai.languageModel.capabilities();
  if (caps.available === 'no') throw new Error('Chrome AI model not available on this device');
  const session = await window.ai.languageModel.create({});
  try {
    const text = jsonSchema
      ? `${prompt}\n\nRespond ONLY with valid JSON (no markdown fences) matching:\n${JSON.stringify(jsonSchema)}`
      : prompt;
    const result = await session.prompt(text);
    if (jsonSchema) { try { return JSON.parse(result); } catch { return {}; } }
    return result;
  } finally {
    session.destroy();
  }
}

// Ollama local server — runs models on the user's own machine / home server.
async function callOllama(prompt, jsonSchema) {
  const baseUrl = localStorage.getItem('local_ai_url');
  const model   = localStorage.getItem('local_ai_model') || 'llama3.2';
  if (!baseUrl) throw new Error('Ollama not configured');
  const userContent = jsonSchema
    ? `${prompt}\n\nRespond ONLY with valid JSON (no markdown fences) matching:\n${JSON.stringify(jsonSchema)}`
    : prompt;
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: userContent }], stream: false }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const e = new Error(`Ollama error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  const text = data.message?.content || '';
  if (jsonSchema) { try { return JSON.parse(text); } catch { return {}; } }
  return text;
}

// Returns the two local providers as [sentinel, fn] tuples ready for runWithFallback.
// Using boolean true/false as the "key" — truthy means the provider is available.
function localProviders(prompt, jsonSchema) {
  return [
    [hasChromeAI() || '', () => callChromeAI(prompt, jsonSchema)],
    [hasOllama()   || '', () => callOllama(prompt, jsonSchema)],
  ];
}

// ── Provider callers ─────────────────────────────────────────────────────────

async function callGemini(apiKey, prompt, jsonSchema = null, parts = null) {
  const contentParts = parts || [{ text: prompt }];
  const body = { contents: [{ role: 'user', parts: contentParts }] };
  if (jsonSchema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: jsonSchema,
    };
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error?.message || `Gemini error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (jsonSchema) { try { return JSON.parse(text); } catch { return {}; } }
  return text;
}

async function callOpenAICompat(baseURL, apiKey, model, prompt, jsonSchema = null, extraHeaders = {}) {
  const userContent = jsonSchema
    ? `${prompt}\n\nRespond with valid JSON matching this schema: ${JSON.stringify(jsonSchema)}`
    : prompt;
  const body = { model, messages: [{ role: 'user', content: userContent }] };
  if (jsonSchema) body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error?.message || `API error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (jsonSchema) { try { return JSON.parse(text); } catch { return {}; } }
  return text;
}

const callGroq       = (k, p, s) => callOpenAICompat('https://api.groq.com/openai/v1', k, GROQ_MODEL, p, s);
const callCerebras   = (k, p, s) => callOpenAICompat('https://api.cerebras.ai/v1', k, CEREBRAS_MODEL, p, s);
const callMistral    = (k, p, s) => callOpenAICompat('https://api.mistral.ai/v1', k, MISTRAL_MODEL, p, s);
const callTogether   = (k, p, s) => callOpenAICompat('https://api.together.xyz/v1', k, TOGETHER_MODEL, p, s);
const callOpenRouter = (k, p, s) => callOpenAICompat(
  'https://openrouter.ai/api/v1', k, OPENROUTER_MODEL, p, s,
  { 'HTTP-Referer': 'https://smart-life-app.pages.dev', 'X-Title': 'Smart Life App' }
);

// ── Transcription ─────────────────────────────────────────────────────────────

async function transcribeWithGroq(apiKey, audioBlob) {
  const ext = audioBlob.type?.includes('mp4') ? 'mp4'
    : audioBlob.type?.includes('ogg') ? 'ogg'
    : audioBlob.type?.includes('wav') ? 'wav'
    : 'webm';
  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${ext}`);
  formData.append('model', 'whisper-large-v3');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error?.message || `Groq transcription error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  return data.text || '';
}

// ── Fallback engine ───────────────────────────────────────────────────────────

// Falls through on: no response, wrong/expired key (401/403), quota/credits (402/429), server errors (5xx).
// Does NOT fall through on unexpected client errors (405, 422, etc.) that indicate a code bug.
function shouldFallthrough(err) {
  const s = err.status;
  return !s || s === 400 || s === 401 || s === 402 || s === 403 || s === 404 || s >= 429;
}

// Tries each [key, fn] pair in order, skipping missing keys, falling through on recoverable errors.
// The "key" can be any truthy sentinel — local providers use boolean true.
async function runWithFallback(providers) {
  const available = providers.filter(([key]) => !!key);
  if (available.length === 0) throw new Error('No AI configured — add a local AI in Settings or an API key');
  for (let i = 0; i < available.length; i++) {
    const [key, fn] = available[i];
    const isLast = i === available.length - 1;
    try {
      return await fn(key);
    } catch (err) {
      if (isLast || !shouldFallthrough(err)) throw err;
      // else: try next provider
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function invokeGemini(prompt, jsonSchema = null, uid = '', userApiKey = '') {
  // Local providers always come first — they use the device's own resources, no credits consumed.
  const local = localProviders(prompt, jsonSchema);

  if (uid === ADMIN_UID) {
    return runWithFallback([
      ...local,
      [ADMIN_GEMINI_KEY,     (k) => callGemini(k, prompt, jsonSchema)],
      [ADMIN_GROQ_KEY,       (k) => callGroq(k, prompt, jsonSchema)],
      [ADMIN_CEREBRAS_KEY,   (k) => callCerebras(k, prompt, jsonSchema)],
      [ADMIN_MISTRAL_KEY,    (k) => callMistral(k, prompt, jsonSchema)],
      [ADMIN_TOGETHER_KEY,   (k) => callTogether(k, prompt, jsonSchema)],
      [ADMIN_OPENROUTER_KEY, (k) => callOpenRouter(k, prompt, jsonSchema)],
    ]);
  }

  return runWithFallback([
    ...local,
    ...(userApiKey ? [[userApiKey, (k) => callGemini(k, prompt, jsonSchema)]] : []),
  ]);
}

// Agent function calling — Gemini-only (other providers don't support this API format).
// Falls back to plain text via the full chain if Gemini is unavailable.
async function callGeminiAgentStep(apiKey, contents, toolDeclarations, systemPrompt) {
  const body = { contents };
  if (toolDeclarations?.length) {
    body.tools = [{ functionDeclarations: toolDeclarations }];
    body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
  }
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error?.message || `Gemini API error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  return data.candidates?.[0]?.content || null;
}

export async function invokeGeminiAgent(contents, toolDeclarations, systemPrompt, uid = '', userApiKey = '') {
  // Try Gemini (required for function calling)
  const geminiKey = uid === ADMIN_UID ? ADMIN_GEMINI_KEY : userApiKey;
  if (geminiKey) {
    try {
      return await callGeminiAgentStep(geminiKey, contents, toolDeclarations, systemPrompt);
    } catch (err) {
      if (!shouldFallthrough(err)) throw err;
      // Gemini down/over-quota — fall back to plain text via the chain (no tool calls)
    }
  }

  // Plain-text fallback: strip tool declarations, use any available provider
  const lastUserMsg = [...contents].reverse().find(c => c.role === 'user');
  const text = lastUserMsg?.parts?.find(p => p.text)?.text || '';
  const local = localProviders(text, null);

  const plainText = await runWithFallback([
    ...local,
    ...(uid === ADMIN_UID ? [
      [ADMIN_GROQ_KEY,       (k) => callGroq(k, text)],
      [ADMIN_CEREBRAS_KEY,   (k) => callCerebras(k, text)],
      [ADMIN_MISTRAL_KEY,    (k) => callMistral(k, text)],
      [ADMIN_TOGETHER_KEY,   (k) => callTogether(k, text)],
      [ADMIN_OPENROUTER_KEY, (k) => callOpenRouter(k, text)],
    ] : []),
  ]);
  return { role: 'model', parts: [{ text: plainText }] };
}

export async function transcribeAudio(audioBlob, uid = '', userApiKey = '') {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const base64 = btoa(binary);
  const mimeType = audioBlob.type || 'audio/webm';
  const parts = [
    { inlineData: { mimeType, data: base64 } },
    { text: 'Transcribe this audio recording word for word. Return only the transcription text, nothing else.' },
  ];

  if (uid === ADMIN_UID) {
    // Gemini supports audio natively
    if (ADMIN_GEMINI_KEY) {
      try { return await callGemini(ADMIN_GEMINI_KEY, '', null, parts); } catch (err) {
        if (!shouldFallthrough(err)) throw err;
      }
    }
    // Groq Whisper is the only other transcription option
    if (ADMIN_GROQ_KEY) return transcribeWithGroq(ADMIN_GROQ_KEY, audioBlob);
    throw new Error('No transcription key available — add VITE_GEMINI_API_KEY or VITE_GROQ_API_KEY');
  }

  if (!userApiKey) throw new Error('No API key configured');
  return callGemini(userApiKey, '', null, parts);
}

// ── Exported helpers for Settings UI ─────────────────────────────────────────

export async function getChromeAIStatus() {
  if (!window.ai?.languageModel) return 'unavailable';
  try {
    const caps = await window.ai.languageModel.capabilities();
    return caps.available; // 'readily' | 'after-download' | 'no'
  } catch {
    return 'unavailable';
  }
}

export async function testOllamaConnection(url, model) {
  const base = url.replace(/\/$/, '');
  const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  const data = await res.json();
  const models = data.models?.map(m => m.name) || [];
  const found = models.some(m => m.startsWith(model.split(':')[0]));
  return { models, found };
}
