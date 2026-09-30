const STORAGE_KEY = "promptdock.prompts.v1";
const DRAFT_KEY = "promptdock.draft.v1";
const TOKEN_KEY = "promptdock.workspace-token.v1";
const config = window.PROMPTDOCK_CONFIG || { version: "development" };
const buildPrompt = window.PromptDockBuildPrompt;
const fields = [
  "task",
  "role",
  "audience",
  "context",
  "format",
  "tone",
  "approach",
  "focus",
  "depth",
  "constraints",
];
const templates = [
  {
    id: "writing",
    icon: "✎",
    name: "Write anything",
    data: {
      task: "Write a compelling piece about [topic]",
      role: "An experienced writer",
      audience: "[target audience]",
      context:
        "The key idea is [main idea]. The reader should come away knowing [takeaway].",
      format: "Article",
      tone: "Clear and concise",
      constraints: "Use specific examples. Avoid filler and jargon.",
    },
  },
  {
    id: "research",
    icon: "⌕",
    name: "Research a topic",
    data: {
      task: "Research [topic] and summarize the most useful findings",
      role: "A careful research analyst",
      audience: "A curious non-expert",
      context: "I need this research to help me decide [decision or goal].",
      format: "Bulleted list",
      tone: "Educational",
      constraints:
        "Separate established facts from uncertainty. Cite sources when available and say when you cannot verify a claim.",
    },
  },
  {
    id: "code",
    icon: "⌘",
    name: "Explain code",
    data: {
      task: "Explain how this code works and suggest improvements",
      role: "A patient senior software engineer",
      audience: "A developer learning this codebase",
      context:
        "Language and framework: [add details]. Code: [paste code here].",
      format: "Code with explanation",
      tone: "Educational",
      constraints:
        "Explain the main flow first. Flag correctness and security issues. Show improved code only where useful.",
    },
  },
  {
    id: "brainstorm",
    icon: "✳",
    name: "Brainstorm ideas",
    data: {
      task: "Generate fresh ideas for [project or problem]",
      role: "A creative strategist",
      audience: "[who the ideas are for]",
      context: "Goal: [desired result]. Resources and limitations: [details].",
      format: "Bulleted list",
      tone: "Creative",
      constraints:
        "Include practical and unexpected ideas. Give each idea a short explanation and one first step.",
    },
  },
  {
    id: "summarize",
    icon: "▤",
    name: "Summarize content",
    data: {
      task: "Summarize the following content: [paste content]",
      role: "A clear and precise editor",
      audience: "Someone who needs the key points quickly",
      context: "The most important question I need answered is [question].",
      format: "Bulleted list",
      tone: "Clear and concise",
      constraints:
        "Preserve the original meaning. Highlight key decisions, numbers, and open questions. Do not invent details.",
    },
  },
];
const platformUrls = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/app",
};
const selectOptions = {
  format: [
    "Bulleted list",
    "Step-by-step guide",
    "Table",
    "Email",
    "Social post",
    "Article",
    "Code with explanation",
    "JSON",
  ],
  tone: [
    "Clear and concise",
    "Friendly",
    "Professional",
    "Persuasive",
    "Creative",
    "Educational",
  ],
  depth: ["Quick", "Balanced", "Deep"],
};

const elements = Object.fromEntries(
  fields.map((field) => [field, document.getElementById(field)]),
);
const $ = (id) => document.getElementById(id);
let currentId = null;
let toastTimer;
let aiAvailable = false;
let aiBusy = false;
let runBusy = false;
let currentAnalysis = null;
let voiceAvailable = false;
let voiceState = "idle";
let voiceRecorder = null;
let voiceStream = null;
let voiceChunks = [];
let voiceCancelled = false;
let voiceStartedAt = 0;
let voiceTimer = null;
let voiceRequestId = 0;
let voiceCancelReason = "";
let databaseAvailable = false;
let currentUser = null;
let accountPrompts = [];
let libraryTotal = 0;
let searchResults = [];
let searchTotal = 0;
let searchRequest = 0;
let searchTimer;
let activeTag = "";
let librarySort = "updated";
let remoteTags = [];
let authMode = "login";
let pendingSave = false;
let resetToken = null;
let selectedProvider = "groq";
let savedProvider = null;
let currentSharePromptId = null;
let currentHistoryPromptId = null;
const FORK_KEY = "promptdock.pending-fork.v1";

function apiFetch(path, options = {}) {
  return fetch(path, options);
}
function libraryFetch(path, options = {}) {
  return apiFetch(path, options);
}
async function readApiJson(response) {
  if (
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  )
    throw new Error(
      "The site API is not responding. Check this deployment’s API configuration.",
    );
  try {
    return await response.json();
  } catch {
    throw new Error("The site API returned an invalid response. Try again.");
  }
}

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function dataFromForm() {
  return Object.fromEntries(
    fields.map((field) => [field, elements[field].value.trim()]),
  );
}
function suggestedPromptName() {
  const source = $("ideaInput").value.trim() || elements.task.value.trim();
  const firstLine = source
    .split(/[\n.!?]/, 1)[0]
    .replace(/\s+/g, " ")
    .trim();
  const words = firstLine.split(" ");
  let name = "";
  for (const word of words) {
    if ((name ? `${name} ${word}` : word).length > 80) break;
    name = name ? `${name} ${word}` : word;
  }
  return (
    name.replace(/[,:;\s]+$/, "") ||
    firstLine.slice(0, 80).trim() ||
    "New prompt"
  );
}
function setForm(data) {
  fields.forEach((field) => {
    elements[field].value = data[field] || "";
  });
  Object.keys(selectOptions).forEach(syncSelect);
  updatePreview();
  persistDraft();
}
function getSaved() {
  if (currentUser) return accountPrompts;
  const saved = readJSON(STORAGE_KEY, []);
  return Array.isArray(saved) ? saved : [];
}
function findPrompt(id) {
  return (
    getSaved().find((item) => item.id === id) ||
    searchResults.find((item) => item.id === id)
  );
}
async function fetchLibraryPage(q = "", offset = 0) {
  const params = new URLSearchParams({ offset: String(offset) });
  if (q) params.set("q", q);
  if (activeTag) params.set("tag", activeTag);
  if (librarySort !== "updated") params.set("sort", librarySort);
  const response = await libraryFetch(`/api/prompts?${params}`);
  const result = await readApiJson(response);
  if (!response.ok)
    throw new Error(result.error || "Could not load saved prompts.");
  return result;
}
function setSaved(items) {
  if (currentUser) accountPrompts = items;
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (currentUser && libraryFiltered()) reloadLibrary();
  else renderLibrary();
  if (currentUser) refreshTagChips();
}
async function loadRemoteLibrary() {
  if (!currentUser) return;
  const legacyPrompts = readJSON(STORAGE_KEY, []);
  try {
    const legacyToken = localStorage.getItem(TOKEN_KEY);
    if (/^[a-f0-9]{64}$/.test(legacyToken || "")) {
      const imported = await libraryFetch("/api/auth/import-legacy", {
        method: "POST",
        headers: { "X-Workspace-Token": legacyToken },
      });
      if (!imported.ok) throw new Error("Could not import your old workspace.");
    }
    const page = await fetchLibraryPage();
    libraryTotal = page.total;
    const remote = page.prompts;
    const remoteIds = new Set(remote.map((item) => item.id));
    for (const item of (Array.isArray(legacyPrompts)
      ? legacyPrompts
      : []
    ).filter((item) => !remoteIds.has(item.id))) {
      const saved = await libraryFetch("/api/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!saved.ok) throw new Error("Could not migrate browser prompts.");
      remote.push((await saved.json()).prompt);
    }
    setSaved(
      remote.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    );
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    if (Array.isArray(legacyPrompts) && legacyPrompts.length)
      setSaved(legacyPrompts);
    showToast(
      legacyPrompts?.length
        ? "Library sync failed. Your old browser copy is still available."
        : "Library sync failed. Try again after refreshing.",
    );
  }
}

function captureForkIntent() {
  const url = new URL(window.location.href);
  const id = url.searchParams.get("fork");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  localStorage.setItem(FORK_KEY, JSON.stringify({ id, at: Date.now() }));
  url.searchParams.delete("fork");
  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
  return true;
}

async function completePendingFork() {
  if (!currentUser) return false;
  const pending = readJSON(FORK_KEY, null);
  if (
    !pending ||
    !/^[0-9a-f-]{36}$/i.test(pending.id || "") ||
    Date.now() - pending.at > 86400000
  ) {
    localStorage.removeItem(FORK_KEY);
    return false;
  }
  try {
    const response = await apiFetch(`/api/public/prompts/${pending.id}/fork`, {
      method: "POST",
    });
    const result = await readApiJson(response);
    if (!response.ok)
      throw new Error(result.error || "Could not save the shared prompt.");
    localStorage.removeItem(FORK_KEY);
    setSaved([
      result.prompt,
      ...getSaved().filter((item) => item.id !== result.prompt.id),
    ]);
    switchView("library");
    showToast("Shared prompt added to your library.");
    return true;
  } catch (error) {
    if (/unavailable/i.test(error.message || ""))
      localStorage.removeItem(FORK_KEY);
    showToast(error.message || "Could not save the shared prompt.");
    return false;
  }
}
function persistDraft() {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        data: dataFromForm(),
        idea: $("ideaInput").value,
        analysis: currentAnalysis,
      }),
    );
  } catch {
    /* Browser storage may be unavailable. */
  }
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function syncSelect(name) {
  const wrapper = document.querySelector(`[data-select="${name}"]`);
  const value = elements[name].value;
  const trigger = wrapper.querySelector(".select-trigger");
  trigger.firstElementChild.textContent =
    value ||
    (name === "format"
      ? "Choose a format"
      : name === "tone"
        ? "Choose a tone"
        : "Choose depth");
  trigger.classList.toggle("has-value", Boolean(value));
  wrapper.querySelectorAll(".select-option").forEach((option) => {
    option.setAttribute(
      "aria-selected",
      String(option.dataset.value === value),
    );
    option.querySelector(".select-check").textContent =
      option.dataset.value === value ? "✓" : "";
  });
}

