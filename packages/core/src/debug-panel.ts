export type DebugPanelTab = 'components' | 'state' | 'logs' | 'performance' | 'errors'

export interface DebugPanelOptions {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  theme?: 'light' | 'dark'
  autoShow?: boolean
  showOnMount?: boolean
  showOnError?: boolean
  shortcut?: string | false
  maxLogs?: number
  title?: string
}

export interface PerformanceMetrics {
  updateCount: number
  effectCount: number
  memoryUsage: number
  uptime?: number
  fps?: number | null
  lastUpdateInterval?: number | null
  averageUpdateInterval?: number | null
  maxUpdateInterval?: number | null
}

export interface DebugInfo {
  componentTree: any
  updateLogs: any[]
  stateSnapshot: Record<string, any>
  performanceMetrics: PerformanceMetrics
  errors: any[]
  warnings: any[]
}

interface ShortcutSpec {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

const TAB_ORDER: Array<{ key: DebugPanelTab; label: string }> = [
  { key: 'components', label: 'Components' },
  { key: 'state', label: 'State' },
  { key: 'logs', label: 'Logs' },
  { key: 'performance', label: 'Performance' },
  { key: 'errors', label: 'Errors' }
]

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

const DEFAULT_SHORTCUT = 'ctrl+shift+y'
const DEFAULT_MAX_LOGS = 200

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPE[char])
}

function stringify(value: unknown): string {
  const seen = new WeakSet<object>()
  try {
    const text = JSON.stringify(
      value,
      (_key, item) => {
        if (item instanceof Error) {
          return { name: item.name, message: item.message, stack: item.stack }
        }
        if (typeof item === 'bigint') {
          return item.toString()
        }
        if (typeof item === 'function') {
          return '[function ' + (item.name || 'anonymous') + ']'
        }
        if (item && typeof item === 'object') {
          if (seen.has(item as object)) {
            return '[circular]'
          }
          seen.add(item as object)
        }
        return item
      },
      2
    )
    return text === undefined ? String(value) : text
  } catch (error) {
    return '[unserializable]'
  }
}

function parseShortcut(spec: string): ShortcutSpec | null {
  const parts = spec
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)
  if (parts.length === 0) {
    return null
  }
  const parsed: ShortcutSpec = { ctrl: false, shift: false, alt: false, meta: false, key: '' }
  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') {
      parsed.ctrl = true
    } else if (part === 'shift') {
      parsed.shift = true
    } else if (part === 'alt' || part === 'option') {
      parsed.alt = true
    } else if (part === 'meta' || part === 'cmd' || part === 'command') {
      parsed.meta = true
    } else {
      parsed.key = part
    }
  }
  return parsed.key.length > 0 ? parsed : null
}

function isTextEntry(target: unknown): boolean {
  if (!target || typeof target !== 'object') {
    return false
  }
  const element = target as { tagName?: unknown; isContentEditable?: unknown }
  const tag = typeof element.tagName === 'string' ? element.tagName.toLowerCase() : ''
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true
  }
  return element.isContentEditable === true
}

export class DebugPanel {
  private container: HTMLElement
  private panel: HTMLElement
  private content!: HTMLElement
  private tabButtons: HTMLButtonElement[] = []
  private logInput: HTMLInputElement | null = null
  private logList: HTMLElement | null = null
  private logInputFocused = false
  private options: Required<DebugPanelOptions>
  private updateInterval: number | null = null
  private debugInfo: DebugInfo | null = null
  private visible = false
  private destroyed = false
  private sawFirstUpdate = false
  private activeTab: DebugPanelTab = 'components'
  private logFilter = ''
  private shortcut: ShortcutSpec | null = null
  private disposeDrag: (() => void) | null = null
  private disposeShortcut: (() => void) | null = null

