export type ErrorHandler = (error: Error, errorInfo: any) => void

const errorHandlers: ErrorHandler[] = []

export function onError(fn: ErrorHandler): () => void {
  errorHandlers.push(fn)
  return () => {
    const i = errorHandlers.indexOf(fn)
    if (i >= 0) errorHandlers.splice(i, 1)
  }
}

export function emitError(error: Error, errorInfo: any): void {
  for (const h of errorHandlers) {
    try {
      h(error, errorInfo)
    } catch (_e) {
      // handler errors must not propagate
    }
  }
}

export function _resetErrorHandlers(): void {
  errorHandlers.length = 0
}
