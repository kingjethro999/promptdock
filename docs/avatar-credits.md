# Avatar Styles & Credits

PromptDock uses **DiceBear 10** for deterministic client-side generated avatars.
In strict adherence to the project licensing policy, only **CC0 1.0 Universal (Public Domain Dedication)** avatar styles are included. No attribution or licensing restrictions are imposed on user profiles or shared assets.

## Included Styles

| Style ID | Style Label | License | Creator / Artist | Source |
|---|---|---|---|---|
| `lorelei` | Portrait | CC0 1.0 Universal | Lisa Wischofsky | [dicebear.com/styles/lorelei](https://www.dicebear.com/styles/lorelei/) |
| `notionists` | Sketch | CC0 1.0 Universal | Micah Lanier | [dicebear.com/styles/notionists](https://www.dicebear.com/styles/notionists/) |
| `shapes` | Abstract | CC0 1.0 Universal | Florian Körner | [dicebear.com/styles/shapes](https://www.dicebear.com/styles/shapes/) |

## Generation & Privacy Architecture

- **100% Local Generation:** Avatars are rendered directly in the user's browser via `@dicebear/core` and pre-compiled style JSON definitions.
- **Zero Third-Party Runtime Calls:** No requests are made to `api.dicebear.com`, Gravatar, or any external avatar API at runtime. Usernames and email addresses never leave the client or PromptDock's infrastructure.
- **Deterministic Seed:** The initial avatar uses the user's username as seed (`username:round:index`), ensuring consistent rendering across sessions.
- **Rasterized Storage:** Selected avatars are rendered to an off-screen HTML5 Canvas, rasterized to WebP/PNG at 512×512px, and uploaded to PromptDock's signed asset storage. Public profile URLs always point directly to first-party assets without exposing generator seeds.
