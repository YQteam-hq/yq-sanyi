/**
 * Theme and styling utilities for yq-sanyi components
 * @packageDocumentation
 */

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Theme name */
  name: string
  /** Theme colors */
  colors: ThemeColors
  /** Theme typography */
  typography: ThemeTypography
  /** Theme spacing */
  spacing: ThemeSpacing
  /** Theme borders */
  borders: ThemeBorders
  /** Theme shadows */
  shadows: ThemeShadows
  /** Theme breakpoints */
  breakpoints: ThemeBreakpoints
  /** Theme transitions */
  transitions: ThemeTransitions
  /** Theme z-index */
  zIndex: ThemeZIndex
}

/**
 * Theme colors
 */
export interface ThemeColors {
  /** Primary colors */
  primary: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  /** Secondary colors */
  secondary: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  /** Success colors */
  success: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  /** Error colors */
  error: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  /** Warning colors */
  warning: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  /** Info colors */
  info: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  /** Neutral colors */
  neutral: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  /** Background colors */
  background: {
    default: string
    paper: string
    card: string
    overlay: string
  }
  /** Text colors */
  text: {
    primary: string
    secondary: string
    disabled: string
    hint: string
    inverse: string
  }
  /** Border colors */
  border: {
    default: string
    light: string
    dark: string
  }
}

/**
 * Theme typography
 */
export interface ThemeTypography {
  /** Font families */
  fontFamily: {
    primary: string
    secondary: string
    monospace: string
    display: string
  }
  /** Font sizes */
  fontSize: {
    xs: string
    sm: string
    base: string
    lg: string
    xl: string
    '2xl': string
    '3xl': string
    '4xl': string
    '5xl': string
    '6xl': string
  }
  /** Font weights */
  fontWeight: {
    thin: number
    light: number
    normal: number
    medium: number
    semibold: number
    bold: number
    extrabold: number
    black: number
  }
  /** Line heights */
  lineHeight: {
    tight: number
    normal: number
    relaxed: number
    loose: number
  }
  /** Letter spacing */
  letterSpacing: {
    tight: string
    normal: string
    wide: string
  }
}

/**
 * Theme spacing
 */
export interface ThemeSpacing {
  /** Spacing scale */
  scale: {
    0: string
    1: string
    2: string
    3: string
    4: string
    5: string
    6: string
    7: string
    8: string
    9: string
    10: string
    11: string
    12: string
    16: string
    20: string
    24: string
    32: string
    40: string
    48: string
    56: string
    64: string
    72: string
    80: string
    96: string
  }
  /** Margin presets */
  margin: {
    auto: string
    none: string
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    '2xl': string
  }
  /** Padding presets */
  padding: {
    none: string
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    '2xl': string
  }
}

/**
 * Theme borders
 */
export interface ThemeBorders {
  /** Border width */
  width: {
    0: string
    1: string
    2: string
    4: string
    8: string
  }
  /** Border radius */
  radius: {
    none: string
    sm: string
    md: string
    lg: string
    full: string
    pill: string
  }
  /** Border style */
  style: {
    solid: string
    dashed: string
    dotted: string
    double: string
    none: string
  }
}

/**
 * Theme shadows
 */
export interface ThemeShadows {
  /** Shadow presets */
  sm: string
  md: string
  lg: string
  xl: string
  '2xl': string
  inner: string
  none: string
}

/**
 * Theme breakpoints
 */
export interface ThemeBreakpoints {
  xs: string
  sm: string
  md: string
  lg: string
  xl: string
  '2xl': string
}

/**
 * Theme transitions
 */
export interface ThemeTransitions {
  /** Transition durations */
  duration: {
    fast: string
    normal: string
    slow: string
  }
  /** Transition timing functions */
  timing: {
    linear: string
    ease: string
    'ease-in': string
    'ease-out': string
    'ease-in-out': string
  }
}

/**
 * Theme z-index
 */
export interface ThemeZIndex {
  auto: string
  0: string
  10: string
  20: string
  30: string
  40: string
  50: string
  60: string
  70: string
  80: string
  90: string
  100: string
}

/**
 * Theme manager for managing themes
 */
export class ThemeManager {
  private currentTheme: ThemeConfig
  private themes: Map<string, ThemeConfig> = new Map()
  private root: HTMLElement

  constructor(defaultTheme: ThemeConfig) {
    this.root = document.documentElement
    this.currentTheme = defaultTheme
    this.themes.set(defaultTheme.name, defaultTheme)
    this.applyTheme(defaultTheme)
  }

  /**
   * Add a theme
   */
  addTheme(theme: ThemeConfig): void {
    this.themes.set(theme.name, theme)
  }

  /**
   * Switch to a theme
   */
  switchTheme(themeName: string): void {
    const theme = this.themes.get(themeName)
    if (theme) {
      this.currentTheme = theme
      this.applyTheme(theme)
    } else {
      throw new Error(`Theme "${themeName}" not found`)
    }
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): ThemeConfig {
    return this.currentTheme
  }

  /**
   * Get available themes
   */
  getAvailableThemes(): string[] {
    return Array.from(this.themes.keys())
  }

