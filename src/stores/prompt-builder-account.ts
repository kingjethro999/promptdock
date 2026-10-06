import { usePromptBuilderStore } from "./prompt-builder";

let activeAccountId: string | null = null;

export async function bindBuilderAccount(accountId: string) {
  if (activeAccountId === accountId) return;
  activeAccountId = accountId;
  usePromptBuilderStore.persist.setOptions({
    name: "promptdock.react-draft.switching",
  });
  usePromptBuilderStore.getState().clear();
  usePromptBuilderStore.persist.setOptions({
    name: `promptdock.react-draft.user.${accountId}`,
  });
  await usePromptBuilderStore.persist.rehydrate();
}

export function detachBuilderAccount() {
  activeAccountId = null;
  usePromptBuilderStore.persist.setOptions({
    name: "promptdock.react-draft.switching",
  });
  usePromptBuilderStore.getState().clear();
}
