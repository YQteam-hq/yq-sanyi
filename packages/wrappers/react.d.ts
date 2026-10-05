import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [yqTag: `yq-${string}`]: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { [key: `${string}:?`]: never },
        HTMLElement
      >
    }
  }
}