  constructor(options: DebugPanelOptions = {}) {
    this.options = {
      position: 'top-right',
      theme: 'dark',
      autoShow: false,
      showOnMount: true,
      showOnError: true,
      shortcut: DEFAULT_SHORTCUT,
      maxLogs: DEFAULT_MAX_LOGS,
      title: '🔍 yq-sanyi Debug Panel',
      ...options
    }

    if (typeof this.options.shortcut === 'string') {
      this.shortcut = parseShortcut(this.options.shortcut)
    }

    this.container = document.createElement('div')
    this.container.setAttribute('data-yq-debug-panel', 'root')
    this.container.style.cssText = this.getContainerStyles()

    this.panel = this.createPanel()
    this.container.appendChild(this.panel)

    const body = document.body
    if (body && typeof body.appendChild === 'function') {
      body.appendChild(this.container)
    }

    const header = this.panel.children[0] as HTMLElement | undefined
    this.enableDragging(header)
    this.enableShortcut()

    if (this.options.autoShow) {
      this.show()
    } else {
      this.hide()
    }
  }

  private isDark(): boolean {
    return this.options.theme === 'dark'
  }

  private textColor(): string {
    return this.isDark() ? '#fff' : '#333'
  }

  private mutedColor(): string {
    return this.isDark() ? '#999' : '#666'
  }

  private tabColor(active: boolean): string {
    if (active) {
      return this.isDark() ? '#fff' : '#333'
    }
    return this.isDark() ? '#ccc' : '#666'
  }

  private highlightColor(): string {
    return this.isDark() ? '#3b82f6' : '#2563eb'
  }

  private surfaceColor(): string {
    return this.isDark() ? '#2a2a2a' : '#f5f5f5'
  }

  private borderColor(): string {
    return this.isDark() ? '#444' : '#ddd'
  }

  private buttonStyles(): string {
    return (
      'background: ' +
      this.borderColor() +
      '; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; color: ' +
      this.textColor() +
      ';'
    )
  }

  private getContainerStyles(): string {
    const baseStyles = 'position: fixed; z-index: 999999; font-family: monospace; font-size: 12px;'

    const positionStyles: Record<Required<DebugPanelOptions>['position'], string> = {
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;',
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;'
    }

    return baseStyles + positionStyles[this.options.position]
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.setAttribute('data-yq-debug-panel', 'panel')
    panel.style.cssText =
      'width: 400px; max-height: 600px; background: ' +
      (this.isDark() ? '#1a1a1a' : '#ffffff') +
      '; border: 1px solid ' +
      this.borderColor() +
      '; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column; transition: all 0.3s ease;'

    panel.appendChild(this.createHeader())
    panel.appendChild(this.createContent())

    return panel
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div')
    header.setAttribute('data-yq-debug-panel', 'header')
    header.style.cssText =
      'background: ' +
      (this.isDark() ? '#2a2a2a' : '#f5f5f5') +
      '; padding: 12px 16px; border-bottom: 1px solid ' +
      this.borderColor() +
      '; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; cursor: move;'

    const title = document.createElement('div')
    title.textContent = this.options.title
    title.style.cssText = 'font-weight: bold; color: ' + this.textColor() + ';'

    const controls = document.createElement('div')
    controls.style.cssText = 'display: flex; gap: 8px;'

    const minimizeBtn = document.createElement('button')
    minimizeBtn.setAttribute('data-yq-debug-panel', 'minimize')
    minimizeBtn.textContent = '−'
    minimizeBtn.style.cssText = this.buttonStyles()
    minimizeBtn.onclick = () => this.toggle()

    const closeBtn = document.createElement('button')
    closeBtn.setAttribute('data-yq-debug-panel', 'close')
    closeBtn.textContent = '×'
    closeBtn.style.cssText = this.buttonStyles()
    closeBtn.onclick = () => this.hide()

    controls.appendChild(minimizeBtn)
    controls.appendChild(closeBtn)

    header.appendChild(title)
    header.appendChild(controls)

    return header
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div')
    content.setAttribute('data-yq-debug-panel', 'content')
    content.style.cssText = 'padding: 16px; overflow-y: auto; max-height: 500px;'

    content.appendChild(this.createTabs())
    content.appendChild(this.createTabContent())

    return content
  }

