/**
 * Advanced form validation helpers for yq-sanyi components
 * @packageDocumentation
 */

import type { ComponentDefinition, ComponentScript } from '../../core/src/index.js'

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp | string
  min?: number
  max?: number
  custom?: (value: any) => boolean | string
  email?: boolean
  url?: boolean
  alpha?: boolean
  alphanumeric?: boolean
  numeric?: boolean
  date?: boolean
  equalTo?: string
  unique?: string[]
  file?: {
    types?: string[]
    maxSize?: number
  }
  errorMessages?: Partial<Record<keyof ValidationRule, string>>
}

export interface FieldConfig {
  name: string
  label: string
  type: string
  rules?: ValidationRule
  errorMessages?: Partial<Record<keyof ValidationRule, string>>
  defaultValue?: any
  placeholder?: string
  description?: string
}

export interface FormConfig {
  fields: FieldConfig[]
  onSubmit?: (data: Record<string, any>) => void
  onError?: (errors: Record<string, string>) => void
  validateOn?: 'blur' | 'change' | 'submit' | ('blur' | 'change' | 'submit')[]
}

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
  touched: Record<string, boolean>
  dirty: Record<string, boolean>
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  public static emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  public static urlRegex = /^https?:\/\/.+/
  private static alphaRegex = /^[a-zA-Z]+$/
  private static alphanumericRegex = /^[a-zA-Z0-9]+$/
  private static numericRegex = /^[0-9]+$/

  /**
   * Validate a single field
   */
  static validateField(value: any, rules: ValidationRule, fieldName: string): string | null {
    if (rules.required && (value === undefined || value === null || value === '')) {
      return rules.errorMessages?.required || `${fieldName} is required`
    }

    if (value !== undefined && value !== null && value !== '') {
      if (rules.minLength !== undefined && typeof value === 'string' && value.length < rules.minLength) {
        return rules.errorMessages?.minLength || `${fieldName} must be at least ${rules.minLength} characters`
      }

      if (rules.maxLength !== undefined && typeof value === 'string' && value.length > rules.maxLength) {
        return rules.errorMessages?.maxLength || `${fieldName} must be no more than ${rules.maxLength} characters`
      }

      if (rules.pattern) {
        const regex = typeof rules.pattern === 'string' ? new RegExp(rules.pattern) : rules.pattern
        if (!regex.test(String(value))) {
          return rules.errorMessages?.pattern || `${fieldName} format is invalid`
        }
      }

      if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
        return rules.errorMessages?.min || `${fieldName} must be at least ${rules.min}`
      }

      if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
        return rules.errorMessages?.max || `${fieldName} must be no more than ${rules.max}`
      }

      if (rules.email && !this.emailRegex.test(String(value))) {
        return rules.errorMessages?.email || `${fieldName} must be a valid email address`
      }

      if (rules.url && !this.urlRegex.test(String(value))) {
        return rules.errorMessages?.url || `${fieldName} must be a valid URL`
      }

      if (rules.alpha && !this.alphaRegex.test(String(value))) {
        return rules.errorMessages?.alpha || `${fieldName} must contain only letters`
      }

      if (rules.alphanumeric && !this.alphanumericRegex.test(String(value))) {
        return rules.errorMessages?.alphanumeric || `${fieldName} must contain only letters and numbers`
      }

      if (rules.numeric && !this.numericRegex.test(String(value))) {
        return rules.errorMessages?.numeric || `${fieldName} must contain only numbers`
      }

      if (rules.date && isNaN(Date.parse(String(value)))) {
        return rules.errorMessages?.date || `${fieldName} must be a valid date`
      }

      if (rules.custom) {
        const customResult = rules.custom(value)
        if (customResult !== true) {
          return typeof customResult === 'string' ? customResult : `${fieldName} is invalid`
        }
      }
    }

    return null
  }

  /**
   * Validate entire form
   */
  static validateForm(data: Record<string, any>, fields: FieldConfig[]): ValidationResult {
    const errors: Record<string, string> = {}
    const touched: Record<string, boolean> = {}
    const dirty: Record<string, boolean> = {}

    for (const field of fields) {
      const value = data[field.name]
      const error = this.validateField(value, field.rules || {}, field.label)
      
      if (error) {
        errors[field.name] = error
      }
      
      touched[field.name] = false
      dirty[field.name] = value !== field.defaultValue
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      touched,
      dirty
    }
  }

  /**
   * Get formatted error message
   */
  static formatError(error: string, field: FieldConfig): string {
    return error.replace(field.label, field.name)
  }

  /**
   * Create validator function
   */
  static createValidator(fields: FieldConfig[]): (data: Record<string, any>) => ValidationResult {
    return (data: Record<string, any>) => this.validateForm(data, fields)
  }

  /**
   * Async validation with custom rules
   */
  static async validateAsync(
    value: any, 
    rules: ValidationRule, 
    fieldName: string,
    asyncRules?: ((value: any) => Promise<boolean>)[]
  ): Promise<string | null> {
    const syncError = this.validateField(value, rules, fieldName)
    if (syncError) return syncError

    if (asyncRules) {
      for (const rule of asyncRules) {
        try {
          const isValid = await rule(value)
          if (!isValid) {
            return `${fieldName} validation failed`
          }
        } catch (error) {
          return `${fieldName} validation error: ${error}`
        }
      }
    }

    return null
  }
}

