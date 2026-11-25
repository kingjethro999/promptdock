/**
 * Chat history, one conversation per prompt. A prompt that has not been saved
 * yet lives under "draft"; saving it moves the conversation to the prompt's
 * own id, so reopening that prompt from the library brings its chat back.
 */
export const DRAFT_CHAT = "draft";
export const NEW_PROMPT_EVENT = "promptdock:new-prompt";
const PREFIX = "promptdock.chat.v2:";
const MAX_TURNS = 20;

const keyFor = (id: string) => `${PREFIX}${id}`;

export function readChat<T>(id: string): T[] {
  try {
    const raw = window.localStorage.getItem(keyFor(id));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]).slice(-MAX_TURNS) : [];
  } catch {
    return [];
  }
}

export function writeChat<T>(id: string, turns: T[]) {
  try {
    if (!turns.length) window.localStorage.removeItem(keyFor(id));
    else
      window.localStorage.setItem(
        keyFor(id),
        JSON.stringify(turns.slice(-MAX_TURNS)),
      );
  } catch {
    // The conversation still works; it just won't survive a reload.
  }
}

export function removeChat(id: string) {
  try {
    window.localStorage.removeItem(keyFor(id));
  } catch {
    // Nothing to clean up.
  }
}

/** The sidebar's New Prompt: forget the draft and tell any open chat. */
export function announceNewPrompt() {
  removeChat(DRAFT_CHAT);
  window.dispatchEvent(new Event(NEW_PROMPT_EVENT));
}
