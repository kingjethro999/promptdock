# PromptDock landing page UI/UX audit

Date: 21 October 2026. Scope: public landing page at `/` and `/community`, reviewed at desktop and mobile widths. This is a qualitative design and interaction audit, not a conversion study.

## What strong product landing pages do

The current [Kilo homepage](https://kilo.ai/) leads with one short product promise, keeps the primary action visible, and places concrete product surfaces directly under the promise. A Rea browser inspection and the supplied visual references show the details that make those surfaces work: restrained near-black panels, one high-energy yellow accent, a subtle dot field, varied card spans, concise headings, and unmistakable actions. Its platform and download grids use size and placement to make each option legible without a separate color effect on every card. The design lesson is the hierarchy and composition, not its exact palette or claims.

[Cursor](https://cursor.com/) similarly puts product demonstrations alongside outcome-led copy and repeats a clear start action. [Linear](https://linear.app/) uses a skip link, compact navigation, a strong headline, and detailed product screens to build confidence. These examples suggest a pattern for PromptDock: explain the transformation, show a believable prompt preview, then answer how it works and where the output goes. They do not establish that any specific visual style causes better conversion.

## Findings and decisions

| Area                   | Severity | Observation in the previous page                                                                                    | Decision                                                                                                                    |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| First screen hierarchy | High     | Pale hero, quiet action, and similarly weighted preview made the promise and product easy to miss.                  | Give the hero a distinct dark surface, brighter primary action, and framed product example.                                 |
| Message clarity        | High     | “Great prompts start with rough ideas” said who could start, but less clearly what to do next.                      | Pair the idea-to-prompt promise with an action: start shaping ideas.                                                        |
| Preview honesty        | High     | “Live workspace preview” implied a live generated result, while the three results are curated client-side examples. | Label it “Interactive example” and “Example output.”                                                                        |
| Mobile navigation      | High     | The desktop links disappeared below 800px without a mobile equivalent.                                              | Add a keyboard-accessible native menu with section links and sign-in.                                                       |
| Keyboard access        | Medium   | The public page had no skip link.                                                                                   | Add a visible-on-focus skip link before the header.                                                                         |
| Text legibility        | Medium   | Supporting content relied heavily on 10–12px type and low contrast green.                                           | Increase key body copy and strengthen foreground/background contrast in high-traffic sections.                              |
| Visual consistency     | Medium   | Hero, feature cards, model directory, and footer used different surface treatments and radii.                       | Use flat near-black and paper surfaces, a single lime accent, and tighter card geometry; avoid decorative gradient meshes. |
| Card composition       | Medium   | Equal-weight cards made community and product content feel generic.                                                  | Give the lead card more width in the community grid and use one large product example beside a supporting hero card.        |
| Touch targets          | Medium   | Example chips and the small header action were short on mobile.                                                     | Raise mobile controls to at least 44px.                                                                                     |
| Proof language         | Medium   | “One workspace, every AI tool” could imply native integration with every platform.                                  | Explain the actual portable workflow: make it here, use it anywhere.                                                        |
| Long-form flow         | Medium   | Model comparison and FAQ make the page long and can bury the next action.                                           | Keep a strong CTA at the start and end; preserve the directory for visitors who want depth.                                 |
| Model table on mobile  | Low      | Wide data tables require horizontal scrolling.                                                                      | Preserve scrollable data and filtering; a future iteration could use a compact card view after usage data validates demand. |
| Motion                 | Medium   | On a slower first load, the hero action and preview appeared after the headline, leaving empty space.               | Render the complete hero on first paint; keep the existing reduced-motion behavior elsewhere.                               |

## Resulting direction

The refresh uses a flat near-black hero, quiet dot texture, one solid lime accent, and a structured demo-plus-card composition. The requested “01 / CAPTURE” card was removed entirely; the remaining supporting card has enough width to read as a deliberate product surface. Landing and community prompt cards now use tighter dark grids with a wider lead card where content exists. The preview is a visible product explanation, with selected examples and output updates announced politely to assistive technology. The page keeps its existing sections and links, so the change is a visual and interaction improvement to the current public journey rather than a new product workflow.

Browser checks are part of this implementation's release gate. They cover responsive overflow, page errors, menu and example interactions, and an automated accessibility scan; they do not replace keyboard and screen-reader testing with people.

## Follow-up measurement

After release, compare landing-to-registration click-through, hero CTA clicks by viewport, demo interactions, and scroll depth to the model directory. User interviews should check whether visitors understand that the preview uses examples and that finished prompts can be copied to other AI tools. No conversion lift is claimed from this audit alone.
