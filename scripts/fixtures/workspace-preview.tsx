// Isolated browser fixture: real client components and store, no application
// route, authentication bypass, database, environment file or live provider.
import React from "react";
import { createRoot } from "react-dom/client";
import PromptPreview from "@/components/builder/PromptPreview";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useSavePrompt } from "@/hooks/useSavePrompt";
import { usePromptBuilderStore } from "@/stores/prompt-builder";
import { emptyPromptData } from "@/lib/prompt/types";
import Button from "@/components/ui/Button";

function Fixture() {
  const b = usePromptBuilder();
  const save = useSavePrompt({ remixSourcePublicId: null });
  return (
    <main className="react-workspace-page">
      <h1>Workspace regression fixture</h1>
      <label htmlFor="source">Source</label>
      <textarea
        id="source"
        value={b.idea}
        onChange={(e) => b.setIdea(e.target.value)}
      />
      <Button onClick={b.generate}>Generate fixture</Button>
      <Button
        onClick={() =>
          b.loadPrompt({
            id: "fixture",
            name: "Fixture",
            idea: "Saved source",
            data: {
              ...emptyPromptData,
              task: "Write for {{name}}.",
              raw: true,
            },
            tags: [],
            analysis: null,
            updatedAt: "2026-10-24T00:00:00Z",
          })
        }
      >
        Load saved fixture
      </Button>
      <Button onClick={b.clear}>Clear fixture</Button>
      <p role="status">{b.status}</p>
      <PromptPreview
        prompt={b.prompt}
        data={b.data}
        ready={b.ready}
        provider={b.result?.provider}
        documentRevision={b.documentRevision}
        documentEdited={b.documentEdited}
        sourceChanged={b.ready && b.idea !== b.documentSource}
        onEdit={b.editDocument}
        save={save}
      />
    </main>
  );
}

// Allow deterministic test setup without adding test seams to production code.
Object.assign(window, { fixtureStore: usePromptBuilderStore });
createRoot(document.getElementById("root")!).render(<Fixture />);
