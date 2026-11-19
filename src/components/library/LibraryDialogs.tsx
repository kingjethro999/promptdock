"use client";

import type { SavedPrompt } from "@/lib/prompt/types";
import type { Revision } from "@/hooks/useLibrary";
import SharePromptDialog from "./SharePromptDialog";
import PastePromptDialog from "./PastePromptDialog";
import ConfirmPromptDialog from "./ConfirmPromptDialog";
import HistoryPromptDialog from "./HistoryPromptDialog";

type Props = {
  username: string | null;
  pasteOpen: boolean;
  setPasteOpen(value: boolean): void;
  saving: boolean;
  paste(
    name: string,
    content: string,
    tags: string,
  ): Promise<boolean | undefined>;
  confirm: SavedPrompt | null;
  setConfirm(value: SavedPrompt | null): void;
  remove(): Promise<void>;
  history: {
    prompt: SavedPrompt;
    revisions: Revision[];
    loading: boolean;
    error: string;
  } | null;
  setHistory(value: null): void;
  restore(revision: Revision): Promise<void>;
  shareCandidate: SavedPrompt | null;
  setShareCandidate(value: SavedPrompt | null): void;
  publish(
    prompt: SavedPrompt,
    published: boolean,
  ): Promise<SavedPrompt | undefined>;
  onPromptUpdated?(prompt: SavedPrompt): void;
  editCandidate?: SavedPrompt | null;
  setEditCandidate?(value: SavedPrompt | null): void;
  editText?(prompt: SavedPrompt): string;
  saveEdit?(
    prompt: SavedPrompt,
    name: string,
    content: string,
    tags: string,
  ): Promise<boolean | undefined>;
};

export default function LibraryDialogs(props: Props) {
  return (
    <>
      {props.shareCandidate && (
        <SharePromptDialog
          prompt={props.shareCandidate}
          username={props.username}
          close={() => props.setShareCandidate(null)}
          publish={props.publish}
          setPrompt={props.setShareCandidate}
          onUpdated={props.onPromptUpdated}
        />
      )}
      {props.editCandidate && props.saveEdit && props.editText && (
        <PastePromptDialog
          key={props.editCandidate.id}
          initial={{
            name: props.editCandidate.name,
            content: props.editText(props.editCandidate),
            tags: props.editCandidate.tags,
          }}
          close={() => props.setEditCandidate?.(null)}
          saving={props.saving}
          paste={(name, content, tags) =>
            props.saveEdit!(props.editCandidate!, name, content, tags)
          }
        />
      )}
      {props.pasteOpen && (
        <PastePromptDialog
          close={() => props.setPasteOpen(false)}
          saving={props.saving}
          paste={props.paste}
        />
      )}
      {props.confirm && (
        <ConfirmPromptDialog
          prompt={props.confirm}
          close={() => props.setConfirm(null)}
          remove={props.remove}
        />
      )}
      {props.history && (
        <HistoryPromptDialog
          history={props.history}
          close={() => props.setHistory(null)}
          restore={props.restore}
        />
      )}
    </>
  );
}
