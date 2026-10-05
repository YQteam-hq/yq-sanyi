// Vue 3 wrapper for yq-sanyi components
// Augments the GlobalComponents type so <yq-counter> etc. are valid templates.
// Requires "yq-sanyi" as a peer dep and components registered via yq.define(...).

import 'vue'

declare module 'vue' {
  interface GlobalComponents {
    [yqTag: `yq-${string}`]: DefineComponent<Record<string, unknown>>
  }
}
