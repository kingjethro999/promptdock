# PromptDock prompt design notes

Researched on 29 September 2026 from official developer guidance:

- [Anthropic: prompting best practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables) recommends clear requests, relevant context, examples, and distinct sections for instructions and input.
- [OpenAI: prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) describes role separation, examples, and evaluation against expected outputs. [OpenAI: prompting](https://developers.openai.com/api/docs/guides/prompting) recommends keeping stable role guidance separate from task input.
- [Google: prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies) recommends direct instructions, context, consistent structure, and examples. [Gemini Generate Content API](https://ai.google.dev/api/generate-content) supports a distinct `systemInstruction` field and JSON output configuration.

These are starting points, not a guarantee of a good result for every model or idea. PromptDock now applies them by:

1. Stating the exact transformation goal and JSON shape in the system instruction.
2. Sending the person's idea as a separate user input instead of mixing it into the instruction text.
3. Showing short examples of different intents, especially **build** versus **plan**, so the model keeps the requested deliverable.
4. Asking for ranked priorities, a workflow only when the task needs one, and questions only for blocking gaps.
5. Keeping Gemini's system instruction separate from the user content at the API boundary.
6. Correcting an underspecified model depth when the idea explicitly asks to build a working app, game, website, API, or feature.

## Evaluation cases

Review model outputs for these cases when changing the instruction or model:

| Idea | Required behavior |
| --- | --- |
| “Build a browser game with a bird and obstacles. Give me working code.” | Ask the target AI to build playable code; prioritize working gameplay; avoid turning the request into a plan. |
| “Help me compare two database choices and recommend one.” | Compare and recommend; identify the unnamed choices as a gap; avoid inventing requirements. |
| “Write a short, warm invitation email for Friday's art show.” | Ask for an email with a warm tone and brief depth; use placeholders for absent event details; avoid inventing RSVP rules. |

Real Groq responses checked during development retained the **build** action and selected Quick for the short email and Balanced for the ordinary comparison. The model still sometimes suggests optional missing details. Review and edit the generated prompt before using or publishing it; the product keeps every field editable for this reason.