  /**
   * Apply theme to the root element
   */
  private applyTheme(theme: ThemeConfig): void {
    // Apply CSS custom properties
    const cssProperties = this.generateCSSProperties(theme)
    const styleSheet = document.createElement('style')
    styleSheet.textContent = cssProperties
    styleSheet.setAttribute('data-theme', theme.name)

    // Remove old theme styles
    const oldTheme = this.root.querySelector('style[data-theme]')
    if (oldTheme) {
      oldTheme.remove()
    }

    this.root.appendChild(styleSheet)
    this.root.setAttribute('data-theme', theme.name)
  }

  /**
   * Generate CSS custom properties from theme
   */
  private generateCSSProperties(theme: ThemeConfig): string {
    let css = ':root {'
    
    // Colors
    for (const [colorName, colorValues] of Object.entries(theme.colors)) {
      for (const [shade, value] of Object.entries(colorValues)) {
        css += `--color-${colorName}-${shade}: ${value};`
      }
    }

    // Typography
    for (const [typographyName, typographyValues] of Object.entries(theme.typography)) {
      for (const [key, value] of Object.entries(typographyValues)) {
        css += `--typography-${typographyName}-${key}: ${value};`
      }
    }

    // Spacing
    for (const [spacingName, spacingValues] of Object.entries(theme.spacing)) {
      for (const [key, value] of Object.entries(spacingValues)) {
        css += `--spacing-${spacingName}-${key}: ${value};`
      }
    }

    // Borders
    for (const [borderName, borderValues] of Object.entries(theme.borders)) {
      for (const [key, value] of Object.entries(borderValues)) {
        css += `--border-${borderName}-${key}: ${value};`
      }
    }

    // Shadows
    for (const [shadowName, shadowValue] of Object.entries(theme.shadows)) {
      css += `--shadow-${shadowName}: ${shadowValue};`
    }

    // Breakpoints
    for (const [breakpointName, breakpointValue] of Object.entries(theme.breakpoints)) {
      css += `--breakpoint-${breakpointName}: ${breakpointValue};`
    }

    // Transitions
    for (const [transitionName, transitionValues] of Object.entries(theme.transitions)) {
      for (const [key, value] of Object.entries(transitionValues)) {
        css += `--transition-${transitionName}-${key}: ${value};`
      }
    }

    // Z-index
    for (const [zIndexName, zIndexValue] of Object.entries(theme.zIndex)) {
      css += `--z-index-${zIndexName}: ${zIndexValue};`
    }

    css += '}'
    return css
  }

  /**
   * Create a custom theme by extending an existing theme
   */
  extendTheme(baseThemeName: string, customizations: Partial<ThemeConfig>): ThemeConfig {
    const baseTheme = this.themes.get(baseThemeName)
    if (!baseTheme) {
      throw new Error(`Base theme "${baseThemeName}" not found`)
    }

    return {
      ...baseTheme,
      ...customizations,
      name: customizations.name || `${baseTheme.name}-custom`
    }
  }

  /**
   * Create a dark theme from a light theme
   */
  createDarkTheme(baseThemeName: string): ThemeConfig {
    const baseTheme = this.themes.get(baseThemeName)
    if (!baseTheme) {
      throw new Error(`Base theme "${baseThemeName}" not found`)
    }

    const darkColors = {
      ...baseTheme.colors,
      background: {
        default: '#1a1a1a',
        paper: '#2d2d2d',
        card: '#252525',
        overlay: '#000000'
      },
      text: {
        primary: '#ffffff',
        secondary: '#b0b0b0',
        disabled: '#666666',
        hint: '#999999',
        inverse: '#000000'
      },
      border: {
        default: '#404040',
        light: '#505050',
        dark: '#303030'
      }
    }

    return {
      ...baseTheme,
      name: `${baseTheme.name}-dark`,
      colors: darkColors
    }
  }

  /**
   * Reset to default theme
   */
  resetTheme(): void {
    this.switchTheme(this.themes.keys().next().value || 'light')
  }
}

/**
 * Theme utilities for working with themes
 */
export class ThemeUtils {
  private themeManager: ThemeManager

  constructor(defaultTheme: ThemeConfig) {
    this.themeManager = new ThemeManager(defaultTheme)
  }

  /**
   * Get the current theme manager
   */
  getThemeManager(): ThemeManager {
    return this.themeManager
  }

  /**
   * Get CSS custom property value
   */
  getCSSProperty(property: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(property)
  }

  /**
   * Set CSS custom property
   */
  setCSSProperty(property: string, value: string): void {
    document.documentElement.style.setProperty(property, value)
  }

  /**
   * Remove CSS custom property
   */
  removeCSSProperty(property: string): void {
    document.documentElement.style.removeProperty(property)
  }

  /**
   * Get color from current theme
   */
  getColor(colorName: string, shade: string): string {
    const theme = this.themeManager.getCurrentTheme()
    return (theme.colors as any)[colorName]?.[shade] || '#000000'
  }

