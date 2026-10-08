/**
 * Internationalization (i18n) support for yq-sanyi components
 * @packageDocumentation
 */

// import type { ComponentDefinition, ComponentScript } from '../../core/src/index.js' - Not available in package context

export type ComponentScript = (this: any) => any

export interface ComponentDefinition {
  name: string
  template: string
  style?: string
  script?: ComponentScript
}

export interface Translation {
  [key: string]: string | Translation
}

export interface Locale {
  code: string
  name: string
  translations: Translation
  rtl?: boolean
  dateFormat?: string
  numberFormat?: {
    currency: string
    decimal: string
    group: string
  }
}

export interface I18nConfig {
  defaultLocale: string
  fallbackLocale?: string
  locales: Locale[]
  interpolation?: {
    prefix?: string
    suffix?: string
  }
}

export interface NumberFormatOptions {
  style?: 'decimal' | 'currency' | 'percent' | 'unit'
  currency?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  useGrouping?: boolean
}

export interface DateFormatOptions {
  year?: 'numeric' | '2-digit'
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
  day?: 'numeric' | '2-digit'
  weekday?: 'long' | 'short' | 'narrow'
  hour?: 'numeric' | '2-digit'
  minute?: 'numeric' | '2-digit'
  second?: 'numeric' | '2-digit'
}

/**
 * Internationalization utilities
 */
export class I18nManager {
  private config: I18nConfig
  private currentLocale: string
  private translationsCache: Map<string, Translation> = new Map()

  constructor(config: I18nConfig) {
    this.config = config
    this.currentLocale = config.defaultLocale
    this.loadTranslations()
  }

  /**
   * Set current locale
   */
  setLocale(locale: string): void {
    if (this.config.locales.some(l => l.code === locale)) {
      this.currentLocale = locale
      this.loadTranslations()
    } else {
      throw new Error(`Locale '${locale}' not found`)
    }
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): string {
    return this.currentLocale
  }

  /**
   * Get all available locales
   */
  getLocales(): Locale[] {
    return this.config.locales
  }

  /**
   * Load translations for current locale
   */
  private loadTranslations(): void {
    const locale = this.config.locales.find(l => l.code === this.currentLocale)
    if (locale) {
      this.translationsCache.set(this.currentLocale, locale.translations)
    }
  }

  /**
   * Translate a key
   */
  translate(key: string, params?: Record<string, any>): string {
    const translations = this.translationsCache.get(this.currentLocale) || {}
    let value = this.getNestedValue(translations, key)

    // Fallback to default locale
    if (!value && this.config.fallbackLocale) {
      const fallbackTranslations = this.translationsCache.get(this.config.fallbackLocale)
      if (fallbackTranslations) {
        value = this.getNestedValue(fallbackTranslations, key)
      }
    }

    if (typeof value !== 'string') {
      return key // Return key if translation not found
    }

    // Interpolate parameters
    if (params) {
      value = this.interpolate(value, params)
    }

    return value
  }

  /**
   * Get nested object value
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Interpolate parameters into translation
   */
  private interpolate(text: string, params: Record<string, any>): string {
    const prefix = this.config.interpolation?.prefix || '{{'
    const suffix = this.config.interpolation?.suffix || '}}'

    return text.replace(new RegExp(`${prefix}(.*?)${suffix}`, 'g'), (match, key) => {
      const trimmedKey = key.trim()
      return params[trimmedKey] !== undefined ? params[trimmedKey] : match
    })
  }