  private createTabs(): HTMLElement {
    const tabs = document.createElement('div')
    tabs.setAttribute('data-yq-debug-panel', 'tabs')
    tabs.style.cssText =
      'display: flex; border-bottom: 1px solid ' + this.borderColor() + '; margin-bottom: 12px;'

    this.tabButtons = []
    for (const entry of TAB_ORDER) {
      const tab = document.createElement('button')
      tab.setAttribute('data-yq-debug-tab', entry.key)
      tab.textContent = entry.label
      tab.style.cssText =
        'background: none; border: none; padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;'
      tab.onclick = () => this.showTab(entry.key)
      this.tabButtons.push(tab)
      tabs.appendChild(tab)
    }

    this.syncTabStyles()

    return tabs
  }

  private createTabContent(): HTMLElement {
    const content = document.createElement('div')
    content.setAttribute('data-yq-debug-panel', 'tab-content')
    this.content = content
    this.renderActiveTab()
    return content
  }

  private syncTabStyles(): void {
    this.tabButtons.forEach((tab, index) => {
      const active = TAB_ORDER[index].key === this.activeTab
      tab.style.borderBottomColor = active ? this.highlightColor() : 'transparent'
      tab.style.color = this.tabColor(active)
    })
  }

  private createHeading(text: string): HTMLElement {
    const heading = document.createElement('h3')
    heading.textContent = text
    heading.style.cssText = 'color: ' + this.textColor() + '; margin-bottom: 12px;'
    return heading
  }

  private createSurface(): HTMLElement {
    const surface = document.createElement('div')
    surface.style.cssText =
      'background: ' + this.surfaceColor() + '; border-radius: 4px; padding: 12px; font-size: 11px;'
    return surface
  }

  private renderEmpty(message: string): string {
    return '<p style="color: ' + this.mutedColor() + ';">' + escapeHtml(message) + '</p>'
  }

  private renderActiveTab(): void {
    if (this.destroyed) {
      return
    }
    this.content.innerHTML = ''
    this.logInput = null
    this.logList = null
    this.logInputFocused = false

    switch (this.activeTab) {
      case 'components':
        this.renderComponentsTab(this.content)
        break
      case 'state':
        this.renderStateTab(this.content)
        break
      case 'logs':
        this.renderLogsTab(this.content)
        break
      case 'performance':
        this.renderPerformanceTab(this.content)
        break
      case 'errors':
        this.renderErrorsTab(this.content)
        break
    }
  }

  private renderComponentsTab(content: HTMLElement): void {
    content.appendChild(this.createHeading('Component Tree'))

    const treeContainer = this.createSurface()
    const tree = this.debugInfo?.componentTree
    treeContainer.innerHTML =
      tree && Object.keys(tree).length > 0
        ? '<pre style="margin: 0; white-space: pre-wrap;">' + escapeHtml(stringify(tree)) + '</pre>'
        : this.renderEmpty('No component data available')
    content.appendChild(treeContainer)
  }

  private renderStateTab(content: HTMLElement): void {
    content.appendChild(this.createHeading('State Information'))

    const stateContainer = this.createSurface()
    const snapshot = this.debugInfo?.stateSnapshot
    stateContainer.innerHTML =
      snapshot && Object.keys(snapshot).length > 0
        ? '<pre style="margin: 0; white-space: pre-wrap;">' + escapeHtml(stringify(snapshot)) + '</pre>'
        : this.renderEmpty('No state data available')
    content.appendChild(stateContainer)
  }

  private logMatches(log: any, needle: string): boolean {
    const parts = [log?.type, log?.path, log?.componentName, log?.data?.message]
    return parts
      .filter((part) => typeof part === 'string')
      .join(' ')
      .toLowerCase()
      .includes(needle)
  }