/**
 * Form validation manager
 */
export class FormValidationManager {
  private formConfig: FormConfig
  private validationState: ValidationResult
  private fields: Map<string, FieldConfig> = new Map()

  constructor(config: FormConfig) {
    this.formConfig = config
    this.validationState = {
      isValid: false,
      errors: {},
      touched: {},
      dirty: {}
    }
    
    // Initialize fields
    config.fields.forEach(field => {
      this.fields.set(field.name, field)
      this.validationState.touched[field.name] = false
      this.validationState.dirty[field.name] = false
    })
  }

  /**
   * Validate field on blur
   */
  validateOnBlur(fieldName: string, value: any): string | null {
    this.validationState.touched[fieldName] = true
    return this.validateField(fieldName, value)
  }

  /**
   * Validate field on change
   */
  validateOnChange(fieldName: string, value: any): string | null {
    this.validationState.dirty[fieldName] = true
    return this.validateField(fieldName, value)
  }

  /**
   * Validate entire form
   */
  validateForm(data: Record<string, any>): ValidationResult {
    this.validationState = ValidationUtils.validateForm(data, this.formConfig.fields)
    
    if (!this.validationState.isValid && this.formConfig.onError) {
      this.formConfig.onError(this.validationState.errors)
    }
    
    return this.validationState
  }

  /**
   * Submit form
   */
  submitForm(data: Record<string, any>): boolean {
    const validation = this.validateForm(data)
    
    if (validation.isValid && this.formConfig.onSubmit) {
      this.formConfig.onSubmit(data)
      return true
    }
    
    return false
  }

  /**
   * Reset form
   */
  resetForm(): void {
    this.validationState = {
      isValid: false,
      errors: {},
      touched: {},
      dirty: {}
    }
    
    // Reset touched and dirty states
    this.formConfig.fields.forEach(field => {
      this.validationState.touched[field.name] = false
      this.validationState.dirty[field.name] = false
    })
  }

  /**
   * Get field error
   */
  getFieldError(fieldName: string): string | null {
    return this.validationState.errors[fieldName] || null
  }

  /**
   * Check if field is valid
   */
  isFieldValid(fieldName: string): boolean {
    return !this.validationState.errors[fieldName]
  }

  /**
   * Check if field is touched
   */
  isFieldTouched(fieldName: string): boolean {
    return this.validationState.touched[fieldName]
  }

  /**
   * Check if field is dirty
   */
  isFieldDirty(fieldName: string): boolean {
    return this.validationState.dirty[fieldName]
  }

  /**
   * Get validation state
   */
  getValidationState(): ValidationResult {
    return { ...this.validationState }
  }