function closeSelect(wrapper, restoreFocus = false) {
  wrapper.classList.remove("open");
  wrapper
    .querySelector(".select-trigger")
    .setAttribute("aria-expanded", "false");
  if (restoreFocus) wrapper.querySelector(".select-trigger").focus();
}

function initCustomSelects() {
  Object.entries(selectOptions).forEach(([name, values]) => {
    const wrapper = document.querySelector(`[data-select="${name}"]`);
    const trigger = wrapper.querySelector(".select-trigger");
    const menu = wrapper.querySelector(".select-menu");
    for (const value of ["", ...values]) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "select-option";
      option.dataset.value = value;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      const label = document.createElement("span");
      label.textContent = value || `Choose ${name}`;
      const check = document.createElement("span");
      check.className = "select-check";
      option.append(label, check);
      option.addEventListener("click", () => {
        elements[name].value = value;
        elements[name].dispatchEvent(new Event("change", { bubbles: true }));
        syncSelect(name);
        closeSelect(wrapper, true);
      });
      menu.append(option);
    }
    trigger.addEventListener("click", () => {
      const opening = !wrapper.classList.contains("open");
      document
        .querySelectorAll(".custom-select.open")
        .forEach((open) => closeSelect(open));
      wrapper.classList.toggle("open", opening);
      trigger.setAttribute("aria-expanded", String(opening));
      if (opening)
        menu
          .querySelector(`[data-value="${CSS.escape(elements[name].value)}"]`)
          ?.focus();
    });
    wrapper.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSelect(wrapper, true);
        event.preventDefault();
        return;
      }
      if (
        !wrapper.classList.contains("open") &&
        ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)
      ) {
        trigger.click();
        event.preventDefault();
        return;
      }
      if (
        !wrapper.classList.contains("open") ||
        !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
      )
        return;
      const options = [...menu.querySelectorAll(".select-option")];
      const current = options.indexOf(document.activeElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : (current +
                (event.key === "ArrowDown" ? 1 : -1) +
                options.length) %
              options.length;
      options[next].focus();
      event.preventDefault();
    });
  });
  document.addEventListener("pointerdown", (event) => {
    document.querySelectorAll(".custom-select.open").forEach((wrapper) => {
      if (!wrapper.contains(event.target)) closeSelect(wrapper);
    });
  });
}

function setComposerExpanded(expanded) {
  $("promptForm").classList.toggle("collapsed", !expanded);
  $("toggleComposer").setAttribute("aria-expanded", String(expanded));
  $("toggleComposer").textContent = expanded
    ? "Hide details ⌃"
    : "Edit details ⌄";
  document
    .querySelector(".composer-card")
    .classList.toggle("is-collapsed", !expanded);
}

function renderInterpretation(analysis) {
  $("interpretationCard").classList.toggle("hidden", !analysis);
  if (!analysis) return;
  $("ideaGoal").textContent = analysis.goal || "";
  $("ideaDepthReason").textContent =
    analysis.originalDepth && analysis.originalDepth !== elements.depth.value
      ? `You changed the answer depth from ${analysis.originalDepth} to ${elements.depth.value || "an unspecified depth"}.`
      : analysis.whyThisDepth || "";
  $("ideaDepthBadge").textContent =
    `${elements.depth.value || "Balanced"} depth`;
  const makeItem = (value) => {
    const item = document.createElement("li");
    item.textContent = value;
    return item;
  };
  $("ideaFocusAreas").replaceChildren(
    ...(analysis.focusAreas || []).map(makeItem),
  );
  renderApproach();
  $("ideaMissingDetails").replaceChildren(
    ...(analysis.missingDetails || []).map(makeItem),
  );
  $("missingDetails").classList.toggle(
    "hidden",
    !analysis.missingDetails?.length,
  );
}

function renderApproach() {
  const steps = elements.approach.value
    .split(/\n/)
    .map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
  $("ideaApproach").replaceChildren(
    ...steps.map((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      return item;
    }),
  );
  $("ideaApproachSection").classList.toggle("hidden", !steps.length);
}

function updateIdeaButton() {
  $("ideaGenerateButton").disabled =
    !aiAvailable ||
    aiBusy ||
    voiceState !== "idle" ||
    $("ideaInput").value.trim().length < 4;
  updateVoiceControls();
}