  /**
   * Format number
   */
  formatNumber(value: number, options?: NumberFormatOptions): string {
    const locale = this.currentLocale
    const localeData = this.config.locales.find(l => l.code === locale)
    
    if (options?.style === 'currency' && options.currency) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: options.currency,
        minimumFractionDigits: options.minimumFractionDigits,
        maximumFractionDigits: options.maximumFractionDigits,
        useGrouping: options.useGrouping !== false
      }).format(value)
    }

    return new Intl.NumberFormat(locale, {
      style: options?.style || 'decimal',
      minimumFractionDigits: options?.minimumFractionDigits,
      maximumFractionDigits: options?.maximumFractionDigits,
      useGrouping: options?.useGrouping !== false
    }).format(value)
  }

  /**
   * Format date
   */
  formatDate(date: Date | number, options?: DateFormatOptions): string {
    const locale = this.currentLocale
    
    return new Intl.DateTimeFormat(locale, {
      year: options?.year,
      month: options?.month,
      day: options?.day,
      weekday: options?.weekday,
      hour: options?.hour,
      minute: options?.minute,
      second: options?.second
    }).format(date)
  }

  /**
   * Check if locale is RTL
   */
  isRTL(): boolean {
    const locale = this.config.locales.find(l => l.code === this.currentLocale)
    return locale?.rtl || false
  }

  /**
   * Get locale-specific date format
   */
  getDateFormat(): string {
    const locale = this.config.locales.find(l => l.code === this.currentLocale)
    return locale?.dateFormat || 'YYYY-MM-DD'
  }

  /**
   * Get locale-specific number format
   */
  getNumberFormat(): { currency: string; decimal: string; group: string } {
    const locale = this.config.locales.find(l => l.code === this.currentLocale)
    return locale?.numberFormat || { currency: '$', decimal: '.', group: ',' }
  }
}

/**
 * Reactivity integration for i18n
 */
export class I18nReactivity {
  private i18n: I18nManager
  private subscriptions: Map<string, Set<() => void>> = new Map()

  constructor(i18n: I18nManager) {
    this.i18n = i18n
  }

  /**
   * Create reactive translation
   */
  reactiveTranslate(key: string, params?: Record<string, any>): string {
    const value = this.i18n.translate(key, params)
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }
    
    // This would be integrated with yq-sanyi's reactivity system
    // For now, return the static value
    return value
  }

  /**
   * Subscribe to locale changes
   */
  onLocaleChange(callback: () => void): () => void {
    const callbackWrapper = () => {
      callback()
      // Re-render components that use translations
      this.reRenderComponents()
    }
    
    // This would be integrated with yq-sanyi's reactivity system
    return () => {
      // Cleanup subscription
    }
  }

  /**
   * Re-render components using translations
   */
  private reRenderComponents(): void {
    // This would trigger re-renders for components using translations
    console.log('Re-rendering components with new locale')
  }
}

/**
 * Pre-built i18n components
 */
export const I18nComponents = {
  /**
   * Create language selector
   */
  languageSelector: (i18n: I18nManager): ComponentDefinition => ({
    name: 'yq-language-selector',
    template: `
      <select yq-model="selectedLocale" yq-on:change="changeLocale">
        ${i18n.getLocales().map(locale => `
          <option value="${locale.code}">${locale.name}</option>
        `).join('')}
      </select>
    `,
    style: `select { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }`,
    script: function () {
      return {
        state: { selectedLocale: i18n.getCurrentLocale() },
        changeLocale: function (state: any) {
          i18n.setLocale(state.selectedLocale)
        }
      }
    }
  }),

  /**
   * Create localized date formatter
   */
  dateFormatter: (i18n: I18nManager): ComponentDefinition => ({
    name: 'yq-date-formatter',
    template: `<span>{{ formattedDate }}</span>`,
    style: ``,
    script: function () {
      return {
        state: { date: new Date(), formattedDate: '' },
        updateFormattedDate: function () {
          ;(this as any).state.formattedDate = i18n.formatDate((this as any).state.date)
        },
        onMount: function () {
          ;(this as any).state.updateFormattedDate()
        },
        onUpdate: function () {
          ;(this as any).state.updateFormattedDate()
        }
      }
    }
  }),

  /**
   * Create localized number formatter
   */
  numberFormatter: (i18n: I18nManager): ComponentDefinition => ({
    name: 'yq-number-formatter',
    template: `<span>{{ formattedNumber }}</span>`,
    style: ``,
    script: function () {
      return {
        state: { number: 0, formattedNumber: '' },
        updateFormattedNumber: function () {
          ;(this as any).state.formattedNumber = i18n.formatNumber((this as any).state.number)
        },
        onMount: function () {
          ;(this as any).state.updateFormattedNumber()
        },
        onUpdate: function () {
          ;(this as any).state.updateFormattedNumber()
        }
      }
    }
  }),

  /**
   * Create translation component
   */
  translation: (i18n: I18nManager): ComponentDefinition => ({
    name: 'yq-translation',
    template: `<span>{{ translatedText }}</span>`,
    style: ``,
    script: function () {
      return {
        state: { key: '', params: {}, translatedText: '' },
        updateTranslation: function () {
          ;(this as any).state.translatedText = i18n.translate((this as any).state.key, (this as any).state.params)
        },
        onMount: function () {
          ;(this as any).state.updateTranslation()
        },
        onUpdate: function () {
          ;(this as any).state.updateTranslation()
        }
      }
    }
  })
}