  private createLogFilter(): HTMLInputElement {
    if (!this.logInput) {
      const input = document.createElement('input')
      input.setAttribute('data-yq-debug-panel', 'log-filter')
      input.type = 'text'
      input.placeholder = 'filter by type or path'
      input.style.cssText =
        'width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 4px 6px; font-family: monospace; font-size: 11px; border-radius: 4px; border: 1px solid ' +
        this.borderColor() +
        '; background: ' +
        (this.isDark() ? '#111' : '#fff') +
        '; color: ' +
        this.textColor() +
        ';'
      input.oninput = () => {
        this.logFilter = input.value
        this.renderLogEntries()
      }
      input.onfocus = () => {
        this.logInputFocused = true
      }
      input.onblur = () => {
        this.logInputFocused = false
      }
      this.logInput = input
    }
    this.logInput.value = this.logFilter
    return this.logInput
  }

  private renderLogsTab(content: HTMLElement): void {
    content.appendChild(this.createHeading('Update Logs'))
    content.appendChild(this.createLogFilter())

    const list = this.createSurface()
    list.setAttribute('data-yq-debug-panel', 'log-list')
    list.style.cssText += ' max-height: 300px; overflow-y: auto;'
    content.appendChild(list)
    this.logList = list

    this.renderLogEntries()

    const input = this.logInput
    if (this.logInputFocused && input) {
      if (typeof input.focus === 'function') {
        input.focus()
      }
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(input.value.length, input.value.length)
      }
    }
  }

  private renderLogEntries(): void {
    const list = this.logList
    if (!list) {
      return
    }

    const logs = this.debugInfo?.updateLogs || []
    if (logs.length === 0) {
      list.innerHTML = this.renderEmpty('No update logs available')
      return
    }

    const needle = this.logFilter.trim().toLowerCase()
    const matched = needle.length === 0 ? logs : logs.filter((log) => this.logMatches(log, needle))
    if (matched.length === 0) {
      list.innerHTML = this.renderEmpty('No logs match "' + this.logFilter.trim() + '"')
      return
    }

    const cap = Math.max(1, this.options.maxLogs)
    const shown = matched.slice(-cap)
    const summary =
      matched.length > shown.length
        ? 'showing the last ' + shown.length + ' of ' + matched.length + ' matching logs'
        : 'showing all ' + shown.length + ' matching logs'
    const rows = shown.map((log) => this.renderLogEntry(log)).join('')

    list.innerHTML =
      '<div style="margin-bottom: 8px; color: ' +
      this.mutedColor() +
      ';">' +
      escapeHtml(summary) +
      '</div>' +
      rows
  }

  private renderLogEntry(log: any): string {
    const timestamp = log?.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'unknown time'
    const component = log?.componentName ? ' | Component: ' + escapeHtml(log.componentName) : ''
    const message = log?.data?.message ? ' | ' + escapeHtml(log.data.message) : ''
    return (
      '<div style="margin-bottom: 8px; padding: 4px; background: ' +
      (this.isDark() ? '#333' : '#eee') +
      '; border-radius: 2px;">' +
      '<div style="color: ' +
      this.highlightColor() +
      '; font-weight: bold;">' +
      escapeHtml(timestamp) +
      '</div>' +
      '<div>Type: ' +
      escapeHtml(log?.type) +
      ' | Path: ' +
      escapeHtml(log?.path) +
      component +
      message +
      '</div>' +
      '</div>'
    )
  }

  private renderPerformanceTab(content: HTMLElement): void {
    content.appendChild(this.createHeading('Performance Metrics'))

    const perfContainer = this.createSurface()
    const metrics = this.debugInfo?.performanceMetrics
    perfContainer.innerHTML = metrics
      ? this.renderMetricRows(metrics)
      : this.renderEmpty('No performance data available')
    content.appendChild(perfContainer)
  }

  private formatMillis(value: unknown): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) + ' ms' : 'not measured'
  }

  private formatCount(value: unknown): string {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'not measured'
  }

  private formatUptime(value: unknown): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'not measured'
    }
    return (value / 1000).toFixed(1) + ' s'
  }

  private renderMetricRows(metrics: PerformanceMetrics): string {
    const rows: Array<[string, string]> = [
      ['Last update interval', this.formatMillis(metrics.lastUpdateInterval)],
      ['Average update interval', this.formatMillis(metrics.averageUpdateInterval)],
      ['Max update interval', this.formatMillis(metrics.maxUpdateInterval)],
      ['Update count', this.formatCount(metrics.updateCount)],
      ['Effect count', this.formatCount(metrics.effectCount)],
      ['Memory usage', typeof metrics.memoryUsage === 'number' ? metrics.memoryUsage + ' MB' : 'not measured'],
      ['Uptime', this.formatUptime(metrics.uptime)],
      ['FPS', typeof metrics.fps === 'number' ? String(Math.round(metrics.fps)) : 'not measured']
    ]

    return rows
      .map(
        ([label, value]) =>
          '<div style="margin-bottom: 8px;"><strong>' +
          escapeHtml(label) +
          ':</strong> ' +
          escapeHtml(value) +
          '</div>'
      )
      .join('')
  }

  private describeEntry(entry: any): string {
    if (!entry) {
      return ''
    }
    if (typeof entry.message === 'string' && entry.message.length > 0) {
      return entry.message
    }
    if (entry.error && typeof entry.error.message === 'string' && entry.error.message.length > 0) {
      return entry.error.message
    }
    if (entry.data && typeof entry.data.message === 'string' && entry.data.message.length > 0) {
      return entry.data.message
    }
    return stringify(entry)
  }

  private renderErrorsTab(content: HTMLElement): void {
    content.appendChild(this.createHeading('Errors & Warnings'))

    const errorsContainer = this.createSurface()
    errorsContainer.style.cssText += ' max-height: 300px; overflow-y: auto;'

    const errors = this.debugInfo?.errors || []
    const warnings = this.debugInfo?.warnings || []

    if (errors.length === 0 && warnings.length === 0) {
      errorsContainer.innerHTML = this.renderEmpty('No errors or warnings')
      content.appendChild(errorsContainer)
      return
    }

    const sections: string[] = []

    if (errors.length > 0) {
      sections.push(
        errors
          .map((error: any) =>
            '<div style="margin-bottom: 8px; padding: 8px; background: ' +
            (this.isDark() ? '#8b0000' : '#ffebee') +
            '; border-radius: 4px; border-left: 4px solid #dc3545;">' +
            '<div style="color: #dc3545; font-weight: bold;">ERROR</div>' +
            '<div>' +
            escapeHtml(this.describeEntry(error)) +
            '</div>' +
            '<div style="color: ' +
            this.mutedColor() +
            '; font-size: 10px;">' +
            escapeHtml(error?.timestamp ? new Date(error.timestamp).toLocaleTimeString() : 'unknown time') +
            '</div>' +
            '</div>'
          )
          .join('')
      )
    }

    if (warnings.length > 0) {
      sections.push(
        warnings
          .map((warning: any) =>
            '<div style="margin-bottom: 8px; padding: 8px; background: ' +
            (this.isDark() ? '#b8860b' : '#fff3cd') +
            '; border-radius: 4px; border-left: 4px solid #ffc107;">' +
            '<div style="color: #856404; font-weight: bold;">WARNING</div>' +
            '<div>' +
            escapeHtml(this.describeEntry(warning)) +
            '</div>' +
            '<div style="color: ' +
            this.mutedColor() +
            '; font-size: 10px;">' +
            escapeHtml(warning?.timestamp ? new Date(warning.timestamp).toLocaleTimeString() : 'unknown time') +
            '</div>' +
            '</div>'
          )
          .join('')
      )
    }

    errorsContainer.innerHTML = sections.join('')
    content.appendChild(errorsContainer)
  }

  private enableDragging(header: HTMLElement | undefined): void {
    if (!header) {
      return
    }

    let dragging = false
    let startX = 0
    let startY = 0
    let originLeft = 0
    let originTop = 0

    const onMouseDown = (event: MouseEvent): void => {
      dragging = true
      startX = event.clientX
      startY = event.clientY
      const rect =
        typeof this.container.getBoundingClientRect === 'function'
          ? this.container.getBoundingClientRect()
          : null
      originLeft = rect ? rect.left : Number.parseFloat(this.container.style.left) || 0
      originTop = rect ? rect.top : Number.parseFloat(this.container.style.top) || 0
      header.style.cursor = 'grabbing'
      if (typeof event.preventDefault === 'function') {
        event.preventDefault()
      }
    }

    const onMouseMove = (event: MouseEvent): void => {
      if (!dragging) {
        return
      }
      const maxLeft =
        typeof window !== 'undefined' && typeof window.innerWidth === 'number'
          ? Math.max(0, window.innerWidth - 48)
          : Number.POSITIVE_INFINITY
      const maxTop =
        typeof window !== 'undefined' && typeof window.innerHeight === 'number'
          ? Math.max(0, window.innerHeight - 48)
          : Number.POSITIVE_INFINITY
      const left = Math.min(maxLeft, Math.max(0, originLeft + (event.clientX - startX)))
      const top = Math.min(maxTop, Math.max(0, originTop + (event.clientY - startY)))
      this.container.style.left = left + 'px'
      this.container.style.top = top + 'px'
      this.container.style.right = 'auto'
      this.container.style.bottom = 'auto'
    }

    const onMouseUp = (): void => {
      if (!dragging) {
        return
      }
      dragging = false
      header.style.cursor = 'move'
    }

    header.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    this.disposeDrag = () => {
      header.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }

  private matchesShortcut(event: KeyboardEvent): boolean {
    const spec = this.shortcut
    if (!spec) {
      return false
    }
    return (
      event.ctrlKey === spec.ctrl &&
      event.shiftKey === spec.shift &&
      event.altKey === spec.alt &&
      event.metaKey === spec.meta &&
      String(event.key || '').toLowerCase() === spec.key
    )
  }

  private enableShortcut(): void {
    if (!this.shortcut) {
      return
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTextEntry(event.target)) {
        return
      }
      if (!this.matchesShortcut(event)) {
        return
      }
      if (typeof event.preventDefault === 'function') {
        event.preventDefault()
      }
      this.toggle()
    }

    document.addEventListener('keydown', onKeyDown)
    this.disposeShortcut = () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }

  public get isVisible(): boolean {
    return this.visible
  }

  public get activeTabKey(): DebugPanelTab {
    return this.activeTab
  }

  public get element(): HTMLElement {
    return this.container
  }

  public show(): void {
    if (this.destroyed) {
      return
    }
    this.panel.style.display = 'flex'
    this.visible = true
  }

  public hide(): void {
    if (this.destroyed) {
      return
    }
    this.panel.style.display = 'none'
    this.visible = false
  }

  public toggle(): void {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  public showTab(key: DebugPanelTab): void {
    if (this.destroyed) {
      return
    }
    if (!TAB_ORDER.some((entry) => entry.key === key)) {
      return
    }
    this.activeTab = key
    this.syncTabStyles()
    this.renderActiveTab()
  }

  public updateDebugInfo(debugInfo: DebugInfo): void {
    if (this.destroyed) {
      return
    }
    this.debugInfo = debugInfo

    if (!this.visible && !this.sawFirstUpdate && this.options.showOnMount) {
      this.show()
    }
    if (!this.visible && this.options.showOnError && (debugInfo.errors?.length ?? 0) > 0) {
      this.show()
    }
    this.sawFirstUpdate = true

    this.renderActiveTab()
  }

  public startAutoUpdate(intervalMs: number = 1000): void {
    if (this.destroyed) {
      return
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }

    this.updateInterval = window.setInterval(() => {
      if (this.visible && this.debugInfo) {
        this.renderActiveTab()
      }
    }, intervalMs)
  }

  public stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  public destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true

    this.stopAutoUpdate()

    if (this.disposeDrag) {
      this.disposeDrag()
      this.disposeDrag = null
    }
    if (this.disposeShortcut) {
      this.disposeShortcut()
      this.disposeShortcut = null
    }

    this.tabButtons = []
    this.logInput = null
    this.logList = null
    this.debugInfo = null
    this.visible = false

    const parent = this.container.parentNode
    if (parent) {
      parent.removeChild(this.container)
    }
  }
}