function updateVoiceControls() {
  const button = $("micButton");
  button.classList.toggle("recording", voiceState === "recording");
  button.classList.toggle(
    "processing",
    voiceState === "transcribing" || voiceState === "requesting",
  );
  $("voiceCancelButton").classList.toggle("hidden", voiceState !== "recording");
  if (voiceState === "recording") {
    const seconds = Math.floor((Date.now() - voiceStartedAt) / 1000);
    const label = `Stop & send ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    $("micButtonLabel").textContent = label;
    button.setAttribute("aria-label", label);
    button.disabled = false;
  } else if (voiceState === "transcribing" || voiceState === "requesting") {
    const label = voiceState === "requesting" ? "Allow mic…" : "Transcribing…";
    $("micButtonLabel").textContent = label;
    button.setAttribute("aria-label", label);
    button.disabled = true;
  } else {
    $("micButtonLabel").textContent = "Record idea";
    button.setAttribute("aria-label", "Record idea");
    button.disabled =
      !voiceAvailable ||
      aiBusy ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined";
  }
}

function stopVoiceTracks() {
  if (voiceTimer) clearInterval(voiceTimer);
  voiceTimer = null;
  voiceStream?.getTracks().forEach((track) => track.stop());
  voiceStream = null;
}

async function finishVoiceRecording(mimeType) {
  stopVoiceTracks();
  const cancelled = voiceCancelled;
  const audio = new Blob(voiceChunks, {
    type: mimeType || voiceChunks[0]?.type || "audio/webm",
  });
  voiceRecorder = null;
  voiceChunks = [];
  if (cancelled) {
    voiceState = "idle";
    $("voiceStatus").textContent = voiceCancelReason || "Recording discarded.";
    updateIdeaButton();
    return;
  }
  voiceState = "transcribing";
  updateIdeaButton();
  $("voiceStatus").textContent = "Transcribing your idea…";
  try {
    if (audio.size > 4 * 1024 * 1024)
      throw new Error("Recording is too large. Try a shorter idea.");
    const response = await apiFetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": audio.type },
      body: audio,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not transcribe the recording.");
    const transcript = result.text?.trim();
    if (!transcript)
      throw new Error("No speech was detected. Try speaking again.");
    const existing = $("ideaInput").value.trim();
    const combined = existing ? `${existing}\n${transcript}` : transcript;
    if (combined.length > 6000)
      throw new Error(
        "The combined idea is too long. Shorten it and try again.",
      );
    $("ideaInput").value = combined;
    $("ideaInput").dispatchEvent(new Event("input"));
    voiceState = "idle";
    updateIdeaButton();
    $("voiceStatus").textContent = "Transcribed. Sending your idea to AI…";
    const sent = await generateIdeaPrompt();
    $("voiceStatus").textContent = sent
      ? "Voice idea transcribed and sent."
      : "Transcript added. Use Turn idea into prompt to try again.";
  } catch (error) {
    voiceState = "idle";
    updateIdeaButton();
    $("voiceStatus").textContent =
      error.message || "Voice recording could not be sent.";
    showToast($("voiceStatus").textContent);
  }
}

async function startVoiceRecording() {
  if (voiceState !== "idle" || aiBusy || !voiceAvailable) return;
  const requestId = ++voiceRequestId;
  voiceState = "requesting";
  $("voiceStatus").textContent = "Waiting for microphone permission…";
  updateIdeaButton();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    if (requestId !== voiceRequestId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    voiceStream = stream;
    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg",
    ].find((type) => MediaRecorder.isTypeSupported?.(type));
    voiceRecorder = new MediaRecorder(
      voiceStream,
      mimeType ? { mimeType } : undefined,
    );
    voiceChunks = [];
    voiceCancelled = false;
    voiceCancelReason = "";
    voiceRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) voiceChunks.push(event.data);
    });
    voiceRecorder.addEventListener(
      "stop",
      () => {
        finishVoiceRecording(voiceRecorder?.mimeType || mimeType);
      },
      { once: true },
    );
    voiceRecorder.addEventListener("error", () => {
      voiceCancelReason = "Recording failed. Try again.";
      stopVoiceRecording(false);
    });
    voiceRecorder.start();
    voiceState = "recording";
    voiceStartedAt = Date.now();
    voiceTimer = setInterval(() => {
      updateVoiceControls();
      if (Date.now() - voiceStartedAt >= 120000) {
        voiceCancelReason =
          "Two-minute limit reached. Recording discarded; try a shorter idea.";
        stopVoiceRecording(false);
      }
    }, 500);
    $("voiceStatus").textContent =
      "Recording. Choose Stop & send to transcribe, or Cancel to discard.";
    updateIdeaButton();
  } catch (error) {
    if (requestId !== voiceRequestId) return;
    stopVoiceTracks();
    voiceRecorder = null;
    voiceState = "idle";
    updateIdeaButton();
    $("voiceStatus").textContent =
      error.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in your browser settings."
        : "Microphone is unavailable. Try typing your idea.";
    showToast($("voiceStatus").textContent);
  }
}

function stopVoiceRecording(send) {
  if (voiceState !== "recording" || !voiceRecorder) return;
  voiceCancelled = !send;
  voiceState = "transcribing";
  if (!send) $("voiceStatus").textContent = "Discarding recording…";
  else $("voiceStatus").textContent = "Finishing recording…";
  updateIdeaButton();
  try {
    voiceRecorder.stop();
  } catch {
    voiceCancelled = true;
    stopVoiceTracks();
    voiceRecorder = null;
    voiceState = "idle";
    $("voiceStatus").textContent = "Recording stopped unexpectedly. Try again.";
    updateIdeaButton();
  }
  if (!send) stopVoiceTracks();
}

async function generateIdeaPrompt() {
  const idea = $("ideaInput").value.trim();
  if (!aiAvailable || aiBusy || voiceState !== "idle" || idea.length < 4)
    return false;
  aiBusy = true;
  $("ideaGenerateButton").classList.add("busy");
  $("ideaStatus").textContent = "Reading your idea and shaping the prompt…";
  updateIdeaButton();
  updatePreview();
  try {
    const response = await apiFetch("/api/idea-to-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || "Could not turn this idea into a prompt.",
      );
    if (idea !== $("ideaInput").value.trim()) {
      $("ideaStatus").textContent =
        "Your idea changed. Run it again when ready.";
      return false;
    }
    currentId = null;
    currentAnalysis = {
      ...result.interpretation,
      originalDepth: result.data.depth,
    };
    setForm(result.data);
    renderInterpretation(currentAnalysis);
    $("ideaStatus").textContent =
      "Prompt ready. Review its direction and edit any detail.";
    showToast(
      `Idea shaped with ${result.provider}. Review the prompt before using it.`,
    );
    return true;
  } catch (error) {
    $("ideaStatus").textContent =
      error.message || "Could not turn this idea into a prompt.";
    showToast($("ideaStatus").textContent);
    return false;
  } finally {
    aiBusy = false;
    $("ideaGenerateButton").classList.remove("busy");
    updateIdeaButton();
    updatePreview();
  }
}

async function loadAiStatus() {
  try {
    const accountResponse = await apiFetch("/api/auth/me");
    if (accountResponse.ok) currentUser = (await accountResponse.json()).user;
  } catch {
    currentUser = null;
  }
  try {
    const response = await apiFetch("/api/status");
    if (!response.ok) throw new Error("Unavailable");
    const status = await response.json();
    aiAvailable = status.aiAvailable;
    voiceAvailable = status.voiceAvailable;
    databaseAvailable = Boolean(status.databaseAvailable);
  } catch {
    aiAvailable = false;
    voiceAvailable = false;
  }
  renderAccount();
  renderShell();
  if (currentUser) {
    await loadRemoteLibrary();
    await loadSettings();
  }
  $("aiStatus").textContent = aiAvailable
    ? "Sends this draft to your chosen AI provider"
    : "Add a provider key in Settings to enable AI suggestions";
  $("runNote").textContent = aiAvailable
    ? "Tests this prompt on your configured AI"
    : "Add a provider key in Settings to run prompts";
  $("ideaStatus").textContent = aiAvailable
    ? $("ideaInput").value.trim()
      ? "Ready to turn this idea into a prompt"
      : "Add your idea to begin"
    : "Add a provider key in Settings to use AI";
  $("voiceStatus").textContent = !voiceAvailable
    ? "Voice requires a Groq key, yours or PromptDock’s."
    : !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ? "This browser cannot record audio here. Try typing your idea."
      : "Speak your idea. Audio goes to Groq only after Stop & send.";
  updateIdeaButton();
  updatePreview();
}

function renderAccount() {
  $("accountButton").textContent = currentUser ? currentUser.email : "Account";
  $("settingsEmail").textContent = currentUser?.email || "";
  $("privacyNote").textContent = currentUser
    ? "Library syncs with your account"
    : "Sign in to sync your library";
  renderLibrary();
}

function renderShell() {
  const enteringWorkspace =
    currentUser && $("appShell").classList.contains("hidden");
  $("bootScreen").classList.add("hidden");
  $("landingPage").classList.toggle("hidden", Boolean(currentUser));
  $("appShell").classList.toggle("hidden", !currentUser);
  if (enteringWorkspace) window.scrollTo(0, 0);
}

function openAuth(mode = "login") {
  authMode = mode;
  const copy = {
    login: [
      "Welcome back",
      "Sign in to open your saved prompts on any device.",
      "Sign in",
      "Create account",
    ],
    register: [
      "Create your workspace",
      "We’ll email you a link to verify your address.",
      "Create account",
      "I have an account",
    ],
    forgot: [
      "Reset your password",
      "Enter your email and we’ll send a reset link.",
      "Send reset link",
      "Back to sign in",
    ],
    reset: [
      "Choose a new password",
      "Use at least 12 characters.",
      "Update password",
      "Back to sign in",
    ],
    "pending-verify": [
      "Check your inbox",
      "Open the verification link we sent you. You can request a new one below.",
      "Resend verification",
      "Back to sign in",
    ],
    "pending-reset": [
      "Check your inbox",
      "If this email has an account, a reset link is on its way.",
      "Send again",
      "Back to sign in",
    ],
    verifying: [
      "Verifying your email",
      "Please wait while we confirm your address.",
      "",
      "",
    ],
  }[mode];
  $("authTitle").textContent = copy[0];
  $("authDescription").textContent = copy[1];
  $("authSubmit").textContent = copy[2];
  $("authToggle").textContent = copy[3];
  const emailNeeded = !["reset", "verifying"].includes(mode);
  const passwordNeeded = ["login", "register", "reset"].includes(mode);
  const confirmNeeded = ["register", "reset"].includes(mode);
  $("authEmailWrap").classList.toggle("hidden", !emailNeeded);
  $("authPasswordWrap").classList.toggle("hidden", !passwordNeeded);
  $("authConfirmWrap").classList.toggle("hidden", !confirmNeeded);
  $("authEmail").required = emailNeeded;
  $("authPassword").required = passwordNeeded;
  $("authConfirm").required = confirmNeeded;
  $("authSubmit").classList.toggle("hidden", mode === "verifying");
  $("authToggle").classList.toggle("hidden", mode === "verifying");
  $("authForgot").classList.toggle("hidden", mode !== "login");
  $("authPassword").autocomplete =
    mode === "login" ? "current-password" : "new-password";
  $("authPassword").value = "";
  $("authConfirm").value = "";
  $("authError").textContent = "";
  $("authSuccess").textContent = "";
  if (!$("authDialog").open) $("authDialog").showModal();
  if (emailNeeded) $("authEmail").focus();
  else if (passwordNeeded) $("authPassword").focus();
}

async function submitAuth(event) {
  event.preventDefault();
  const button = $("authSubmit");
  button.disabled = true;
  $("authError").textContent = "";
  try {
    if (
      ["register", "reset"].includes(authMode) &&
      $("authPassword").value !== $("authConfirm").value
    )
      throw new Error("Passwords do not match.");
    const route =
      { "pending-verify": "resend", "pending-reset": "forgot" }[authMode] ||
      authMode;
    const body =
      authMode === "reset"
        ? { token: resetToken, password: $("authPassword").value }
        : { email: $("authEmail").value, password: $("authPassword").value };
    const response = await apiFetch(`/api/auth/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await readApiJson(response);
    if (!response.ok) {
      if (result.code === "email_delivery_failed" && authMode === "register") {
        openAuth("pending-verify");
        $("authError").textContent =
          result.error ||
          "Verification email could not be sent. Try resending shortly.";
        return;
      }
      if (result.code === "verification_required") {
        openAuth("pending-verify");
        $("authSuccess").textContent = "Your email still needs verification.";
        return;
      }
      throw new Error(result.error || "Could not continue.");
    }
    if (authMode === "register" || authMode === "pending-verify") {
      openAuth("pending-verify");
      $("authSuccess").textContent =
        "Verification email sent. Check your inbox and spam folder.";
      return;
    }
    if (authMode === "forgot" || authMode === "pending-reset") {
      openAuth("pending-reset");
      $("authSuccess").textContent =
        "If this address has an account, a reset link has been sent.";
      return;
    }
    if (authMode === "reset") {
      resetToken = null;
      currentUser = null;
      accountPrompts = [];
      renderAccount();
      renderShell();
      openAuth("login");
      $("authSuccess").textContent =
        "Password updated. Sign in with your new password.";
      return;
    }
    currentUser = result.user;
    databaseAvailable = true;
    accountPrompts = [];
    $("authPassword").value = "";
    $("authDialog").close();
    await loadAiStatus();
    await completePendingFork();
    if (pendingSave) {
      pendingSave = false;
      $("promptName").value = suggestedPromptName();
      $("promptTags").value = "";
      $("saveDialog").showModal();
      $("promptName").focus();
    }
  } catch (error) {
    $("authError").textContent = error.message || "Could not sign in.";
  } finally {
    button.disabled = false;
  }
}

