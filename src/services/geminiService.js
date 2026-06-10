const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || '';
const ADMIN_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ADMIN_CEREBRAS_KEY = import.meta.env.VITE_CEREBRAS_API_KEY;
const ADMIN_GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

const GEMINI_MODEL = 'gemini-2.0-flash';
const CEREBRAS_MODEL = 'llama3.1-70b';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function callGemini(apiKey, prompt, jsonSchema = null, parts = null) {
  const contentParts = parts || [{ text: prompt }];
  const body = {
    contents: [{ role: 'user', parts: contentParts }],
  };
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
    const e = new Error(err.error?.message || `Gemini API error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (jsonSchema) {
    try { return JSON.parse(text); } catch { return {}; }
  }
  return text;
}

async function callOpenAICompat(baseURL, apiKey, model, prompt, jsonSchema = null) {
  const userContent = jsonSchema
    ? `${prompt}\n\nRespond with valid JSON matching this schema: ${JSON.stringify(jsonSchema)}`
    : prompt;

  const body = {
    model,
    messages: [{ role: 'user', content: userContent }],
  };
  if (jsonSchema) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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
  if (jsonSchema) {
    try { return JSON.parse(text); } catch { return {}; }
  }
  return text;
}

async function callCerebras(apiKey, prompt, jsonSchema = null) {
  return callOpenAICompat('https://api.cerebras.ai/v1', apiKey, CEREBRAS_MODEL, prompt, jsonSchema);
}

async function callGroq(apiKey, prompt, jsonSchema = null) {
  return callOpenAICompat('https://api.groq.com/openai/v1', apiKey, GROQ_MODEL, prompt, jsonSchema);
}

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

function shouldFallthrough(err) {
  return !err.status || err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404 || err.status >= 429;
}

async function withAdminFallback(geminiFn, cerebrasFn, groqFn) {
  if (ADMIN_GEMINI_KEY) {
    try { return await geminiFn(); } catch (err) {
      if (!shouldFallthrough(err)) throw err;
    }
  }
  if (ADMIN_CEREBRAS_KEY) {
    try { return await cerebrasFn(); } catch (err) {
      if (!shouldFallthrough(err)) throw err;
    }
  }
  if (ADMIN_GROQ_KEY) {
    return groqFn();
  }
  throw new Error('All admin AI keys exhausted or unavailable');
}

export async function invokeGemini(prompt, jsonSchema = null, uid = '', userApiKey = '') {
  if (uid === ADMIN_UID) {
    return withAdminFallback(
      () => callGemini(ADMIN_GEMINI_KEY, prompt, jsonSchema),
      () => callCerebras(ADMIN_CEREBRAS_KEY, prompt, jsonSchema),
      () => callGroq(ADMIN_GROQ_KEY, prompt, jsonSchema)
    );
  }

  if (!userApiKey) throw new Error('No API key configured');
  return callGemini(userApiKey, prompt, jsonSchema);
}

// Runs one step of an agentic loop with Gemini function calling.
// contents: [{role:'user'|'model', parts:[...]}]
// Returns the model's content object ({role, parts}) which may contain functionCall parts or text.
async function callGeminiAgentStep(apiKey, contents, toolDeclarations, systemPrompt) {
  const body = { contents };
  if (toolDeclarations?.length) {
    body.tools = [{ functionDeclarations: toolDeclarations }];
    body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
  }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
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
  const apiKey = uid === ADMIN_UID ? ADMIN_GEMINI_KEY : userApiKey;
  if (!apiKey) throw new Error('No API key configured');
  return callGeminiAgentStep(apiKey, contents, toolDeclarations, systemPrompt);
}

export async function transcribeAudio(audioBlob, uid = '', userApiKey = '') {
  const arrayBuffer = await audioBlob.arrayBuffer();
  // Chunk the conversion to avoid stack overflow on large audio files
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
    if (ADMIN_GEMINI_KEY) {
      try { return await callGemini(ADMIN_GEMINI_KEY, '', null, parts); } catch (err) {
        if (err.status !== 429 && err.status !== 503) throw err;
      }
    }
    // Cerebras has no audio support — skip to Groq
    if (ADMIN_GROQ_KEY) {
      return transcribeWithGroq(ADMIN_GROQ_KEY, audioBlob);
    }
    throw new Error('All admin transcription keys exhausted or unavailable');
  }

  if (!userApiKey) throw new Error('No API key configured');
  return callGemini(userApiKey, '', null, parts);
}
