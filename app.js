const STORAGE_KEY = 'promptdock.prompts.v1';
const DRAFT_KEY = 'promptdock.draft.v1';
const fields = ['task', 'role', 'audience', 'context', 'format', 'tone', 'approach', 'focus', 'depth', 'constraints'];
const templates = [
  { id: 'writing', icon: '✎', name: 'Write anything', data: { task: 'Write a compelling piece about [topic]', role: 'An experienced writer', audience: '[target audience]', context: 'The key idea is [main idea]. The reader should come away knowing [takeaway].', format: 'Article', tone: 'Clear and concise', constraints: 'Use specific examples. Avoid filler and jargon.' } },
  { id: 'research', icon: '⌕', name: 'Research a topic', data: { task: 'Research [topic] and summarize the most useful findings', role: 'A careful research analyst', audience: 'A curious non-expert', context: 'I need this research to help me decide [decision or goal].', format: 'Bulleted list', tone: 'Educational', constraints: 'Separate established facts from uncertainty. Cite sources when available and say when you cannot verify a claim.' } },
  { id: 'code', icon: '⌘', name: 'Explain code', data: { task: 'Explain how this code works and suggest improvements', role: 'A patient senior software engineer', audience: 'A developer learning this codebase', context: 'Language and framework: [add details]. Code: [paste code here].', format: 'Code with explanation', tone: 'Educational', constraints: 'Explain the main flow first. Flag correctness and security issues. Show improved code only where useful.' } },
  { id: 'brainstorm', icon: '✳', name: 'Brainstorm ideas', data: { task: 'Generate fresh ideas for [project or problem]', role: 'A creative strategist', audience: '[who the ideas are for]', context: 'Goal: [desired result]. Resources and limitations: [details].', format: 'Bulleted list', tone: 'Creative', constraints: 'Include practical and unexpected ideas. Give each idea a short explanation and one first step.' } },
  { id: 'summarize', icon: '▤', name: 'Summarize content', data: { task: 'Summarize the following content: [paste content]', role: 'A clear and precise editor', audience: 'Someone who needs the key points quickly', context: 'The most important question I need answered is [question].', format: 'Bulleted list', tone: 'Clear and concise', constraints: 'Preserve the original meaning. Highlight key decisions, numbers, and open questions. Do not invent details.' } }
];
const platformUrls = { chatgpt: 'https://chatgpt.com/', claude: 'https://claude.ai/new', gemini: 'https://gemini.google.com/app' };
const selectOptions = {
  format: ['Bulleted list', 'Step-by-step guide', 'Table', 'Email', 'Social post', 'Article', 'Code with explanation', 'JSON'],
  tone: ['Clear and concise', 'Friendly', 'Professional', 'Persuasive', 'Creative', 'Educational'],
  depth: ['Quick', 'Balanced', 'Deep']
};

const elements = Object.fromEntries(fields.map(field => [field, document.getElementById(field)]));
const $ = id => document.getElementById(id);
let currentId = null;
let toastTimer;
let aiAvailable = false;
let aiBusy = false;
let currentAnalysis = null;
let voiceAvailable = false;
let voiceState = 'idle';
let voiceRecorder = null;
let voiceStream = null;
let voiceChunks = [];
let voiceCancelled = false;
let voiceStartedAt = 0;
let voiceTimer = null;
let voiceRequestId = 0;
let voiceCancelReason = '';

function readJSON(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
  catch { return fallback; }
}
function dataFromForm() { return Object.fromEntries(fields.map(field => [field, elements[field].value.trim()])); }
function setForm(data) { fields.forEach(field => { elements[field].value = data[field] || ''; }); Object.keys(selectOptions).forEach(syncSelect); updatePreview(); persistDraft(); }
function getSaved() { const saved = readJSON(STORAGE_KEY, []); return Array.isArray(saved) ? saved : []; }
function setSaved(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); renderLibrary(); }
function persistDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: dataFromForm(), idea: $('ideaInput').value, analysis: currentAnalysis })); } catch {} }
function showToast(message) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3200); }

function syncSelect(name) {
  const wrapper = document.querySelector(`[data-select="${name}"]`);
  const value = elements[name].value;
  const trigger = wrapper.querySelector('.select-trigger');
  trigger.firstElementChild.textContent = value || (name === 'format' ? 'Choose a format' : name === 'tone' ? 'Choose a tone' : 'Choose depth');
  trigger.classList.toggle('has-value', Boolean(value));
  wrapper.querySelectorAll('.select-option').forEach(option => {
    option.setAttribute('aria-selected', String(option.dataset.value === value));
    option.querySelector('.select-check').textContent = option.dataset.value === value ? '✓' : '';
  });
}