async function handleAuthLink() {
  const params = new URLSearchParams(window.location.search);
  const verify = params.get("verify");
  resetToken = params.get("reset");
  if (!verify && !resetToken) return;
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${window.location.hash}`,
  );
  if (resetToken) {
    openAuth("reset");
    return;
  }
  openAuth("verifying");
  try {
    const response = await apiFetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verify }),
    });
    const result = await readApiJson(response);
    if (!response.ok) throw new Error(result.error || "Verification failed.");
    openAuth("login");
    $("authSuccess").textContent =
      "Email verified. Sign in to open your workspace.";
  } catch (error) {
    openAuth("login");
    $("authError").textContent = error.message || "Verification failed.";
  }
}

function selectProvider(provider) {
  selectedProvider = provider;
  document.querySelectorAll(".provider-option").forEach((option) => {
    const active = option.dataset.provider === provider;
    option.classList.toggle("active", active);
    option.setAttribute("aria-pressed", String(active));
  });
  $("byokModel").placeholder = {
    groq: "e.g. openai/gpt-oss-120b",
    gemini: "e.g. gemini-2.5-flash",
    apmix: "Your APMIX model ID",
  }[provider];
  if (savedProvider && savedProvider !== provider)
    $("byokKey").placeholder = "Add a key for this provider";
}

async function loadSettings() {
  if (!currentUser) return;
  try {
    const response = await apiFetch("/api/settings");
    if (!response.ok) throw new Error("Settings are unavailable.");
    const setting = await readApiJson(response);
    savedProvider = setting.provider;
    selectProvider(setting.provider || "groq");
    $("byokModel").value = setting.model || "";
    $("byokKey").value = "";
    $("byokKey").placeholder = setting.hasKey
      ? "Key saved — leave blank to keep it"
      : "Paste your provider key";
    $("byokState").textContent = !setting.available
      ? "Personal keys are unavailable right now."
      : setting.hasKey
        ? `Using your ${{ groq: "Groq", gemini: "Gemini", apmix: "APMIX" }[setting.provider]} key and model.`
        : "Using PromptDock’s configured provider.";
    $("byokForm").querySelector("button[type=submit]").disabled =
      !setting.available;
    $("removeByok").disabled = !setting.hasKey;
  } catch {
    $("byokState").textContent = "Could not load your AI settings.";
  }
  refreshSessions();
}

function describeDevice(userAgent) {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const platform = /Windows/.test(userAgent)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iPhone or iPad"
      : /Mac OS X|Macintosh/.test(userAgent)
        ? "Mac"
        : /Android/.test(userAgent)
          ? "Android"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return platform ? `${browser} on ${platform}` : browser;
}

function renderSessions(sessions) {
  const list = $("sessionsList");
  list.replaceChildren();
  if (!sessions.length) {
    const empty = document.createElement("p");
    empty.className = "sessions-empty";
    empty.textContent = "No active sessions.";
    list.append(empty);
    return;
  }
  for (const session of sessions) {
    const row = document.createElement("div");
    row.className = "session-row";
    const info = document.createElement("div");
    info.className = "session-info";
    const name = document.createElement("strong");
    name.textContent = describeDevice(session.userAgent);
    const meta = document.createElement("small");
    meta.textContent = `Signed in ${new Date(session.createdAt).toLocaleString()}`;
    info.append(name, meta);
    if (session.current) {
      const badge = document.createElement("span");
      badge.className = "session-badge";
      badge.textContent = "This device";
      info.append(badge);
    }
    const revoke = document.createElement("button");
    revoke.type = "button";
    revoke.className = "text-button";
    revoke.textContent = "Sign out";
    revoke.addEventListener("click", async () => {
      revoke.disabled = true;
      try {
        const response = await apiFetch(
          `/api/auth/sessions/${encodeURIComponent(session.sessionId)}`,
          { method: "DELETE" },
        );
        const result = await readApiJson(response);
        if (!response.ok)
          throw new Error(result.error || "Could not end this session.");
        if (result.current) {
          resetAccountState();
          showToast("Signed out on this device.");
          return;
        }
        await refreshSessions();
        showToast("Session ended.");
      } catch (error) {
        showToast(error.message);
        revoke.disabled = false;
      }
    });
    row.append(info, revoke);
    list.append(row);
  }
}

async function refreshSessions() {
  const list = $("sessionsList");
  if (!list) return;
  if (!currentUser) {
    renderSessions([]);
    return;
  }
  try {
    const response = await apiFetch("/api/auth/sessions");
    const result = await readApiJson(response);
    if (!response.ok)
      throw new Error(result.error || "Could not load sessions.");
    renderSessions(Array.isArray(result.sessions) ? result.sessions : []);
  } catch (error) {
    const note = document.createElement("p");
    note.className = "sessions-empty";
    note.textContent = error.message || "Sessions are unavailable.";
    list.replaceChildren(note);
  }
}

function resetAccountState() {
  currentUser = null;
  accountPrompts = [];
  currentId = null;
  localStorage.removeItem(DRAFT_KEY);
  currentAnalysis = null;
  $("ideaInput").value = "";
  setForm({});
  renderInterpretation(null);
  updateIdeaButton();
  switchView("builder");
  renderAccount();
  renderShell();
}

async function signOut(all = false) {
  const response = await apiFetch(
    all ? "/api/auth/logout-all" : "/api/auth/logout",
    { method: "POST" },
  ).catch(() => null);
  if (!response?.ok) {
    showToast("Could not sign out. Try again.");
    return;
  }
  resetAccountState();
  showToast("Signed out.");
}

async function enhancePrompt() {
  if (!aiAvailable || aiBusy || !elements.task.value.trim()) return;
  const original = dataFromForm();
  aiBusy = true;
  $("enhanceButton").disabled = true;
  $("enhanceButton").classList.add("busy");
  $("aiStatus").textContent = "Improving your prompt…";
  try {
    const response = await apiFetch("/api/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(original),
    });
    const result = await readApiJson(response);
    if (!response.ok)
      throw new Error(result.error || "AI suggestions are unavailable.");
    if (JSON.stringify(original) !== JSON.stringify(dataFromForm())) {
      showToast("Your draft changed. AI suggestions were not applied.");
      return;
    }
    currentId = null;
    currentAnalysis = null;
    setForm(result.data);
    renderInterpretation(null);
    showToast(
      `Prompt enhanced with ${result.provider}. Review before using it.`,
    );
  } catch (error) {
    showToast(error.message || "AI suggestions are unavailable.");
  } finally {
    aiBusy = false;
    $("enhanceButton").classList.remove("busy");
    $("aiStatus").textContent =
      "Sends this draft to your configured AI provider";
    updatePreview();
  }
}

async function runPrompt() {
  const prompt = buildPrompt(dataFromForm());
  if (!prompt) {
    showToast("Add a task first.");
    return;
  }
  if (!aiAvailable) {
    showToast("Add a provider key in Settings to run prompts.");
    return;
  }
  if (runBusy) return;
  runBusy = true;
  const button = $("runButton");
  button.disabled = true;
  button.classList.add("busy");
  $("runNote").textContent = "Running your prompt…";
  try {
    const response = await apiFetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const result = await readApiJson(response);
    if (!response.ok)
      throw new Error(result.error || "The prompt could not be run.");
    $("runCard").hidden = false;
    $("runOutput").textContent = result.text;
    $("runProvider").textContent = result.provider
      ? `via ${result.provider}`
      : "";
    $("runCard").scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch (error) {
    showToast(error.message || "The prompt could not be run.");
  } finally {
    runBusy = false;
    button.classList.remove("busy");
    $("runNote").textContent = aiAvailable
      ? "Tests this prompt on your configured AI"
      : "Add a provider key in Settings to run prompts";
    updatePreview();
  }
}

async function copyRunOutput() {
  const text = $("runOutput").textContent;
  if (!text) return;
  try {
    if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText(text);
    else throw new Error("Copy unavailable");
    showToast("Response copied to clipboard.");
  } catch {
    showToast("Copy unavailable. Select the response to copy it.");
  }
}

function updatePreview() {
  const data = dataFromForm();
  const prompt = buildPrompt(data);
  const output = $("promptOutput");
  output.textContent =
    prompt ||
    "Your prompt will appear here. Start with a rough idea, or open the details editor to build it yourself.";
  output.classList.toggle("is-empty", !prompt);
  $("wordCount").textContent =
    `${prompt ? prompt.split(/\s+/).length : 0} words`;
  $("copyButton").disabled = !prompt;
  $("downloadButton").disabled = !prompt;
  $("saveButton").disabled = !prompt;
  $("runButton").disabled = !prompt || !aiAvailable || runBusy;
  $("readyBadge").style.visibility = prompt ? "visible" : "hidden";
  $("enhanceButton").disabled = !prompt || !aiAvailable || aiBusy;
  if (currentAnalysis) {
    $("ideaDepthBadge").textContent = `${data.depth || "Balanced"} depth`;
    $("ideaDepthReason").textContent =
      currentAnalysis.originalDepth &&
      currentAnalysis.originalDepth !== data.depth
        ? `You changed the answer depth from ${currentAnalysis.originalDepth} to ${data.depth || "an unspecified depth"}.`
        : currentAnalysis.whyThisDepth || "";
    renderApproach();
  }
  const checks = [
    Boolean(data.task),
    Boolean(data.role || data.audience),
    Boolean(data.context),
    Boolean(data.format || data.tone),
    Boolean(data.constraints || data.focus),
  ];
  const score = checks.filter(Boolean).length;
  $("qualityScore").textContent = score;
  document
    .querySelectorAll("#scoreBars i")
    .forEach((bar, index) => bar.classList.toggle("filled", index < score));
  const advice = !data.task
    ? ["A good start", "Add your task to get started."]
    : !data.context
      ? [
          "Add some context",
          "A little background helps AI make a more useful answer.",
        ]
      : !data.format && !data.tone
        ? [
            "Shape the result",
            "Choose a format or tone to make the answer easier to use.",
          ]
        : !data.constraints && !data.focus
          ? [
              "Almost there",
              "Add priorities or must-have details for a more focused result.",
            ]
          : [
              "Looking strong",
              "Your prompt gives AI a clear direction to follow.",
            ];
  $("qualityTitle").textContent = advice[0];
  $("qualityTip").textContent = advice[1];
}

async function copyPrompt() {
  const prompt = buildPrompt(dataFromForm());
  if (!prompt) {
    showToast("Add a task first.");
    return false;
  }
  try {
    if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText(prompt);
    else {
      const textArea = document.createElement("textarea");
      textArea.value = prompt;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.append(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      textArea.remove();
      if (!copied) throw new Error("Copy failed");
    }
    showToast("Prompt copied to clipboard.");
    return true;
  } catch {
    showToast("Copy unavailable. Select the preview text to copy it.");
    return false;
  }
}

async function savePrompt(name, tags = []) {
  if (databaseAvailable && !currentUser) {
    pendingSave = true;
    openAuth();
    return;
  }
  const data = dataFromForm();
  if (!data.task) return;
  const saved = getSaved();
  const existing = currentId ? findPrompt(currentId) : null;
  const item = {
    id: existing?.id || crypto.randomUUID(),
    name: name.trim(),
    data,
    idea: $("ideaInput").value.trim(),
    analysis: currentAnalysis,
    tags,
    updatedAt: new Date().toISOString(),
  };
  const next = [item, ...saved.filter((entry) => entry.id !== item.id)];
  try {
    if (databaseAvailable && currentUser) {
      const response = await libraryFetch("/api/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const result = await readApiJson(response);
      if (!response.ok)
        throw new Error(result.error || "Could not save to the database.");
      Object.assign(item, result.prompt);
    }
    if (currentUser && !existing) libraryTotal++;
    if ($("librarySearch").value) {
      $("librarySearch").value = "";
      searchResults = [];
      searchRequest++;
    }
    setSaved(next);
    currentId = item.id;
    showToast(
      existing
        ? "Prompt updated in your library."
        : "Prompt saved to your library.",
    );
  } catch (error) {
    showToast(
      error.message || "Storage is unavailable. Download the prompt instead.",
    );
  }
}

function renderTemplates() {
  $("templateNav").replaceChildren(
    ...templates.map((template) => {
      const button = document.createElement("button");
      button.className = "template-item";
      button.type = "button";
      const icon = document.createElement("span");
      icon.className = "template-glyph";
      icon.textContent = template.icon;
      const label = document.createElement("span");
      label.textContent = template.name;
      button.append(icon, label);
      button.addEventListener("click", () => {
        currentId = null;
        currentAnalysis = null;
        $("ideaInput").value = "";
        setForm(template.data);
        renderInterpretation(null);
        setComposerExpanded(true);
        updateIdeaButton();
        $("ideaStatus").textContent = "Add a new idea whenever you like";
        switchView("builder");
        showToast(`${template.name} template loaded.`);
      });
      return button;
    }),
  );
}

async function publishPrompt(item, published) {
  const response = await libraryFetch(`/api/prompts/${item.id}/public`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published }),
  });
  const result = await readApiJson(response);
  if (!response.ok)
    throw new Error(result.error || "Could not change sharing.");
  const saved = getSaved();
  const current = saved.find((prompt) => prompt.id === item.id);
  if (current) Object.assign(current, result.prompt);
  const searched = searchResults.find((prompt) => prompt.id === item.id);
  if (searched) Object.assign(searched, result.prompt);
  setSaved([...saved]);
  return result.prompt;
}

function showShareDialog(item) {
  currentSharePromptId = item.id;
  $("shareLink").value = `${window.location.origin}/p/${item.publicId}`;
  $("shareFeedback").textContent = "";
  $("shareDialog").showModal();
  $("shareLink").select();
}

async function openShare(item) {
  if (!currentUser) {
    showToast("Sign in to share a prompt.");
    return;
  }
  if (
    !item.publicId &&
    !confirm(
      "Make this prompt public? Anyone with the link can view and copy its finished prompt.",
    )
  )
    return;
  try {
    showShareDialog(item.publicId ? item : await publishPrompt(item, true));
  } catch (error) {
    showToast(error.message || "Could not create a public link.");
  }
}

function diffLine(type, text) {
  const line = document.createElement("div");
  line.className = `history-diff-line is-${type}`;
  line.textContent = text;
  return line;
}

function buildHistoryDiff(panel, current, revision) {
  const changes = window.PromptDockDiff.diffPrompt(current, revision);
  panel.replaceChildren();
  if (!changes.length) {
    const note = document.createElement("p");
    note.className = "history-diff-empty";
    note.textContent = "Identical to your current version.";
    panel.append(note);
    return;
  }
  const legend = document.createElement("p");
  legend.className = "history-diff-legend";
  const lost = document.createElement("span");
  lost.className = "is-del";
  lost.textContent = "− lost";
  const restored = document.createElement("span");
  restored.className = "is-add";
  restored.textContent = "+ restored";
  legend.append(
    "Restoring this version changes these parts: ",
    lost,
    " goes away, ",
    restored,
    " comes back.",
  );
  panel.append(legend);
  for (const change of changes) {
    const field = document.createElement("div");
    field.className = "history-diff-field";
    const label = document.createElement("div");
    label.className = "history-diff-label";
    label.textContent = change.label;
    field.append(label);
    if (change.type === "tags") {
      for (const tag of change.added) field.append(diffLine("add", `+ ${tag}`));
      for (const tag of change.removed)
        field.append(diffLine("del", `− ${tag}`));
    } else {
      const result = window.PromptDockDiff.compact(change.ops);
      for (const op of result.ops) {
        const marker =
          op.type === "del" ? "− " : op.type === "add" ? "+ " : "  ";
        field.append(diffLine(op.type, `${marker}${op.text}`));
      }
      if (result.truncated) {
        const note = document.createElement("div");
        note.className = "history-diff-truncated";
        note.textContent = "… long difference shortened";
        field.append(note);
      }
    }
    panel.append(field);
  }
}

async function openHistory(item) {
  currentHistoryPromptId = item.id;
  const list = $("historyList");
  list.textContent = "Loading earlier versions…";
  $("historyDialog").showModal();
  try {
    const response = await libraryFetch(`/api/prompts/${item.id}/revisions`);
    const result = await readApiJson(response);
    if (!response.ok)
      throw new Error(result.error || "Could not load history.");
    list.replaceChildren();
    if (!result.revisions.length) {
      list.textContent =
        "No earlier versions yet. Edit and save this prompt to create one.";
      return;
    }
    for (const revision of result.revisions) {
      const entry = document.createElement("div");
      entry.className = "history-entry";
      const row = document.createElement("div");
      row.className = "history-row";
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = revision.name;
      const date = document.createElement("small");
      date.textContent = new Date(revision.createdAt).toLocaleString();
      const task = document.createElement("p");
      task.textContent = revision.data.task;
      details.append(title, date, task);
      const actions = document.createElement("div");
      actions.className = "history-actions";
      const panel = document.createElement("div");
      panel.className = "history-diff hidden";
      const compare = document.createElement("button");
      compare.type = "button";
      compare.className = "text-button";
      compare.textContent = "Compare";
      let compared = false;
      compare.addEventListener("click", () => {
        if (!compared) {
          buildHistoryDiff(
            panel,
            findPrompt(currentHistoryPromptId) || item,
            revision,
          );
          compared = true;
        }
        panel.classList.toggle("hidden");
        compare.textContent = panel.classList.contains("hidden")
          ? "Compare"
          : "Hide diff";
      });
      const restore = document.createElement("button");
      restore.type = "button";
      restore.className = "secondary-button";
      restore.textContent = "Restore";
      restore.addEventListener("click", async () => {
        if (!confirm(`Restore “${revision.name}” from ${date.textContent}?`))
          return;
        restore.disabled = true;
        try {
          const response = await libraryFetch(
            `/api/prompts/${currentHistoryPromptId}/revisions/${revision.revisionId}/restore`,
            { method: "POST" },
          );
          const result = await readApiJson(response);
          if (!response.ok)
            throw new Error(result.error || "Could not restore this version.");
          setSaved([
            result.prompt,
            ...getSaved().filter((entry) => entry.id !== result.prompt.id),
          ]);
          const searched = searchResults.find(
            (entry) => entry.id === result.prompt.id,
          );
          if (searched) Object.assign(searched, result.prompt);
          if (currentId === result.prompt.id) {
            $("ideaInput").value = result.prompt.idea || "";
            currentAnalysis = result.prompt.analysis;
            setForm(result.prompt.data);
            renderInterpretation(currentAnalysis);
          }
          $("historyDialog").close();
          showToast("Earlier version restored.");
        } catch (error) {
          showToast(error.message);
          restore.disabled = false;
        }
      });
      actions.append(compare, restore);
      row.append(details, actions);
      entry.append(row, panel);
      list.append(entry);
    }
  } catch (error) {
    list.textContent = error.message || "Could not load history.";
  }
}

function libraryFiltered() {
  return Boolean(
    $("librarySearch").value.trim() || activeTag || librarySort !== "updated",
  );
}

function localTagCounts() {
  const counts = new Map();
  for (const item of getSaved())
    for (const tag of item.tags || [])
      counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function renderTagChips() {
  const container = $("tagChips");
  if (!container) return;
  const tags = currentUser ? remoteTags : localTagCounts();
  container.replaceChildren();
  const entries = [...tags];
  if (activeTag && !entries.some((entry) => entry.tag === activeTag))
    entries.unshift({ tag: activeTag, count: 0 });
  if (!entries.length) {
    const hint = document.createElement("span");
    hint.className = "tag-chips-empty";
    hint.textContent = "Tag prompts when saving to filter them here.";
    container.append(hint);
    return;
  }
  for (const entry of entries) {
    const active = entry.tag === activeTag;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `tag-chip${active ? " is-active" : ""}`;
    chip.textContent = active
      ? `✕ ${entry.tag}`
      : `${entry.tag} · ${entry.count}`;
    chip.setAttribute("aria-pressed", String(active));
    chip.addEventListener("click", () => {
      activeTag = active ? "" : entry.tag;
      renderTagChips();
      if (currentUser) reloadLibrary();
      else renderLibrary();
    });
    container.append(chip);
  }
}

async function refreshTagChips() {
  if (!currentUser || !databaseAvailable) {
    remoteTags = [];
    renderTagChips();
    return;
  }
  try {
    const response = await libraryFetch("/api/prompts/tags");
    const result = await readApiJson(response);
    if (response.ok) {
      remoteTags = Array.isArray(result.tags) ? result.tags : [];
      renderTagChips();
    }
  } catch {
    /* tag chips are optional */
  }
}

async function reloadLibrary() {
  if (!currentUser) {
    renderLibrary();
    return;
  }
  const requestId = ++searchRequest;
  const q = $("librarySearch").value.trim();
  const keep = Math.max(searchResults.length, 100);
  try {
    const results = [];
    let total = 0;
    while (results.length < keep) {
      const page = await fetchLibraryPage(q, results.length);
      if (requestId !== searchRequest) return;
      total = page.total;
      results.push(...page.prompts);
      if (page.prompts.length === 0) break;
    }
    if (requestId !== searchRequest) return;
    searchResults = results;
    searchTotal = total;
    renderLibrary();
  } catch (error) {
    showToast(error.message);
  }
}

function localLibraryItems() {
  const query = $("librarySearch").value.toLowerCase().trim();
  const items = getSaved().filter((item) => {
    if (activeTag && !(item.tags || []).includes(activeTag)) return false;
    if (!query) return true;
    return `${item.name} ${item.idea || ""} ${Object.values(item.data).join(" ")} ${(item.tags || []).join(" ")}`
      .toLowerCase()
      .includes(query);
  });
  if (librarySort === "name")
    items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

function renderLibrary() {
  const saved = getSaved();
  const query = $("librarySearch").value.toLowerCase().trim();
  const narrowed = Boolean(query || activeTag || librarySort !== "updated");
  const filtered = currentUser
    ? libraryFiltered()
      ? searchResults
      : saved
    : localLibraryItems();
  const total = currentUser
    ? libraryFiltered()
      ? searchTotal
      : libraryTotal
    : filtered.length;
  if (!currentUser) renderTagChips();
  $("libraryCount").textContent = currentUser ? libraryTotal : saved.length;
  $("librarySummary").textContent =
    `${total} ${narrowed ? "matching" : "saved"} prompt${total === 1 ? "" : "s"}`;
  $("libraryLoadMore").classList.toggle(
    "hidden",
    !currentUser || filtered.length >= total,
  );
  const grid = $("libraryGrid");
  grid.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">✳</div><h3>${narrowed ? "No matching prompts" : "Your library starts here"}</h3><p>${narrowed ? "Try a different search term, or clear the tag filter." : "Save a prompt from the builder and it will appear here."}</p>`;
    if (!narrowed) {
      const button = document.createElement("button");
      button.className = "primary-button";
      button.textContent = "Create a prompt";
      button.addEventListener("click", () => switchView("builder"));
      empty.append(button);
    }
    grid.append(empty);
    return;
  }
  for (const item of filtered) {
    const card = document.createElement("article");
    card.className = "library-card";
    const top = document.createElement("div");
    top.className = "library-card-top";
    const icon = document.createElement("span");
    icon.className = "library-card-icon";
    icon.textContent = "✦";
    const deleteButton = document.createElement("button");
    deleteButton.className = "card-menu";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Delete ${item.name}`);
    deleteButton.title = "Delete prompt";
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", async () => {
      if (!confirm(`Delete “${item.name}”?`)) return;
      if (databaseAvailable && currentUser) {
        try {
          const response = await libraryFetch(`/api/prompts/${item.id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Could not delete this prompt.");
        } catch {
          showToast("Could not delete this prompt. Try again.");
          return;
        }
      }
      if (currentUser) {
        libraryTotal = Math.max(0, libraryTotal - 1);
        searchTotal = Math.max(0, searchTotal - 1);
        searchResults = searchResults.filter((entry) => entry.id !== item.id);
      }
      setSaved(getSaved().filter((entry) => entry.id !== item.id));
      if (currentId === item.id) currentId = null;
      showToast("Prompt deleted.");
    });
    top.append(icon, deleteButton);
    const title = document.createElement("h3");
    title.textContent = item.name;
    const summary = document.createElement("p");
    summary.textContent = item.data.task;
    const sharing = document.createElement("div");
    sharing.className = "library-sharing";
    const visibility = document.createElement("span");
    visibility.className = item.publicId
      ? "visibility-badge is-public"
      : "visibility-badge";
    visibility.textContent = item.publicId ? "● Public" : "○ Private";
    const share = document.createElement("button");
    share.type = "button";
    share.className = "library-share-button";
    share.textContent = item.publicId ? "Share link ↗" : "Publish & share ↗";
    share.addEventListener("click", () => openShare(item));
    sharing.append(visibility, share);
    if (currentUser) {
      const history = document.createElement("button");
      history.type = "button";
      history.className = "library-share-button";
      history.textContent = "History ↶";
      history.addEventListener("click", () => openHistory(item));
      sharing.append(history);
    }
    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.className = "library-share-button";
    duplicate.textContent = "Duplicate +";
    duplicate.addEventListener("click", async () => {
      try {
        let copy;
        if (currentUser) {
          const response = await libraryFetch(
            `/api/prompts/${item.id}/duplicate`,
            { method: "POST" },
          );
          const result = await readApiJson(response);
          if (!response.ok)
            throw new Error(result.error || "Could not duplicate prompt.");
          copy = result.prompt;
          libraryTotal++;
        } else
          copy = {
            ...item,
            id: crypto.randomUUID(),
            name: `${item.name.slice(0, 75)} copy`,
            publicId: null,
            forkedFrom: null,
            updatedAt: new Date().toISOString(),
          };
        if ($("librarySearch").value) {
          $("librarySearch").value = "";
          searchResults = [];
          searchRequest++;
        }
        setSaved([copy, ...getSaved()]);
        showToast("Private copy added to your library.");
      } catch (error) {
        showToast(error.message);
      }
    });
    sharing.append(duplicate);
    const footer = document.createElement("div");
    footer.className = "library-card-footer";
    const date = document.createElement("span");
    date.textContent = new Date(item.updatedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const open = document.createElement("button");
    open.textContent = "Open prompt →";
    open.addEventListener("click", () => {
      currentId = item.id;
      currentAnalysis = item.analysis || null;
      $("ideaInput").value = item.idea || "";
      setForm(item.data);
      renderInterpretation(currentAnalysis);
      updateIdeaButton();
      switchView("builder");
    });
    const tags = document.createElement("div");
    tags.className = "prompt-tags";
    for (const tag of item.tags || []) {
      const badge = document.createElement("span");
      badge.textContent = tag;
      tags.append(badge);
    }
    footer.append(date, open);
    card.append(top, title, summary, tags, sharing, footer);
    grid.append(card);
  }
}

