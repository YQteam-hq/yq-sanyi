// React 19 wrapper for yq-sanyi components
// Adds TypeScript type declarations so React treats <yq-*> as native HTML elements.
// Components defined via yq.define('yq-counter', ...) can be used directly in JSX.

import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // Generic: any yq-* tag is accepted as an HTMLElement with optional props.
      [yqTag: `yq-${string}`]: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { [key: `${string}:?`]: never },
        HTMLElement
      >
    }
  }
}