/**
 * Create i18n context provider
 */
export class I18nProvider {
  private i18n: I18nManager
  private reactivity: I18nReactivity

  constructor(config: I18nConfig) {
    this.i18n = new I18nManager(config)
    this.reactivity = new I18nReactivity(this.i18n)
  }

  /**
   * Get i18n instance
   */
  getI18n(): I18nManager {
    return this.i18n
  }

  /**
   * Get reactivity instance
   */
  getReactivity(): I18nReactivity {
    return this.reactivity
  }

  /**
   * Create context for components
   */
  createContext(): {
    i18n: I18nManager
    t: (key: string, params?: Record<string, any>) => string
    formatNumber: (value: number, options?: NumberFormatOptions) => string
    formatDate: (date: Date | number, options?: DateFormatOptions) => string
    setLocale: (locale: string) => void
    getCurrentLocale: () => string
  } {
    return {
      i18n: this.i18n,
      t: (key: string, params?: Record<string, any>) => this.i18n.translate(key, params),
      formatNumber: (value: number, options?: NumberFormatOptions) => this.i18n.formatNumber(value, options),
      formatDate: (date: Date | number, options?: DateFormatOptions) => this.i18n.formatDate(date, options),
      setLocale: (locale: string) => this.i18n.setLocale(locale),
      getCurrentLocale: () => this.i18n.getCurrentLocale()
    }
  }
}

/**
 * Directive for translations in templates
 */
export class I18nDirective {
  private i18n: I18nManager

  constructor(i18n: I18nManager) {
    this.i18n = i18n
  }

  /**
   * Create translation directive
   */
  createDirective(): {
    key: string
    params?: Record<string, any>
  } {
    return {
      key: '',
      params: {}
    }
  }

  /**
   * Parse translation directive
   */
  parseDirective(value: string): { key: string; params?: Record<string, any> } {
    const [key, ...rest] = value.split('|')
    const params: Record<string, any> = {}
    
    if (rest.length > 0) {
      try {
        const paramsString = rest.join('|')
        const parsed = JSON.parse(paramsString)
        Object.assign(params, parsed)
      } catch (e) {
        console.warn('Failed to parse translation params:', e)
      }
    }
    
    return { key, params }
  }

  /**
   * Translate using directive
   */
  translate(value: string): string {
    const { key, params } = this.parseDirective(value)
    return this.i18n.translate(key, params)
  }
}

// Utility functions
export const createI18nConfig = (config: I18nConfig): I18nProvider => {
  return new I18nProvider(config)
}

export const createI18nManager = (config: I18nConfig): I18nManager => {
  return new I18nManager(config)
}

// Default locale configuration
export const defaultLocales: Locale[] = [
  {
    code: 'en',
    name: 'English',
    translations: {
      welcome: 'Welcome',
      goodbye: 'Goodbye',
      hello: 'Hello {{name}}',
      button: 'Click me',
      loading: 'Loading...',
      error: 'An error occurred'
    }
  },
  {
    code: 'zh',
    name: '中文',
    translations: {
      welcome: '欢迎',
      goodbye: '再见',
      hello: '你好 {{name}}',
      button: '点击我',
      loading: '加载中...',
      error: '发生错误'
    }
  },
  {
    code: 'es',
    name: 'Español',
    translations: {
      welcome: 'Bienvenido',
      goodbye: 'Adiós',
      hello: 'Hola {{name}}',
      button: 'Haz clic',
      loading: 'Cargando...',
      error: 'Ocurrió un error'
    }
  }
]

export const defaultI18nConfig: I18nConfig = {
  defaultLocale: 'en',
  fallbackLocale: 'en',
  locales: defaultLocales
}