function switchView(view) {
  if (view !== "builder") {
    if (voiceState === "recording") {
      voiceCancelReason = "Recording discarded when leaving the idea page.";
      stopVoiceRecording(false);
    } else if (voiceState === "requesting") {
      voiceRequestId++;
      voiceState = "idle";
      $("voiceStatus").textContent = "Recording cancelled.";
      updateIdeaButton();
    }
  }
  $("builderView").classList.toggle("hidden", view !== "builder");
  $("libraryView").classList.toggle("hidden", view !== "library");
  $("settingsView").classList.toggle("hidden", view !== "settings");
  $("breadcrumbCurrent").textContent =
    { builder: "Idea to prompt", library: "My library", settings: "Settings" }[
      view
    ] || "Workspace";
  document
    .querySelectorAll(".nav-item")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.view === view),
    );
  $("sidebar").classList.remove("open");
  $("menuButton").setAttribute("aria-expanded", "false");
  $("sidebarOverlay").classList.remove("visible");
  if (view === "library") {
    renderLibrary();
    refreshTagChips();
  }
  if (view === "settings") loadSettings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function downloadPrompt() {
  const prompt = buildPrompt(dataFromForm());
  if (!prompt) return;
  const name =
    getSaved().find((item) => item.id === currentId)?.name || "My prompt";
  const markdown = `# ${name}\n\n${prompt}\n`;
  const url = URL.createObjectURL(
    new Blob([markdown], { type: "text/markdown" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "prompt"
  }.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Prompt downloaded.");
}

initCustomSelects();
setComposerExpanded(false);
fields.forEach((field) =>
  elements[field].addEventListener(
    Object.hasOwn(selectOptions, field) ? "change" : "input",
    () => {
      updatePreview();
      persistDraft();
    },
  ),
);
$("toggleComposer").addEventListener("click", () =>
  setComposerExpanded($("promptForm").classList.contains("collapsed")),
);
$("ideaInput").addEventListener("input", () => {
  if (currentAnalysis) {
    currentAnalysis = null;
    renderInterpretation(null);
  }
  persistDraft();
  updateIdeaButton();
  $("ideaStatus").textContent = aiAvailable
    ? "Ready to turn this idea into a prompt"
    : "Add an API key to .env to use AI";
});
$("ideaGenerateButton").addEventListener("click", generateIdeaPrompt);
$("micButton").addEventListener("click", () => {
  if (voiceState === "recording") stopVoiceRecording(true);
  else startVoiceRecording();
});
$("voiceCancelButton").addEventListener("click", () =>
  stopVoiceRecording(false),
);
document.querySelectorAll(".idea-example").forEach((button) =>
  button.addEventListener("click", () => {
    $("ideaInput").value = button.dataset.example;
    $("ideaInput").dispatchEvent(new Event("input"));
    $("ideaInput").focus();
  }),
);
$("enhanceButton").addEventListener("click", enhancePrompt);
$("promptForm").addEventListener("submit", (event) => event.preventDefault());
document
  .querySelectorAll(".nav-item")
  .forEach((item) =>
    item.addEventListener("click", () => switchView(item.dataset.view)),
  );
$("librarySearch").addEventListener("input", () => {
  if (!currentUser) {
    renderLibrary();
    return;
  }
  clearTimeout(searchTimer);
  const requestId = ++searchRequest;
  const q = $("librarySearch").value.trim();
  if (!q && !activeTag && librarySort === "updated") {
    searchResults = [];
    searchTotal = 0;
    renderLibrary();
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const page = await fetchLibraryPage(q);
      if (requestId !== searchRequest) return;
      searchResults = page.prompts;
      searchTotal = page.total;
      renderLibrary();
    } catch (error) {
      if (requestId === searchRequest) showToast(error.message);
    }
  }, 250);
});
$("libraryLoadMore").addEventListener("click", async () => {
  const button = $("libraryLoadMore");
  button.disabled = true;
  const q = $("librarySearch").value.trim();
  const requestId = searchRequest;
  const filtered = libraryFiltered();
  try {
    const items = filtered ? searchResults : accountPrompts;
    const page = await fetchLibraryPage(q, items.length);
    if (requestId !== searchRequest) return;
    if (filtered) {
      searchResults.push(...page.prompts);
      searchTotal = page.total;
    } else {
      accountPrompts.push(...page.prompts);
      libraryTotal = page.total;
    }
    renderLibrary();
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});
$("librarySort").addEventListener("change", () => {
  librarySort = $("librarySort").value;
  if (currentUser) reloadLibrary();
  else renderLibrary();
});
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBackupTimestamp(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  if (time < Date.parse("2000-01-01") || time > Date.now() + 86400000)
    return null;
  return new Date(time).toISOString();
}

$("backupExport").addEventListener("click", async () => {
  const button = $("backupExport");
  button.disabled = true;
  button.textContent = "Preparing backup…";
  try {
    let prompts = getSaved();
    if (currentUser) {
      const response = await libraryFetch("/api/prompts/export");
      const result = await readApiJson(response);
      if (!response.ok)
        throw new Error(result.error || "Could not export your library.");
      prompts = Array.isArray(result.prompts) ? result.prompts : [];
    }
    const backup = {
      app: "PromptDock",
      version: 1,
      exportedAt: new Date().toISOString(),
      prompts: prompts.map(
        ({
          id,
          name,
          data,
          idea,
          analysis,
          tags,
          updatedAt,
          publicId,
          forkedFrom,
        }) => ({
          id,
          name,
          data,
          idea: idea || "",
          analysis: analysis || null,
          tags: tags || [],
          updatedAt: updatedAt || null,
          publicId: publicId || null,
          forkedFrom: forkedFrom || null,
        }),
      ),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `promptdock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported ${prompts.length} prompts.`);
  } catch (error) {
    showToast(error.message || "Could not export your library.");
  } finally {
    button.disabled = false;
    button.textContent = "Export JSON ↓";
  }
});
$("backupImport").addEventListener("click", () => $("backupFile").click());
$("backupFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const button = $("backupImport");
  button.disabled = true;
  button.textContent = "Importing…";
  let imported = 0;
  try {
    if (file.size > 25000000)
      throw new Error("Backup is too large (25 MB maximum).");
    const backup = JSON.parse(await file.text());
    if (
      backup.app !== "PromptDock" ||
      backup.version !== 1 ||
      !Array.isArray(backup.prompts) ||
      !backup.prompts.length ||
      backup.prompts.length > 10000
    )
      throw new Error("Choose a PromptDock JSON backup with 1–10,000 prompts.");
    if (currentUser) {
      for (let i = 0; i < backup.prompts.length; i += 25) {
        const response = await libraryFetch("/api/prompts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: 1,
            prompts: backup.prompts.slice(i, i + 25),
          }),
        });
        const result = await readApiJson(response);
        if (!response.ok)
          throw new Error(result.error || "Could not import prompts.");
        imported += result.imported;
        button.textContent = `Importing ${imported}/${backup.prompts.length}…`;
      }
      const page = await fetchLibraryPage();
      accountPrompts = page.prompts;
      libraryTotal = page.total;
    } else {
      const existingIds = new Set(getSaved().map((prompt) => prompt.id));
      const copies = backup.prompts.map((prompt) => {
        if (
          typeof prompt.name !== "string" ||
          !prompt.name.trim() ||
          !prompt.data ||
          typeof prompt.data.task !== "string" ||
          !prompt.data.task.trim()
        )
          throw new Error("Backup contains an invalid prompt.");
        const keepId =
          UUID_PATTERN.test(prompt.id || "") && !existingIds.has(prompt.id);
        const id = keepId ? prompt.id : crypto.randomUUID();
        existingIds.add(id);
        return {
          id,
          name: prompt.name.slice(0, 120),
          data: prompt.data,
          idea: prompt.idea || "",
          analysis: prompt.analysis || null,
          tags: Array.isArray(prompt.tags) ? prompt.tags : [],
          updatedAt:
            normalizeBackupTimestamp(prompt.updatedAt) ||
            new Date().toISOString(),
        };
      });
      imported = copies.length;
      setSaved([...copies, ...getSaved()]);
    }
    $("librarySearch").value = "";
    searchResults = [];
    searchRequest++;
    renderLibrary();
    refreshTagChips();
    showToast(`Imported ${imported} private prompts.`);
  } catch (error) {
    if (imported && currentUser) {
      try {
        const page = await fetchLibraryPage();
        accountPrompts = page.prompts;
        libraryTotal = page.total;
        renderLibrary();
      } catch {
        /* Keep the imported count visible. */
      }
    }
    showToast(
      imported
        ? `Imported ${imported} prompts; stopped: ${error.message}`
        : error.message || "Could not import backup.",
    );
  } finally {
    button.disabled = false;
    button.textContent = "Import JSON ↑";
    event.target.value = "";
  }
});
$("clearButton").addEventListener("click", () => {
  currentId = null;
  currentAnalysis = null;
  $("ideaInput").value = "";
  setForm({});
  renderInterpretation(null);
  updateIdeaButton();
  $("ideaStatus").textContent = "Add your idea to begin";
  elements.task.focus();
  showToast("Prompt cleared.");
});
$("newPromptButton").addEventListener("click", () => {
  currentId = null;
  currentAnalysis = null;
  $("ideaInput").value = "";
  setForm({});
  renderInterpretation(null);
  setComposerExpanded(false);
  updateIdeaButton();
  $("ideaStatus").textContent = "Add your idea to begin";
  switchView("builder");
  $("ideaInput").focus();
});
$("copyButton").addEventListener("click", copyPrompt);
$("runButton").addEventListener("click", runPrompt);
$("runCopyButton").addEventListener("click", copyRunOutput);
$("runDismissButton").addEventListener("click", () => {
  $("runCard").hidden = true;
  $("runOutput").textContent = "";
  $("runProvider").textContent = "";
  updatePreview();
});
$("downloadButton").addEventListener("click", downloadPrompt);
$("saveButton").addEventListener("click", () => {
  if (!elements.task.value.trim()) return;
  if (databaseAvailable && !currentUser) {
    pendingSave = true;
    openAuth();
    return;
  }
  const existing = findPrompt(currentId);
  $("promptName").value = existing?.name || suggestedPromptName();
  $("promptTags").value = (existing?.tags || []).join(", ");
  $("saveDialog").showModal();
  $("promptName").focus();
});
$("cancelSave").addEventListener("click", () => $("saveDialog").close());
$("closeShare").addEventListener("click", () => $("shareDialog").close());
$("closeHistory").addEventListener("click", () => $("historyDialog").close());
$("copyShareLink").addEventListener("click", async () => {
  try {
    if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText($("shareLink").value);
    else {
      $("shareLink").select();
      if (!document.execCommand("copy")) throw new Error("Copy failed");
    }
    $("shareFeedback").textContent =
      "Link copied. Anyone with it can view this prompt.";
  } catch {
    $("shareFeedback").textContent = "Select the link above to copy it.";
    $("shareLink").select();
  }
});
$("unpublishPrompt").addEventListener("click", async () => {
  const item = getSaved().find((prompt) => prompt.id === currentSharePromptId);
  if (!item) return;
  try {
    await publishPrompt(item, false);
    $("shareDialog").close();
    showToast("Prompt is private. The old link no longer works.");
  } catch (error) {
    $("shareFeedback").textContent =
      error.message || "Could not make this prompt private.";
  }
});
$("saveForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("promptName").value.trim();
  if (!name) return;
  const tags = [
    ...new Set(
      $("promptTags")
        .value.split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (
    tags.length > 8 ||
    tags.some(
      (tag) => tag.length > 24 || !/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(tag),
    )
  ) {
    showToast("Use up to 8 tags, each 1–24 letters or numbers.");
    return;
  }
  await savePrompt(name, tags);
  $("saveDialog").close();
});
$("accountButton").addEventListener("click", () => switchView("settings"));
$("authForm").addEventListener("submit", submitAuth);
$("authToggle").addEventListener("click", () =>
  openAuth(authMode === "login" ? "register" : "login"),
);
$("authForgot").addEventListener("click", () => openAuth("forgot"));
$("closeAuth").addEventListener("click", () => {
  pendingSave = false;
  $("authDialog").close();
});
$("authDialog").addEventListener("close", () => {
  if (!currentUser) pendingSave = false;
});
$("sidebarSignOut").addEventListener("click", () => signOut());
$("logoutAllButton").addEventListener("click", () => signOut(true));
$("deleteAccountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = $("deleteAccountFeedback");
  const button = $("deleteAccountForm").querySelector("button[type=submit]");
  feedback.textContent = "";
  feedback.classList.remove("error");
  if (
    !confirm(
      "Delete your PromptDock account, every saved prompt, and all sessions? This cannot be undone.",
    )
  )
    return;
  button.disabled = true;
  try {
    const response = await apiFetch("/api/auth/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("deleteAccountPassword").value }),
    });
    const result = await readApiJson(response);
    if (!response.ok)
      throw new Error(result.error || "Could not delete your account.");
    resetAccountState();
    event.target.reset();
    showToast("Your account and its prompts were deleted.");
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.add("error");
  } finally {
    button.disabled = false;
  }
});
document
  .querySelectorAll("[data-auth-mode]")
  .forEach((button) =>
    button.addEventListener("click", () => openAuth(button.dataset.authMode)),
  );