function closeSelect(wrapper, restoreFocus = false) {
  wrapper.classList.remove('open');
  wrapper.querySelector('.select-trigger').setAttribute('aria-expanded', 'false');
  if (restoreFocus) wrapper.querySelector('.select-trigger').focus();
}

function initCustomSelects() {
  Object.entries(selectOptions).forEach(([name, values]) => {
    const wrapper = document.querySelector(`[data-select="${name}"]`);
    const trigger = wrapper.querySelector('.select-trigger');
    const menu = wrapper.querySelector('.select-menu');
    for (const value of ['', ...values]) {
      const option = document.createElement('button');
      option.type = 'button'; option.className = 'select-option'; option.dataset.value = value;
      option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
      const label = document.createElement('span'); label.textContent = value || `Choose ${name}`;
      const check = document.createElement('span'); check.className = 'select-check';
      option.append(label, check);
      option.addEventListener('click', () => { elements[name].value = value; elements[name].dispatchEvent(new Event('change', { bubbles: true })); syncSelect(name); closeSelect(wrapper, true); });
      menu.append(option);
    }
    trigger.addEventListener('click', () => {
      const opening = !wrapper.classList.contains('open');
      document.querySelectorAll('.custom-select.open').forEach(open => closeSelect(open));
      wrapper.classList.toggle('open', opening); trigger.setAttribute('aria-expanded', String(opening));
      if (opening) menu.querySelector(`[data-value="${CSS.escape(elements[name].value)}"]`)?.focus();
    });
    wrapper.addEventListener('keydown', event => {
      if (event.key === 'Escape') { closeSelect(wrapper, true); event.preventDefault(); return; }
      if (!wrapper.classList.contains('open') && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { trigger.click(); event.preventDefault(); return; }
      if (!wrapper.classList.contains('open') || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const options = [...menu.querySelectorAll('.select-option')];
      const current = options.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus(); event.preventDefault();
    });
  });
  document.addEventListener('pointerdown', event => { document.querySelectorAll('.custom-select.open').forEach(wrapper => { if (!wrapper.contains(event.target)) closeSelect(wrapper); }); });
}

function setComposerExpanded(expanded) {
  $('promptForm').classList.toggle('collapsed', !expanded);
  $('toggleComposer').setAttribute('aria-expanded', String(expanded));
  $('toggleComposer').textContent = expanded ? 'Hide details ⌃' : 'Edit details ⌄';
  document.querySelector('.composer-card').classList.toggle('is-collapsed', !expanded);
}

function renderInterpretation(analysis) {
  $('interpretationCard').classList.toggle('hidden', !analysis);
  if (!analysis) return;
  $('ideaGoal').textContent = analysis.goal || '';
  $('ideaDepthReason').textContent = analysis.originalDepth && analysis.originalDepth !== elements.depth.value
    ? `You changed the answer depth from ${analysis.originalDepth} to ${elements.depth.value || 'an unspecified depth'}.`
    : analysis.whyThisDepth || '';
  $('ideaDepthBadge').textContent = `${elements.depth.value || 'Balanced'} depth`;
  const makeItem = value => { const item = document.createElement('li'); item.textContent = value; return item; };
  $('ideaFocusAreas').replaceChildren(...(analysis.focusAreas || []).map(makeItem));
  renderApproach();
  $('ideaMissingDetails').replaceChildren(...(analysis.missingDetails || []).map(makeItem));
  $('missingDetails').classList.toggle('hidden', !analysis.missingDetails?.length);
}

function renderApproach() {
  const steps = elements.approach.value.split(/\n/).map(item => item.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).slice(0, 4);
  $('ideaApproach').replaceChildren(...steps.map(value => { const item = document.createElement('li'); item.textContent = value; return item; }));
  $('ideaApproachSection').classList.toggle('hidden', !steps.length);
}

function updateIdeaButton() {
  $('ideaGenerateButton').disabled = !aiAvailable || aiBusy || voiceState !== 'idle' || $('ideaInput').value.trim().length < 4;
  updateVoiceControls();
}

function updateVoiceControls() {
  const button = $('micButton');
  button.classList.toggle('recording', voiceState === 'recording');
  button.classList.toggle('processing', voiceState === 'transcribing' || voiceState === 'requesting');
  $('voiceCancelButton').classList.toggle('hidden', voiceState !== 'recording');
  if (voiceState === 'recording') {
    const seconds = Math.floor((Date.now() - voiceStartedAt) / 1000);
    const label = `Stop & send ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('micButtonLabel').textContent = label;
    button.setAttribute('aria-label', label);
    button.disabled = false;
  } else if (voiceState === 'transcribing' || voiceState === 'requesting') {
    const label = voiceState === 'requesting' ? 'Allow mic…' : 'Transcribing…';
    $('micButtonLabel').textContent = label;
    button.setAttribute('aria-label', label);
    button.disabled = true;
  } else {
    $('micButtonLabel').textContent = 'Record idea';
    button.setAttribute('aria-label', 'Record idea');
    button.disabled = !voiceAvailable || aiBusy || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined';
  }
}

function stopVoiceTracks() {
  if (voiceTimer) clearInterval(voiceTimer);
  voiceTimer = null;
  voiceStream?.getTracks().forEach(track => track.stop());
  voiceStream = null;
}

async function finishVoiceRecording(mimeType) {
  stopVoiceTracks();
  const cancelled = voiceCancelled;
  const audio = new Blob(voiceChunks, { type: mimeType || voiceChunks[0]?.type || 'audio/webm' });
  voiceRecorder = null;
  voiceChunks = [];
  if (cancelled) { voiceState = 'idle'; $('voiceStatus').textContent = voiceCancelReason || 'Recording discarded.'; updateIdeaButton(); return; }
  voiceState = 'transcribing'; updateIdeaButton();
  $('voiceStatus').textContent = 'Transcribing your idea…';
  try {
    const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': audio.type }, body: audio });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not transcribe the recording.');
    const transcript = result.text?.trim();
    if (!transcript) throw new Error('No speech was detected. Try speaking again.');
    const existing = $('ideaInput').value.trim();
    const combined = existing ? `${existing}\n${transcript}` : transcript;
    if (combined.length > 6000) throw new Error('The combined idea is too long. Shorten it and try again.');
    $('ideaInput').value = combined;
    $('ideaInput').dispatchEvent(new Event('input'));
    voiceState = 'idle'; updateIdeaButton();
    $('voiceStatus').textContent = 'Transcribed. Sending your idea to AI…';
    const sent = await generateIdeaPrompt();
    $('voiceStatus').textContent = sent ? 'Voice idea transcribed and sent.' : 'Transcript added. Use Turn idea into prompt to try again.';
  } catch (error) {
    voiceState = 'idle'; updateIdeaButton();
    $('voiceStatus').textContent = error.message || 'Voice recording could not be sent.';
    showToast($('voiceStatus').textContent);
  }
}

async function startVoiceRecording() {
  if (voiceState !== 'idle' || aiBusy || !voiceAvailable) return;
  const requestId = ++voiceRequestId;
  voiceState = 'requesting';
  $('voiceStatus').textContent = 'Waiting for microphone permission…';
  updateIdeaButton();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (requestId !== voiceRequestId) { stream.getTracks().forEach(track => track.stop()); return; }
    voiceStream = stream;
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported?.(type));
    voiceRecorder = new MediaRecorder(voiceStream, mimeType ? { mimeType } : undefined);
    voiceChunks = [];
    voiceCancelled = false;
    voiceCancelReason = '';
    voiceRecorder.addEventListener('dataavailable', event => { if (event.data?.size) voiceChunks.push(event.data); });
    voiceRecorder.addEventListener('stop', () => { finishVoiceRecording(voiceRecorder?.mimeType || mimeType); }, { once: true });
    voiceRecorder.addEventListener('error', () => { voiceCancelReason = 'Recording failed. Try again.'; stopVoiceRecording(false); });
    voiceRecorder.start();
    voiceState = 'recording';
    voiceStartedAt = Date.now();
    voiceTimer = setInterval(() => {
      updateVoiceControls();
      if (Date.now() - voiceStartedAt >= 120000) {
        voiceCancelReason = 'Two-minute limit reached. Recording discarded; try a shorter idea.';
        stopVoiceRecording(false);
      }
    }, 500);
    $('voiceStatus').textContent = 'Recording. Choose Stop & send to transcribe, or Cancel to discard.';
    updateIdeaButton();
  } catch (error) {
    if (requestId !== voiceRequestId) return;
    stopVoiceTracks(); voiceRecorder = null; voiceState = 'idle'; updateIdeaButton();
    $('voiceStatus').textContent = error.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser settings.' : 'Microphone is unavailable. Try typing your idea.';
    showToast($('voiceStatus').textContent);
  }
}

function stopVoiceRecording(send) {
  if (voiceState !== 'recording' || !voiceRecorder) return;
  voiceCancelled = !send;
  voiceState = 'transcribing';
  if (!send) $('voiceStatus').textContent = 'Discarding recording…';
  else $('voiceStatus').textContent = 'Finishing recording…';
  updateIdeaButton();
  try { voiceRecorder.stop(); }
  catch { voiceCancelled = true; stopVoiceTracks(); voiceRecorder = null; voiceState = 'idle'; $('voiceStatus').textContent = 'Recording stopped unexpectedly. Try again.'; updateIdeaButton(); }
  if (!send) stopVoiceTracks();
}

async function generateIdeaPrompt() {
  const idea = $('ideaInput').value.trim();
  if (!aiAvailable || aiBusy || voiceState !== 'idle' || idea.length < 4) return false;
  aiBusy = true;
  $('ideaGenerateButton').classList.add('busy');
  $('ideaStatus').textContent = 'Reading your idea and shaping the prompt…';
  updateIdeaButton(); updatePreview();
  try {
    const response = await fetch('/api/idea-to-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not turn this idea into a prompt.');
    if (idea !== $('ideaInput').value.trim()) { $('ideaStatus').textContent = 'Your idea changed. Run it again when ready.'; return false; }
    currentId = null;
    currentAnalysis = { ...result.interpretation, originalDepth: result.data.depth };
    setForm(result.data);
    renderInterpretation(currentAnalysis);
    $('ideaStatus').textContent = 'Prompt ready. Review its direction and edit any detail.';
    showToast(`Idea shaped with ${result.provider}. Review the prompt before using it.`);
    return true;
  } catch (error) {
    $('ideaStatus').textContent = error.message || 'Could not turn this idea into a prompt.';
    showToast($('ideaStatus').textContent);
    return false;
  } finally {
    aiBusy = false;
    $('ideaGenerateButton').classList.remove('busy');
    updateIdeaButton(); updatePreview();
  }
}

async function loadAiStatus() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Unavailable');
    const status = await response.json();
    aiAvailable = status.aiAvailable;
    voiceAvailable = status.voiceAvailable;
    if (status.version) $('appVersion').textContent = status.version;
    $('aiStatus').textContent = aiAvailable ? 'Sends this draft to your configured AI provider' : 'Add an API key to .env to enable AI suggestions';
    $('ideaStatus').textContent = aiAvailable ? ($('ideaInput').value.trim() ? 'Ready to turn this idea into a prompt' : 'Add your idea to begin') : 'Add an API key to .env to use AI';
    $('voiceStatus').textContent = !voiceAvailable ? 'Add GROQ_API_KEY to .env to enable voice.'
      : !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' ? 'This browser cannot record audio here. Try typing your idea.'
      : 'Speak your idea. Audio goes to Groq only after Stop & send.';
  } catch { $('aiStatus').textContent = 'AI suggestions are unavailable'; $('ideaStatus').textContent = 'AI is unavailable. Use the manual editor below.'; $('voiceStatus').textContent = 'Voice is unavailable right now.'; }
  updateIdeaButton();
  updatePreview();
}

async function enhancePrompt() {
  if (!aiAvailable || aiBusy || !elements.task.value.trim()) return;
  const original = dataFromForm();
  aiBusy = true; $('enhanceButton').disabled = true; $('enhanceButton').classList.add('busy');
  $('aiStatus').textContent = 'Improving your prompt…';
  try {
    const response = await fetch('/api/enhance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(original) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'AI suggestions are unavailable.');
    if (JSON.stringify(original) !== JSON.stringify(dataFromForm())) { showToast('Your draft changed. AI suggestions were not applied.'); return; }
    currentId = null; currentAnalysis = null; setForm(result.data); renderInterpretation(null);
    showToast(`Prompt enhanced with ${result.provider}. Review before using it.`);
  } catch (error) { showToast(error.message || 'AI suggestions are unavailable.'); }
  finally { aiBusy = false; $('enhanceButton').classList.remove('busy'); $('aiStatus').textContent = 'Sends this draft to your configured AI provider'; updatePreview(); }
}

function buildPrompt(data) {
  if (!data.task) return '';
  const parts = [];
  if (data.role) parts.push(`Act as ${data.role.replace(/[.\s]+$/, '')}.`);
  parts.push(`Task: ${data.task}`);
  if (data.context) parts.push(`Context:\n${data.context}`);
  if (data.audience) parts.push(`Audience: ${data.audience}`);
  if (data.approach) parts.push(`Suggested approach:\n${data.approach}`);
  if (data.format) parts.push(`Output format: ${data.format}`);
  if (data.tone) parts.push(`Tone: ${data.tone}`);
  if (data.focus) parts.push(`Priorities (spend the most attention on the first):\n${data.focus}`);
  const depthInstructions = {
    Quick: 'Keep the answer brief and give the essential result or next step.',
    Balanced: 'Give a clear, practical answer with enough detail to act.',
    Deep: 'Work through the important reasoning, tradeoffs, edge cases, and concrete next steps.'
  };
  if (depthInstructions[data.depth]) parts.push(`Answer depth: ${data.depth}. ${depthInstructions[data.depth]}`);
  if (data.constraints) parts.push(`Requirements:\n${data.constraints}`);
  return parts.join('\n\n');
}

function updatePreview() {
  const data = dataFromForm();
  const prompt = buildPrompt(data);
  const output = $('promptOutput');
  output.textContent = prompt || 'Your prompt will appear here. Start with a rough idea, or open the details editor to build it yourself.';
  output.classList.toggle('is-empty', !prompt);
  $('wordCount').textContent = `${prompt ? prompt.split(/\s+/).length : 0} words`;
  $('copyButton').disabled = !prompt;
  $('downloadButton').disabled = !prompt;
  $('saveButton').disabled = !prompt;
  $('readyBadge').style.visibility = prompt ? 'visible' : 'hidden';
  $('enhanceButton').disabled = !prompt || !aiAvailable || aiBusy;
  if (currentAnalysis) {
    $('ideaDepthBadge').textContent = `${data.depth || 'Balanced'} depth`;
    $('ideaDepthReason').textContent = currentAnalysis.originalDepth && currentAnalysis.originalDepth !== data.depth
      ? `You changed the answer depth from ${currentAnalysis.originalDepth} to ${data.depth || 'an unspecified depth'}.`
      : currentAnalysis.whyThisDepth || '';
    renderApproach();
  }
  const checks = [Boolean(data.task), Boolean(data.role || data.audience), Boolean(data.context), Boolean(data.format || data.tone), Boolean(data.constraints || data.focus)];
  const score = checks.filter(Boolean).length;
  $('qualityScore').textContent = score;
  document.querySelectorAll('#scoreBars i').forEach((bar, index) => bar.classList.toggle('filled', index < score));
  const advice = !data.task ? ['A good start', 'Add your task to get started.']
    : !data.context ? ['Add some context', 'A little background helps AI make a more useful answer.']
    : !data.format && !data.tone ? ['Shape the result', 'Choose a format or tone to make the answer easier to use.']
    : !data.constraints && !data.focus ? ['Almost there', 'Add priorities or must-have details for a more focused result.']
    : ['Looking strong', 'Your prompt gives AI a clear direction to follow.'];
  $('qualityTitle').textContent = advice[0];
  $('qualityTip').textContent = advice[1];
}

async function copyPrompt() {
  const prompt = buildPrompt(dataFromForm());
  if (!prompt) { showToast('Add a task first.'); return false; }
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(prompt);
    else {
      const textArea = document.createElement('textarea');
      textArea.value = prompt; textArea.style.position = 'fixed'; textArea.style.opacity = '0';
      document.body.append(textArea); textArea.select();
      const copied = document.execCommand('copy'); textArea.remove();
      if (!copied) throw new Error('Copy failed');
    }
    showToast('Prompt copied to clipboard.'); return true;
  } catch { showToast('Copy unavailable. Select the preview text to copy it.'); return false; }
}

function savePrompt(name) {
  const data = dataFromForm();
  if (!data.task) return;
  const saved = getSaved();
  const existing = currentId ? saved.find(item => item.id === currentId) : null;
  const item = { id: existing?.id || crypto.randomUUID(), name: name.trim(), data, idea: $('ideaInput').value.trim(), analysis: currentAnalysis, updatedAt: new Date().toISOString() };
  const next = [item, ...saved.filter(entry => entry.id !== item.id)];
  try { setSaved(next); currentId = item.id; showToast(existing ? 'Prompt updated in your library.' : 'Prompt saved to your library.'); }
  catch { showToast('Storage is full or unavailable. Download the prompt instead.'); }
}

function renderTemplates() {
  $('templateNav').replaceChildren(...templates.map(template => {
    const button = document.createElement('button'); button.className = 'template-item'; button.type = 'button';
    const icon = document.createElement('span'); icon.className = 'template-glyph'; icon.textContent = template.icon;
    const label = document.createElement('span'); label.textContent = template.name;
    button.append(icon, label);
    button.addEventListener('click', () => { currentId = null; currentAnalysis = null; $('ideaInput').value = ''; setForm(template.data); renderInterpretation(null); setComposerExpanded(true); updateIdeaButton(); $('ideaStatus').textContent = 'Add a new idea whenever you like'; switchView('builder'); showToast(`${template.name} template loaded.`); });
    return button;
  }));
}

function renderLibrary() {
  const saved = getSaved();
  const query = $('librarySearch').value.toLowerCase().trim();
  const filtered = saved.filter(item => `${item.name} ${item.idea || ''} ${Object.values(item.data).join(' ')}`.toLowerCase().includes(query));
  $('libraryCount').textContent = saved.length;
  $('librarySummary').textContent = `${saved.length} saved prompt${saved.length === 1 ? '' : 's'}`;
  const grid = $('libraryGrid'); grid.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    empty.innerHTML = `<div class="empty-state-icon">✳</div><h3>${query ? 'No matching prompts' : 'Your library starts here'}</h3><p>${query ? 'Try a different search term.' : 'Save a prompt from the builder and it will appear here.'}</p>`;
    if (!query) { const button = document.createElement('button'); button.className = 'primary-button'; button.textContent = 'Create a prompt'; button.addEventListener('click', () => switchView('builder')); empty.append(button); }
    grid.append(empty); return;
  }
  for (const item of filtered) {
    const card = document.createElement('article'); card.className = 'library-card';
    const top = document.createElement('div'); top.className = 'library-card-top';
    const icon = document.createElement('span'); icon.className = 'library-card-icon'; icon.textContent = '✦';
    const deleteButton = document.createElement('button'); deleteButton.className = 'card-menu'; deleteButton.type = 'button'; deleteButton.setAttribute('aria-label', `Delete ${item.name}`); deleteButton.title = 'Delete prompt'; deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => { if (confirm(`Delete “${item.name}”?`)) { setSaved(getSaved().filter(entry => entry.id !== item.id)); if (currentId === item.id) currentId = null; showToast('Prompt deleted.'); } });
    top.append(icon, deleteButton);
    const title = document.createElement('h3'); title.textContent = item.name;
    const summary = document.createElement('p'); summary.textContent = item.data.task;
    const footer = document.createElement('div'); footer.className = 'library-card-footer';
    const date = document.createElement('span'); date.textContent = new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const open = document.createElement('button'); open.textContent = 'Open prompt →'; open.addEventListener('click', () => { currentId = item.id; currentAnalysis = item.analysis || null; $('ideaInput').value = item.idea || ''; setForm(item.data); renderInterpretation(currentAnalysis); updateIdeaButton(); switchView('builder'); });
    footer.append(date, open); card.append(top, title, summary, footer); grid.append(card);
  }
}

function switchView(view) {
  if (view !== 'builder') {
    if (voiceState === 'recording') { voiceCancelReason = 'Recording discarded when leaving the idea page.'; stopVoiceRecording(false); }
    else if (voiceState === 'requesting') { voiceRequestId++; voiceState = 'idle'; $('voiceStatus').textContent = 'Recording cancelled.'; updateIdeaButton(); }
  }
  $('builderView').classList.toggle('hidden', view !== 'builder');
  $('libraryView').classList.toggle('hidden', view !== 'library');
  $('breadcrumbCurrent').textContent = view === 'builder' ? 'Idea to prompt' : 'My library';
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  $('sidebar').classList.remove('open'); $('menuButton').setAttribute('aria-expanded', 'false');
  if (view === 'library') renderLibrary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function downloadPrompt() {
  const prompt = buildPrompt(dataFromForm()); if (!prompt) return;
  const name = getSaved().find(item => item.id === currentId)?.name || 'My prompt';
  const markdown = `# ${name}\n\n${prompt}\n`;
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
  const link = document.createElement('a'); link.href = url; link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'prompt'}.md`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('Prompt downloaded.');
}

initCustomSelects();
setComposerExpanded(false);
fields.forEach(field => elements[field].addEventListener(Object.hasOwn(selectOptions, field) ? 'change' : 'input', () => { updatePreview(); persistDraft(); }));
$('toggleComposer').addEventListener('click', () => setComposerExpanded($('promptForm').classList.contains('collapsed')));
$('ideaInput').addEventListener('input', () => { if (currentAnalysis) { currentAnalysis = null; renderInterpretation(null); } persistDraft(); updateIdeaButton(); $('ideaStatus').textContent = aiAvailable ? 'Ready to turn this idea into a prompt' : 'Add an API key to .env to use AI'; });
$('ideaGenerateButton').addEventListener('click', generateIdeaPrompt);
$('micButton').addEventListener('click', () => { if (voiceState === 'recording') stopVoiceRecording(true); else startVoiceRecording(); });
$('voiceCancelButton').addEventListener('click', () => stopVoiceRecording(false));
document.querySelectorAll('.idea-example').forEach(button => button.addEventListener('click', () => { $('ideaInput').value = button.dataset.example; $('ideaInput').dispatchEvent(new Event('input')); $('ideaInput').focus(); }));
$('enhanceButton').addEventListener('click', enhancePrompt);
$('promptForm').addEventListener('submit', event => event.preventDefault());
document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
$('librarySearch').addEventListener('input', renderLibrary);
$('clearButton').addEventListener('click', () => { currentId = null; currentAnalysis = null; $('ideaInput').value = ''; setForm({}); renderInterpretation(null); updateIdeaButton(); $('ideaStatus').textContent = 'Add your idea to begin'; elements.task.focus(); showToast('Prompt cleared.'); });
$('newPromptButton').addEventListener('click', () => { currentId = null; currentAnalysis = null; $('ideaInput').value = ''; setForm({}); renderInterpretation(null); setComposerExpanded(false); updateIdeaButton(); $('ideaStatus').textContent = 'Add your idea to begin'; switchView('builder'); $('ideaInput').focus(); });
$('copyButton').addEventListener('click', copyPrompt);
$('downloadButton').addEventListener('click', downloadPrompt);
$('saveButton').addEventListener('click', () => { if (!elements.task.value.trim()) return; $('promptName').value = getSaved().find(item => item.id === currentId)?.name || ''; $('saveDialog').showModal(); $('promptName').focus(); });
$('cancelSave').addEventListener('click', () => $('saveDialog').close());
$('saveForm').addEventListener('submit', event => { event.preventDefault(); const name = $('promptName').value.trim(); if (!name) return; savePrompt(name); $('saveDialog').close(); });
$('helpButton').addEventListener('click', () => $('helpDialog').showModal());
$('closeHelp').addEventListener('click', () => $('helpDialog').close());
$('gotItButton').addEventListener('click', () => $('helpDialog').close());
$('menuButton').addEventListener('click', () => { const open = $('sidebar').classList.toggle('open'); $('menuButton').setAttribute('aria-expanded', String(open)); });
window.addEventListener('pagehide', () => { voiceRequestId++; if (voiceState === 'recording') stopVoiceRecording(false); else stopVoiceTracks(); });
document.querySelectorAll('.platform-card').forEach(card => card.addEventListener('click', async () => {
  const url = platformUrls[card.dataset.platform];
  const tab = window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  if (buildPrompt(dataFromForm())) await copyPrompt();
  if (tab) tab.location.href = url;
  else window.location.href = url;
}));
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (document.activeElement === $('ideaInput')) generateIdeaPrompt(); else copyPrompt(); } });

renderTemplates();
const savedDraft = readJSON(DRAFT_KEY, {});
currentAnalysis = savedDraft.analysis || null;
$('ideaInput').value = savedDraft.idea || '';
setForm(savedDraft.data || savedDraft);
renderInterpretation(currentAnalysis);
renderLibrary();
loadAiStatus();
