import { derived } from "svelte/store"
import { appStore } from "../app.js"
import { builderStore } from "../builder"

export const devToolsEnabled = derived(
  [appStore, builderStore],
  ([$appStore, $builderStore]) => {
    return !$builderStore.inBuilder && $appStore.isDevApp
  }
)