document
  .querySelectorAll(".provider-option")
  .forEach((button) =>
    button.addEventListener("click", () =>
      selectProvider(button.dataset.provider),
    ),
  );
$("byokForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = $("byokFeedback");
  feedback.textContent = "";
  feedback.classList.remove("error");
  try {
    const response = await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: selectedProvider,
        model: $("byokModel").value,
        apiKey: $("byokKey").value,
      }),
    });
    const result = await readApiJson(response);
    if (!response.ok)
      throw new Error(result.error || "Could not save provider settings.");
    feedback.textContent =
      "Provider saved. Your next AI request will use this key and model.";
    await loadAiStatus();
  } catch (error) {
    feedback.textContent = error.message || "Could not save provider settings.";
    feedback.classList.add("error");
  }
});
$("removeByok").addEventListener("click", async () => {
  const feedback = $("byokFeedback");
  feedback.textContent = "";
  feedback.classList.remove("error");
  try {
    const response = await apiFetch("/api/settings", { method: "DELETE" });
    if (!response.ok) throw new Error("Could not remove your key.");
    feedback.textContent =
      "Your saved key was removed. PromptDock’s provider is active.";
    await loadAiStatus();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.add("error");
  }
});
$("passwordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = $("passwordFeedback");
  feedback.textContent = "";
  feedback.classList.remove("error");
  try {
    const response = await apiFetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: $("currentPassword").value,
        newPassword: $("newPassword").value,
      }),
    });
    const result = await readApiJson(response);
    if (!response.ok)
      throw new Error(result.error || "Could not change your password.");
    $("passwordForm").reset();
    feedback.textContent = "Password changed. Other sessions were signed out.";
  } catch (error) {
    feedback.textContent = error.message || "Could not change your password.";
    feedback.classList.add("error");
  }
});
$("helpButton").addEventListener("click", () => $("helpDialog").showModal());
$("closeHelp").addEventListener("click", () => $("helpDialog").close());
$("gotItButton").addEventListener("click", () => $("helpDialog").close());
$("menuButton").addEventListener("click", () => {
  const open = $("sidebar").classList.toggle("open");
  $("sidebarOverlay").classList.toggle("visible", open);
  $("menuButton").setAttribute("aria-expanded", String(open));
});
$("sidebarOverlay").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("visible");
  $("menuButton").setAttribute("aria-expanded", "false");
});
window.addEventListener("pagehide", () => {
  voiceRequestId++;
  if (voiceState === "recording") stopVoiceRecording(false);
  else stopVoiceTracks();
});
document.querySelectorAll(".platform-card").forEach((card) =>
  card.addEventListener("click", async () => {
    const url = platformUrls[card.dataset.platform];
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    if (buildPrompt(dataFromForm())) await copyPrompt();
    if (tab) tab.location.href = url;
    else window.location.href = url;
  }),
);
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    if (document.activeElement === $("ideaInput")) generateIdeaPrompt();
    else copyPrompt();
  }
});

