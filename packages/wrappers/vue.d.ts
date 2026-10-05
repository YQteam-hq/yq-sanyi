import 'vue'

declare module 'vue' {
  interface GlobalComponents {
    [yqTag: `yq-${string}`]: DefineComponent<Record<string, unknown>>
  }
}
