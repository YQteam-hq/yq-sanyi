import { DebugPanel } from './panel.js'
import { DebugManager } from './manager.js'
import { getDebugManager } from './manager-simple.js'
import type { ComponentInstance } from '../../core/src/index.js'
import type { DebugPanelTab, DebugPanelOptions, PerformanceMetrics, DebugInfo } from './panel.js'
import type { DebugManagerOptions } from './manager.js'

export { DebugPanel, DebugManager, getDebugManager }
export type { ComponentInstance }
export type { DebugPanelTab, DebugPanelOptions, PerformanceMetrics, DebugInfo }
export type { DebugManagerOptions }

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
  const mgr = new DebugManager(options)
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
      mgr.destroy()
    }
  }
}
