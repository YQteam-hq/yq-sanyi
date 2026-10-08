# yq-sanyi Enhancements

This document describes the major enhancements and new features added to the yq-sanyi web component framework.

## Overview

The enhancements include 6 new packages that significantly extend the capabilities of yq-sanyi:

1. **Debug Utils** - Enhanced debugging and performance profiling
2. **Composition** - Advanced component composition and factory patterns
3. **Accessibility** - WCAG-compliant accessibility utilities and ARIA enhancements
4. **Validation** - Advanced form validation and error handling
5. **I18n** - Internationalization and localization support
6. **State Management** - Advanced state management patterns
7. **Analytics** - Performance monitoring and user analytics

## New Packages

### 1. Debug Utils (`@yq-sanyi/debug-utils`)

**Purpose**: Enhanced debugging utilities with performance profiling capabilities

**Features**:
- Component profiler with performance metrics tracking
- Performance monitoring with customizable thresholds
- Debug utilities for state changes and lifecycle events
- Memory usage tracking and performance analysis
- Export profiling data for debugging

**Key Classes**:
- `ComponentProfiler` - Profile individual components
- `PerformanceMonitor` - Monitor performance metrics
- `DebugUtils` - Debug utilities and snapshot comparison

**Usage**:
```typescript
import { globalProfiler, DebugUtils } from '@yq-sanyi/debug-utils'

// Start profiling a component
globalProfiler.startProfiling(componentInstance)

// Get performance report
const report = globalProfiler.getPerformanceReport()

// Log state changes
DebugUtils.logStateChange(componentInstance, 'count', 0, 1)
```

### 2. Composition (`@yq-sanyi/composition`)

**Purpose**: Advanced component composition utilities and factory patterns

**Features**:
- Component composer with mixins and inheritance
- Higher-order component support
- Reusable component patterns (modal, tabs, accordion)
- Component factory for rapid development
- Prop validation and type checking

**Key Classes**:
- `ComponentComposer` - Create composed components
- `ComponentFactory` - Factory for common components
- `ComponentPatterns` - Pre-built UI patterns

**Usage**:
```typescript
import { componentFactory, ComponentPatterns } from '@yq-sanyi/composition'

// Create a modal component
const modal = ComponentPatterns.modal('my-modal', 'My Modal', 'Content here')

// Create a form with validation
const form = componentFactory.createValidatedComponent('my-form', {
  name: 'my-form',
  template: '<form>...</form>',
  style: '.form { ... }',
  props: {
    email: { type: 'string', required: true, validator: isEmail }
  }
})
```

### 3. Accessibility (`@yq-sanyi/accessibility`)

**Purpose**: WCAG-compliant accessibility utilities and ARIA enhancements

**Features**:
- ARIA attribute management
- Keyboard navigation system
- Focus trap for modal dialogs
- Screen reader announcements
- Skip to content links
- High contrast mode detection

**Key Classes**:
- `AccessibilityUtils` - Accessibility utilities
- `KeyboardNavigation` - Keyboard navigation system
- `FocusTrap` - Focus management for modals

**Usage**:
```typescript
import { accessibilityUtils, AccessibleComponents } from '@yq-sanyi/accessibility'

// Configure accessibility
accessibilityUtils.configure({
  skipToContentLink: true,
  keyboardNavigation: true,
  screenReaderAnnouncements: true
})

// Create accessible modal
const modal = AccessibleComponents.modal('accessible-modal', 'Modal Title', 'Modal content')
```

### 4. Validation (`@yq-sanyi/validation`)

**Purpose**: Advanced form validation and error handling

**Features**:
- Comprehensive validation rules
- Async validation support
- Form validation manager
- Pre-built validation components
- Custom validation rule builders

**Key Classes**:
- `ValidationUtils` - Core validation utilities
- `FormValidationManager` - Form validation state management
- `ValidationRules` - Rule builders

