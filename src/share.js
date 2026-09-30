const sharedId = window.location.pathname.split("/").filter(Boolean).pop();
const shared = (id) => document.getElementById(id);
let sharedText = "";

async function loadSharedPrompt() {
  if (!/^[0-9a-f-]{36}$/i.test(sharedId || "")) {
    shared("sharedError").classList.remove("hidden");
    return;
  }
  try {
    const response = await fetch(`/api/public/prompts/${sharedId}`);
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("The prompt service is unavailable.");
    const result = await response.json();
    if (!response.ok || !result.prompt)
      throw new Error(result.error || "This prompt is unavailable.");
    const prompt = result.prompt;
    sharedText = window.PromptDockBuildPrompt(prompt.data);
    shared("sharedTitle").textContent = prompt.name;
    shared("sharedPrompt").textContent = sharedText;
    shared("sharedDepth").textContent =
      `${prompt.data.depth || "Balanced"} depth`;
    shared("sharedUpdated").textContent =
      `Updated ${new Date(prompt.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    document.title = `${prompt.name} — PromptDock`;
    shared("sharedContent").classList.remove("hidden");
  } catch (error) {
    shared("sharedTitle").textContent = "This prompt is unavailable";
    shared("sharedIntro").textContent =
      error.message || "The link may be incorrect or private.";
    shared("sharedError").classList.remove("hidden");
  }
}

shared("copyShared").addEventListener("click", async () => {
  try {
    if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText(sharedText);
    else {
      const textarea = document.createElement("textarea");
      textarea.value = sharedText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Copy failed");
    }
    shared("sharedFeedback").textContent =
      "Prompt copied. Paste it into your favorite AI tool.";
  } catch {
    shared("sharedFeedback").textContent =
      "Select the prompt above to copy it.";
    shared("sharedPrompt").focus();
  }
});

shared("saveShared").addEventListener("click", async () => {
  const button = shared("saveShared");
  button.disabled = true;
  shared("sharedFeedback").textContent = "Saving to your library…";
  try {
    const response = await fetch(`/api/public/prompts/${sharedId}/fork`, {
      method: "POST",
    });
    if (response.status === 401) {
      window.location.href = `/?fork=${sharedId}`;
      return;
    }
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("The prompt service is unavailable.");
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not save the prompt.");
    window.location.href = "/?library=1";
  } catch (error) {
    shared("sharedFeedback").textContent =
      error.message || "Could not save the prompt.";
    button.disabled = false;
  }
});

loadSharedPrompt();