  private validateField(fieldName: string, value: any): string | null {
    const field = this.fields.get(fieldName)
    if (!field) return null
    
    return ValidationUtils.validateField(value, field.rules || {}, field.label)
  }
}

/**
 * Pre-built validation components
 */
export const ValidationComponents = {
  /**
   * Create input field with validation
   */
  inputField: (config: FieldConfig): ComponentDefinition => ({
    name: `yq-input-${config.name}`,
    template: `
      <div class="form-field">
        <label for="${config.name}">${config.label}</label>
        <input 
          type="${config.type}" 
          id="${config.name}" 
          name="${config.name}"
          yq-model="${config.name}"
          placeholder="${config.placeholder || ''}"
          aria-describedby="${config.name}-description ${config.name}-error"
          yq-on:blur="validateField('${config.name}')"
          yq-on:change="validateField('${config.name}')"
          yq-class:invalid="!!errors['${config.name}']"
          yq-class:touched="touched['${config.name}']"
          yq-class:dirty="dirty['${config.name}']"
        />
        <div id="${config.name}-description" class="field-description">${config.description || ''}</div>
        <div id="${config.name}-error" class="field-error" yq-show="!!errors['${config.name}']">
          {{ errors['${config.name}'] }}
        </div>
      </div>
    `,
    style: `
      .form-field { display: flex; flex-direction: column; gap: 0.5rem; }
      .form-field label { font-weight: 600; }
      .form-field input { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
      .form-field input:focus { outline: none; border-color: #007bff; }
      .form-field input.invalid { border-color: #dc3545; }
      .field-description { font-size: 0.875rem; color: #6c757d; }
      .field-error { font-size: 0.875rem; color: #dc3545; }
    `,
    script: function () {
      return {
        state: { 
          [config.name]: config.defaultValue || '',
          errors: {},
          touched: {},
          dirty: {}
        },
        validateField: function (fieldName: string) {
          const error = ValidationUtils.validateField(
            (this as any).state[fieldName], 
            (config as any).rules || {}, 
            (config as any).label
          )
          
          if (error) {
            ;(this as any).state.errors[fieldName] = error
          } else {
            delete (this as any).state.errors[fieldName]
          }
          
          ;(this as any).state.touched[fieldName] = true
          ;(this as any).state.dirty[fieldName] = true
        }
      }
    }
  }),

  /**
   * Create form with validation
   */
  validatedForm: (config: FormConfig): ComponentDefinition => ({
    name: 'yq-validated-form',
    template: `
      <form class="validated-form" yq-on:submit="handleSubmit">
        ${config.fields.map(field => `
          <div class="form-field">
            <label for="${field.name}">${field.label}</label>
            <input 
              type="${field.type}" 
              id="${field.name}" 
              name="${field.name}"
              yq-model="${field.name}"
              placeholder="${field.placeholder || ''}"
              aria-describedby="${field.name}-description ${field.name}-error"
              yq-on:blur="validateField('${field.name}')"
              yq-on:change="validateField('${field.name}')"
              yq-class:invalid="!!errors['${field.name}']"
              yq-class:touched="touched['${field.name}']"
              yq-class:dirty="dirty['${field.name}']"
            />
            <div id="${field.name}-description" class="field-description">${field.description || ''}</div>
            <div id="${field.name}-error" class="field-error" yq-show="!!errors['${field.name}']">
              {{ errors['${field.name}'] }}
            </div>
          </div>
        `).join('')}
        <button type="submit" yq-class:disabled="!isValid">Submit</button>
      </form>
    `,
    style: `
      .validated-form { display: flex; flex-direction: column; gap: 1rem; }
      .form-field { display: flex; flex-direction: column; gap: 0.5rem; }
      .form-field label { font-weight: 600; }
      .form-field input { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
      .form-field input:focus { outline: none; border-color: #007bff; }
      .form-field input.invalid { border-color: #dc3545; }
      .field-description { font-size: 0.875rem; color: #6c757d; }
      .field-error { font-size: 0.875rem; color: #dc3545; }
      button { padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
      button:disabled { background: #6c757d; cursor: not-allowed; }
    `,
    script: function () {
      const manager = new FormValidationManager(config)
      
      return {
        state: {
          ...config.fields.reduce((acc, field) => {
            acc[field.name] = field.defaultValue || ''
            return acc
          }, {} as Record<string, any>),
          errors: {},
          touched: {},
          dirty: {},
          isValid: false
        },
        validateField: function (fieldName: string) {
          const field = config.fields.find(f => f.name === fieldName)
          if (field) {
            const error = ValidationUtils.validateField(
              (this as any).state[fieldName], 
              (field as any).rules || {}, 
              (field as any).label
            )
            
            if (error) {
              ;(this as any).state.errors[fieldName] = error
            } else {
              delete (this as any).state.errors[fieldName]
            }
            
            ;(this as any).state.touched[fieldName] = true
            ;(this as any).state.dirty[fieldName] = true
            
            ;(this as any).state.isValid = Object.keys((this as any).state.errors).length === 0
          }
        },
        handleSubmit: function () {
          const validation = manager.validateForm((this as any).state)
          ;(this as any).state.errors = validation.errors
          ;(this as any).state.touched = validation.touched
          ;(this as any).state.dirty = validation.dirty
          ;(this as any).state.isValid = validation.isValid
          
          if (validation.isValid && config.onSubmit) {
            config.onSubmit((this as any).state)
          }
        }
      }
    }
  }),

  /**
   * Create validation summary
   */
  validationSummary: (): ComponentDefinition => ({
    name: 'yq-validation-summary',
    template: `
      <div class="validation-summary" yq-show="hasErrors">
        <h3>Validation Errors:</h3>
        <ul>
          <li yq-for="error in errors">{{ error }}</li>
        </ul>
      </div>
    `,
    style: `
      .validation-summary { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; }
      .validation-summary h3 { margin: 0 0 0.5rem 0; color: #721c24; }
      .validation-summary ul { margin: 0; padding-left: 1.5rem; }
      .validation-summary li { color: #721c24; margin-bottom: 0.25rem; }
    `,
    script: function () {
      return {
        state: { errors: [] as string[] },
        get hasErrors() {
          return (this as any).state.errors.length > 0
        },
        addError: function (error: string) {
          if (!(this as any).state.errors.includes(error)) {
            ;(this as any).state.errors.push(error)
          }
        },
        clearErrors: function () {
          ;(this as any).state.errors = []
        }
      }
    }
  })
}