**Usage**:
```typescript
import { ValidationUtils, ValidationComponents } from '@yq-sanyi/validation'

// Create a validated form
const form = ValidationComponents.validatedForm({
  fields: [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      rules: ValidationRules.email()
    }
  ]
})
```

### 5. I18n (`@yq-sanyi/i18n`)

**Purpose**: Internationalization and localization support

**Features**:
- Multi-language support
- Dynamic locale switching
- Number and date formatting
- Translation interpolation
- Context-based translation

**Key Classes**:
- `I18nManager` - Core internationalization
- `I18nProvider` - Context provider
- `I18nComponents` - Pre-built i18n components

**Usage**:
```typescript
import { createI18nConfig, I18nComponents } from '@yq-sanyi/i18n'

// Create i18n configuration
const i18n = createI18nConfig({
  defaultLocale: 'en',
  fallbackLocale: 'en',
  locales: [
    {
      code: 'en',
      name: 'English',
      translations: { welcome: 'Welcome' }
    }
  ]
})

// Create language selector
const langSelector = I18nComponents.languageSelector(i18n)
```

### 6. State Management (`@yq-sanyi/state-management`)

**Purpose**: Advanced state management patterns

**Features**:
- Store-based state management
- Context-based state sharing
- Middleware support
- Persistence middleware
- Redux-like patterns

**Key Classes**:
- `StateManager` - Global state manager
- `Store` - Individual state store
- `Context` - React-like context

**Usage**:
```typescript
import { stateManager, StateUtils } from '@yq-sanyi/state-management'

// Create a store
const store = stateManager.createStore('counter', {
  initialState: { count: 0 },
  reducer: (state, action) => {
    switch (action.type) {
      case 'increment': return { count: state.count + 1 }
      default: return state
    }
  }
})
```

### 7. Analytics (`@yq-sanyi/analytics`)

**Purpose**: Performance monitoring and user analytics

**Features**:
- Performance metrics tracking
- User interaction tracking
- Error tracking
- Session management
- Analytics dashboard

**Key Classes**:
- `AnalyticsManager` - Core analytics
- `AnalyticsUtils` - Utility functions
- `AnalyticsComponents` - Pre-built analytics components

**Usage**:
```typescript
import { analyticsManager, AnalyticsComponents } from '@yq-sanyi/analytics'

// Initialize analytics
analyticsManager.initialize()

// Track performance
analyticsManager.trackComponentPerformance('my-component', {
  renderTime: 16,
  updateTime: 4,
  memoryUsage: 2
})

// Create analytics dashboard
const dashboard = AnalyticsComponents.analyticsDashboard(analyticsManager)
```

## Installation

```bash
# Install all packages
npm install

# Build all packages
npm run build:all

# Type check all packages
npm run typecheck:all

# Run tests
npm test
```

## Migration Guide

### From yq-sanyi v0.4.1 to v0.4.2+ with Enhancements

1. **Update package.json** - Include new workspace packages
2. **Import new utilities** - Import from specific packages
3. **Update build scripts** - Use new build commands
4. **Configure new features** - Initialize new utilities as needed

### Example Migration

**Before**:
```javascript
import { define } from '@yq-sanyi/core'

define('my-component', { ... })
```

**After**:
```javascript
import { define } from '@yq-sanyi/core'
import { componentFactory } from '@yq-sanyi/composition'
import { ValidationUtils } from '@yq-sanyi/validation'

// Use enhanced features
const component = componentFactory.createSimple('my-component', template, style, script)
const validation = ValidationUtils.validateField(value, rules, 'field')
```

## Performance Considerations

- All new packages are tree-shakeable
- Debug utilities are only enabled in development
- Analytics can be sampled for production
- Validation is optimized with early returns
- State management uses efficient diffing

## Browser Compatibility

- All packages support modern browsers (ES2019+)
- Progressive enhancement for older browsers
- No external dependencies
- Works with existing yq-sanyi components

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure performance budgets are met
5. Test across different browsers

## License

All enhancements are licensed under Apache 2.0, same as the core yq-sanyi framework.