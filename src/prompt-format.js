window.PromptDockBuildPrompt = function buildPrompt(data) {
  if (!data?.task) return '';
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
};
