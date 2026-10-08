// Conservative capability hints for models exposed in BYOK settings.
// Unknown models use PromptDock's configured vision provider for attachments.
function supportsImages(provider, model) {
  const id = String(model || "").toLowerCase();
  if (provider === "gemini") return /^gemini-(?:[2-9]|1\.5)/.test(id);
  if (provider === "anthropic" || provider === "anthropic_compatible")
    return /^claude-(?:3|4|sonnet-4|opus-4|haiku-4)/.test(id);
  if (provider === "openai" || provider === "openai_compatible")
    return /^(?:gpt-4o|gpt-4\.1|gpt-5|o[134]|chatgpt-4o)/.test(id);
  if (provider === "groq")
    return /(?:qwen3\.8|vision|vl|llama-4|llama-3\.2-\d+b-vision)/.test(id);
  if (provider === "apmix")
    return /(?:gpt-4o|gpt-4\.1|gpt-5|claude-(?:3|4|sonnet-4|opus-4|haiku-4)|gemini-[2-9]|qwen3\.8|vision|(?:^|[/-])vl(?:$|[/-]))/.test(
      id,
    );
  return false;
}

module.exports = { supportsImages };