  /**
   * Get typography value from current theme
   */
  getTypography(typographyName: string, key: string): string {
    const theme = this.themeManager.getCurrentTheme()
    return (theme.typography as any)[typographyName]?.[key] || ''
  }

  /**
   * Get spacing value from current theme
   */
  getSpacing(spacingName: string, key: string): string {
    const theme = this.themeManager.getCurrentTheme()
    return (theme.spacing as any)[spacingName]?.[key] || ''
  }

  /**
   * Apply theme to element
   */
  applyThemeToElement(element: HTMLElement, themeName: string): void {
    element.setAttribute('data-theme', themeName)
  }

  /**
   * Create responsive utility classes
   */
  createResponsiveClasses(breakpoint: string, value: string): string {
    return `sm:${breakpoint}:${value} md:${breakpoint}:${value} lg:${breakpoint}:${value} xl:${breakpoint}:${value}`
  }

  /**
   * Create utility classes for spacing
   */
  createSpacingClasses(type: 'margin' | 'padding', size: string): string {
    const theme = this.themeManager.getCurrentTheme()
    const spacing = (theme.spacing as any)[type]?.[size]
    return `${type}-${size}: ${spacing}`
  }

  /**
   * Create utility classes for colors
   */
  createColorClasses(type: 'bg' | 'text' | 'border', colorName: string, shade: string): string {
    const theme = this.themeManager.getCurrentTheme()
    const color = (theme.colors as any)[colorName]?.[shade] || '#000000'
    return `${type}-${colorName}-${shade}: ${color}`
  }

  /**
   * Create utility classes for shadows
   */
  createShadowClasses(shadowName: string): string {
    const theme = this.themeManager.getCurrentTheme()
    const shadow = theme.shadows[shadowName as keyof typeof theme.shadows] || 'none'
    return `shadow-${shadowName}: ${shadow}`
  }
}

/**
 * Pre-defined themes
 */
export const PredefinedThemes = {
  light: {
    name: 'light',
    colors: {
      primary: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e'
      },
      secondary: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a'
      },
      success: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d'
      },
      error: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d'
      },
      warning: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f'
      },
      info: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a'
      },
      neutral: {
        50: '#fafafa',
        100: '#f4f4f5',
        200: '#e4e4e7',
        300: '#d4d4d8',
        400: '#a1a1aa',
        500: '#71717a',
        600: '#52525b',
        700: '#3f3f46',
        800: '#27272a',
        900: '#18181b'
      },
      background: {
        default: '#ffffff',
        paper: '#ffffff',
        card: '#ffffff',
        overlay: 'rgba(0, 0, 0, 0.5)'
      },
      text: {
        primary: '#18181b',
        secondary: '#4b5563',
        disabled: '#9ca3af',
        hint: '#6b7280',
        inverse: '#ffffff'
      },
      border: {
        default: '#e5e7eb',
        light: '#f3f4f6',
        dark: '#d1d5db'
      }
    },
    typography: {
      fontFamily: {
        primary: 'Inter, system-ui, sans-serif',
        secondary: 'system-ui, sans-serif',
        monospace: 'ui-monospace, SFMono-Regular, monospace',
        display: 'Georgia, serif'
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem'
      },
      fontWeight: {
        thin: 100,
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
        black: 900
      },
      lineHeight: {
        tight: 1.25,
        normal: 1.5,
        relaxed: 1.75,
        loose: 2
      },
      letterSpacing: {
        tight: '-0.025em',
        normal: '0em',
        wide: '0.025em'
      }
    },
    spacing: {
      scale: {
        0: '0px',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        7: '1.75rem',
        8: '2rem',
        9: '2.25rem',
        10: '2.5rem',
        11: '2.75rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
        72: '18rem',
        80: '20rem',
        96: '24rem'
      },
      margin: {
        auto: 'auto',
        none: '0px',
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem'
      },
      padding: {
        none: '0px',
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem'
      }
    },
    borders: {
      width: {
        0: '0px',
        1: '1px',
        2: '2px',
        4: '4px',
        8: '8px'
      },
      radius: {
        none: '0px',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        full: '9999px',
        pill: '9999px'
      },
      style: {
        solid: 'solid',
        dashed: 'dashed',
        dotted: 'dotted',
        double: 'double',
        none: 'none'
      }
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      none: 'none'
    },
    breakpoints: {
      xs: '0px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    transitions: {
      duration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms'
      },
      timing: {
        linear: 'linear',
        ease: 'ease',
        'ease-in': 'ease-in',
        'ease-out': 'ease-out',
        'ease-in-out': 'ease-in-out'
      }
    },
    zIndex: {
      auto: 'auto',
      0: '0',
      10: '10',
      20: '20',
      30: '30',
      40: '40',
      50: '50',
      60: '60',
      70: '70',
      80: '80',
      90: '90',
      100: '100'
    }
  }
}

/**
 * Default theme utils instance
 */
export const defaultThemeUtils = new ThemeUtils(PredefinedThemes.light)

/**
 * Export commonly used utilities
 */
export default {
  ThemeManager,
  ThemeUtils,
  PredefinedThemes,
  defaultThemeUtils
}