const demoExamples = {
  business: {
    idea: "I want to launch a small skincare brand, but I don't know where to begin.",
    goal: "Build a practical launch plan for a handmade skincare business.",
    focus: "First steps → product validation → realistic launch costs.",
    format: "Step-by-step plan with open questions.",
    depth: "Deep",
  },
  app: {
    idea: "I have an app idea for helping people plan meals from what is already in their fridge.",
    goal: "Plan a useful first version of a meal-planning app.",
    focus: "Core user need → smallest useful feature set → launch risks.",
    format: "Product outline and prioritized next steps.",
    depth: "Deep",
  },
  study: {
    idea: "I need a better way to study for a big exam next month.",
    goal: "Create a realistic study plan for the next four weeks.",
    focus: "Time available → active recall → weekly check-ins.",
    format: "Weekly schedule with daily actions.",
    depth: "Balanced",
  },
};
let activeDemo = "business";
function showDemo(name) {
  activeDemo = name;
  const data = demoExamples[name];
  document
    .querySelectorAll(".demo-choice")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.demo === name),
    );
  $("demoOutput").classList.add("is-shaping");
  $("demoIdea").textContent = data.idea;
  setTimeout(() => {
    $("demoGoal").textContent = data.goal;
    $("demoFocus").textContent = data.focus;
    $("demoFormat").textContent = data.format;
    $("demoDepth").textContent = data.depth;
    $("demoOutput").classList.remove("is-shaping");
  }, 180);
}
document
  .querySelectorAll(".demo-choice")
  .forEach((button) =>
    button.addEventListener("click", () => showDemo(button.dataset.demo)),
  );
$("demoAction").addEventListener("click", () => {
  const names = Object.keys(demoExamples);
  showDemo(names[(names.indexOf(activeDemo) + 1) % names.length]);
});

renderTemplates();
$("appVersion").textContent = config.version;
const savedDraft = readJSON(DRAFT_KEY, {});
currentAnalysis = savedDraft.analysis || null;
$("ideaInput").value = savedDraft.idea || "";
setForm(savedDraft.data || savedDraft);
renderInterpretation(currentAnalysis);
renderLibrary();
(async () => {
  const forkIntent = captureForkIntent();
  const openLibrary = new URLSearchParams(window.location.search).has(
    "library",
  );
  await loadAiStatus();
  await handleAuthLink();
  if (currentUser) {
    const forked = await completePendingFork();
    if (!forked && openLibrary) switchView("library");
  } else if (forkIntent && !$("authDialog").open) openAuth("register");
})();
