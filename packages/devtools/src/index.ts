import { DebugPanel, type DebugPanelOptions, type DebugInfo } from '../../core/src/debug-panel.js'
import { DebugManager, type DebugManagerOptions, type DebugEvent } from '../../core/src/debug-manager.js'
import { getDebugManager } from '../../core/src/debug-manager-simple.js'
import type { ComponentInstance } from '../../core/src/index.js'

export interface DevtoolsHandle {
  readonly attached: boolean
  readonly panel: DebugPanel | null
  registerComponent(instance: ComponentInstance): void
  show(): void
  hide(): void
  toggle(): void
  isVisible(): boolean
  clearLogs(): void
  exportSnapshot(): string
  destroy(): void
}

export function attachDevtools(root: object, options?: DebugManagerOptions): DevtoolsHandle {
  const mgr = DebugManager.getInstance(options)
  mgr.showPanel()
  return {
    attached: true,
    get panel(): DebugPanel | null {
      return mgr.getPanel()
    },
    registerComponent(instance: ComponentInstance): void {
      mgr.registerComponent(instance)
    },
    show(): void {
      mgr.showPanel()
    },
    hide(): void {
      mgr.hidePanel()
    },
    toggle(): void {
      mgr.togglePanel()
    },
    isVisible(): boolean {
      return mgr.isPanelVisible()
    },
    clearLogs(): void {
      mgr.clearLogs()
    },
    exportSnapshot(): string {
      return mgr.exportDebugData()
    },
    destroy(): void {
      DebugManager.destroyInstance()
    }
  }
}

export { DebugPanel }
export type { DebugPanelOptions, DebugInfo, DebugManagerOptions, DebugEvent }
export { DebugManager, getDebugManager }
