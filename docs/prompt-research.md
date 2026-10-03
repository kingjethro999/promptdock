# PromptDock prompt design notes

Researched on 29 September 2026 from official developer guidance:

- [Anthropic: prompting best practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables) recommends clear requests, relevant context, examples, and distinct sections for instructions and input.
- [Anthropic: current prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) describes direct instructions, relevant examples, optional XML sections, and a role when useful.
- [Anthropic: prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5) emphasizes matching response length to the task and avoiding instructions that force visible reasoning or unnecessary verification.
- [OpenAI: prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) describes role separation, examples, and evaluation against expected outputs. [OpenAI: prompting](https://developers.openai.com/api/docs/guides/prompting) recommends keeping stable role guidance separate from task input.
- [Google: prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies) recommends direct instructions, context, consistent structure, and examples. [Gemini Generate Content API](https://ai.google.dev/api/generate-content) supports a distinct `systemInstruction` field and JSON output configuration.

These are starting points, not a guarantee of a good result for every model or idea. The [community prompt-engineer skill](https://github.com/Jeffallan/claude-skills/blob/main/skills/prompt-engineer/SKILL.md) illustrates a reusable workflow, but a Claude Skill is a separate product format: PromptDock does not install a skill or train model weights. Its reusable policy in `src/prompt-policy.js` guides whichever configured provider handles a request.

PromptDock applies the guidance by:

1. Stating the exact transformation goal and JSON shape in the system instruction.
2. Sending the person's idea as a separate user input instead of mixing it into the instruction text.
3. Showing short examples of different intents, especially **build** versus **plan**, so the model keeps the requested deliverable.
4. Asking for ranked priorities, a workflow only when the task needs one, and questions only for blocking gaps.
5. Keeping Gemini's system instruction separate from the user content at the API boundary.
6. Correcting an underspecified model depth when the idea explicitly asks to build a working app, game, website, API, or feature.
7. Sending optional fine-tune details alongside the same idea, then preserving explicit user choices in the generated fields.
8. Sharing one structured policy across idea generation and draft enhancement. The policy separates response shape, principles, field guidance, and varied examples with named sections.
9. Asking for role, XML, examples, or ordered steps only when they help the user's task. It does not tell the target AI to reveal chain of thought; a brief explanation of conclusions is enough when useful.
10. Matching the requested length and scope, preserving supplied source material, and avoiding invented citations or requirements.

## Evaluation cases

Review model outputs for these cases when changing the instruction or model:

| Idea                                                                    | Required behavior                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| “Build a browser game with a bird and obstacles. Give me working code.” | Ask the target AI to build playable code; prioritize working gameplay; avoid turning the request into a plan.             |
| “Help me compare two database choices and recommend one.”               | Compare and recommend; identify the unnamed choices as a gap; avoid inventing requirements.                               |
| “Write a short, warm invitation email for Friday's art show.”           | Ask for an email with a warm tone and brief depth; use placeholders for absent event details; avoid inventing RSVP rules. |
| “Summarize this article in three bullets for beginners.”                | Keep the source article as context, set the audience and three-bullet length, and avoid facts not in the article.         |

Real Groq responses checked during development retained the **build** action and selected Quick for the short email and Balanced for the ordinary comparison. The model still sometimes suggests optional missing details. Review the generated prompt before using or publishing it; adjust the idea or guidance and generate again when the task itself needs changing.