/**
 * Validation rule builders
 */
export const ValidationRules = {
  /**
   * Create required rule
   */
  required: (message?: string): ValidationRule => ({
    required: true,
    custom: (value: any) => value !== undefined && value !== null && value !== ''
  }),

  /**
   * Create email rule
   */
  email: (message?: string): ValidationRule => ({
    email: true,
    custom: (value: any) => ValidationUtils.emailRegex.test(String(value))
  }),

  /**
   * Create URL rule
   */
  url: (message?: string): ValidationRule => ({
    url: true,
    custom: (value: any) => ValidationUtils.urlRegex.test(String(value))
  }),

  /**
   * Create length rule
   */
  length: (min: number, max?: number): ValidationRule => ({
    minLength: min,
    maxLength: max,
    custom: (value: any) => {
      const str = String(value)
      return min <= str.length && (!max || str.length <= max)
    }
  }),

  /**
   * Create numeric range rule
   */
  range: (min: number, max: number): ValidationRule => ({
    min,
    max,
    custom: (value: any) => {
      const num = Number(value)
      return num >= min && num <= max
    }
  }),

  /**
   * Create pattern rule
   */
  pattern: (regex: RegExp, message?: string): ValidationRule => ({
    pattern: regex,
    custom: (value: any) => regex.test(String(value))
  }),

  /**
   * Create custom rule
   */
  custom: (validator: (value: any) => boolean | string, message?: string): ValidationRule => ({
    custom: validator
  })
}

// Export utilities - note: ValidationUtils, FormValidationManager are already exported above