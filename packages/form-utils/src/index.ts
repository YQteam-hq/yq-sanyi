/**
 * Form Utils - Advanced Form Handling and Automation Utilities for yq-sanyi
 * 
 * This package provides comprehensive form handling, validation, automation,
 * and submission utilities for yq-sanyi applications. It includes form builders,
 * validation engines, form automation, and form state management.
 * 
 * @packageDocumentation
 */

/**
 * Form field types
 */
export type FormFieldType = 
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'url'
  | 'date'
  | 'datetime-local'
  | 'time'
  | 'month'
  | 'week'
  | 'search'
  | 'color'
  | 'range'
  | 'file'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'textarea'
  | 'hidden'
  | 'button'
  | 'submit'
  | 'reset';

/**
 * Form field validation rules
 */
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  email?: boolean;
  url?: boolean;
  numeric?: boolean;
  alpha?: boolean;
  alphanumeric?: boolean;
  date?: boolean;
  time?: boolean;
}

/**
 * Form field configuration
 */
export interface FormField {
  name: string;
  type: FormFieldType;
  label?: string;
  placeholder?: string;
  value?: any;
  defaultValue?: any;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  validation?: ValidationRule;
  options?: Array<{ value: any; label: string; disabled?: boolean }>;
  attributes?: Record<string, any>;
  classes?: string[];
  dependencies?: string[];
  conditions?: { [key: string]: any };
}

/**
 * Form configuration
 */
export interface FormConfig {
  fields: FormField[];
  onSubmit?: (data: any) => Promise<any> | any;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onChange?: (data: any) => void;
  onValidate?: (data: any) => { isValid: boolean; errors: { [key: string]: string } };
  validateOn?: 'blur' | 'change' | 'submit' | 'always';
  autoSave?: boolean;
  saveInterval?: number;
  submitButton?: {
    text: string;
    disabled?: boolean;
    classes?: string[];
  };
  cancelButton?: {
    text: string;
    classes?: string[];
  };
  resetButton?: {
    text: string;
    classes?: string[];
  };
}

/**
 * Form state
 */
export interface FormState {
  data: { [key: string]: any };
  errors: { [key: string]: string };
  touched: { [key: string]: boolean };
  dirty: { [key: string]: boolean };
  isValid: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  submitCount: number;
}

/**
 * Form validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: { [key: string]: string };
  warnings: { [key: string]: string };
}

/**
 * Form submission options
 */
export interface FormSubmissionOptions {
  validate?: boolean;
  preventDefault?: boolean;
  async?: boolean;
  timeout?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
}

/**
 * Form automation step
 */
export interface FormAutomationStep {
  type: 'set' | 'validate' | 'submit' | 'wait' | 'conditional';
  target?: string;
  value?: any;
  condition?: { [key: string]: any };
  delay?: number;
  action?: string;
}

/**
 * Form builder interface
 */
export interface FormBuilder {
  addField(field: FormField): FormBuilder;
  removeField(name: string): FormBuilder;
  updateField(name: string, updates: Partial<FormField>): FormBuilder;
  setConfig(config: FormConfig): FormBuilder;
  build(): FormManager;
}

/**
 * Form manager interface
 */
export interface FormManager {
  getForm(): HTMLFormElement;
  getField(name: string): FormField | null;
  getFieldValue(name: string): any;
  setFieldValue(name: string, value: any): void;
  getFormData(): any;
  setFormData(data: any): void;
  validateField(name: string): ValidationResult;
  validateForm(): ValidationResult;
  submit(options?: FormSubmissionOptions): Promise<any>;
  reset(): void;
  clear(): void;
  destroy(): void;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  getState(): FormState;
  setState(state: Partial<FormState>): void;
  emit(event: string, data: any): void;
}

/**
 * Form automation interface
 */
export interface FormAutomation {
  addStep(step: FormAutomationStep): FormAutomation;
  removeStep(index: number): FormAutomation;
  execute(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  isRunning(): boolean;
}

/**
 * Form class
 */
export class FormManagerImpl implements FormManager {
  private form: HTMLFormElement;
  private config: FormConfig;
  private state: FormState;
  private fields: Map<string, FormField> = new Map();
  private handlers: Map<string, Function[]> = new Map();
  private automationSteps: FormAutomationStep[] = [];
  private automationRunning = false;
  private automationPaused = false;
  private saveTimeout: any;
  
  constructor(form: HTMLFormElement, config: FormConfig) {
    this.form = form;
    this.config = config;
    this.state = {
      data: {},
      errors: {},
      touched: {},
      dirty: {},
      isValid: true,
      isSubmitting: false,
      isSubmitted: false,
      submitCount: 0
    };
    
    this.initializeFields();
    this.setupEventListeners();
  }
  
  getForm(): HTMLFormElement {
    return this.form;
  }
  
  getField(name: string): FormField | null {
    return this.fields.get(name) || null;
  }
  
  getFieldValue(name: string): any {
    const field = this.getField(name);
    if (!field) return undefined;
    
    const element = this.form.elements.namedItem(name);
    if (!element) return field.defaultValue;
    
    switch (field.type) {
      case 'checkbox':
        const checkbox = element as HTMLInputElement;
        return checkbox.checked;
      case 'radio':
        const radio = element as HTMLInputElement;
        return radio.checked ? radio.value : undefined;
      case 'select':
        const select = element as HTMLSelectElement;
        return select.multiple ? Array.from(select.selectedOptions).map(opt => opt.value) : select.value;
      case 'file':
        const file = element as HTMLInputElement;
        return file.files ? Array.from(file.files) : undefined;
      default:
        const input = element as HTMLInputElement;
        return input.value;
    }
  }
  
  setFieldValue(name: string, value: any): void {
    const field = this.getField(name);
    if (!field) return;
    
    const element = this.form.elements.namedItem(name);
    if (!element) {
      this.state.data[name] = value;
      this.state.dirty[name] = true;
      return;
    }
    
    switch (field.type) {
      case 'checkbox':
        const checkbox = element as HTMLInputElement;
        checkbox.checked = !!value;
        break;
      case 'radio':
        const radio = element as HTMLInputElement;
        radio.checked = radio.value === value;
        break;
      case 'select':
        const select = element as HTMLSelectElement;
        if (select.multiple) {
          const values = Array.isArray(value) ? value : [value];
          Array.from(select.options).forEach(option => {
            option.selected = values.includes(option.value);
          });
        } else {
          select.value = value || '';
        }
        break;
      case 'file':
        // File input values can't be set programmatically for security reasons
        break;
      default:
        const input = element as HTMLInputElement;
        input.value = value || '';
        break;
    }
    
    this.state.data[name] = value;
    this.state.dirty[name] = true;
    this.state.touched[name] = true;
    
    // Trigger change event
    this.emit('change', { name, value });
  }
  
  getFormData(): any {
    const data: any = {};
    
    this.fields.forEach((field, name) => {
      data[name] = this.getFieldValue(name);
    });
    
    return data;
  }
  
  setFormData(data: any): void {
    Object.keys(data).forEach(name => {
      this.setFieldValue(name, data[name]);
    });
  }
  
  validateField(name: string): ValidationResult {
    const field = this.getField(name);
    if (!field) return { isValid: true, errors: {}, warnings: {} };
    
    const value = this.getFieldValue(name);
    const errors: { [key: string]: string } = {};
    
    // Required validation
    if (field.required && (value === '' || value === null || value === undefined)) {
      errors[name] = 'This field is required';
      return { isValid: false, errors, warnings: {} };
    }
    
    // Skip validation if field is empty and not required
    if (!field.required && (value === '' || value === null || value === undefined)) {
      return { isValid: true, errors: {}, warnings: {} };
    }
    
    // Validation rules
    if (field.validation) {
      const rules = field.validation;
      
      // Min length validation
      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors[name] = `Minimum length is ${rules.minLength} characters`;
      }
      
      // Max length validation
      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors[name] = `Maximum length is ${rules.maxLength} characters`;
      }
      
      // Min value validation
      if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
        errors[name] = `Minimum value is ${rules.min}`;
      }
      
      // Max value validation
      if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
        errors[name] = `Maximum value is ${rules.max}`;
      }
      
      // Pattern validation
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors[name] = 'Invalid format';
      }
      
      // Email validation
      if (rules.email && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors[name] = 'Invalid email address';
      }
      
      // URL validation
      if (rules.url && typeof value === 'string' && !/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(value)) {
        errors[name] = 'Invalid URL';
      }
      
      // Numeric validation
      if (rules.numeric && typeof value === 'string' && !/^\d+$/.test(value)) {
        errors[name] = 'Must be a number';
      }
      
      // Alpha validation
      if (rules.alpha && typeof value === 'string' && !/^[a-zA-Z]+$/.test(value)) {
        errors[name] = 'Must contain only letters';
      }
      
      // Alphanumeric validation
      if (rules.alphanumeric && typeof value === 'string' && !/^[a-zA-Z0-9]+$/.test(value)) {
        errors[name] = 'Must contain only letters and numbers';
      }
      
      // Custom validation
      if (rules.custom && typeof rules.custom === 'function') {
        const customResult = rules.custom(value);
        if (customResult !== true) {
          errors[name] = typeof customResult === 'string' ? customResult : 'Invalid value';
        }
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings: {}
    };
  }
  
  validateForm(): ValidationResult {
    const errors: { [key: string]: string } = {};
    let isValid = true;
    
    this.fields.forEach((field, name) => {
      const result = this.validateField(name);
      if (!result.isValid) {
        isValid = false;
        errors[name] = result.errors[name];
      }
    });
    
    // Custom validation
    if (this.config.onValidate) {
      const customResult = this.config.onValidate(this.getFormData());
      if (!customResult.isValid) {
        isValid = false;
        Object.assign(errors, customResult.errors);
      }
    }
    
    return {
      isValid,
      errors,
      warnings: {}
    };
  }
  
  async submit(options: FormSubmissionOptions = {}): Promise<any> {
    if (options.validate !== false) {
      const validation = this.validateForm();
      if (!validation.isValid) {
        this.setState({ errors: validation.errors });
        if (this.config.onError) {
          this.config.onError(new Error('Form validation failed'));
        }
        throw new Error('Form validation failed');
      }
    }
    
    this.setState({ isSubmitting: true });
    
    try {
      let result: any;
      
      if (this.config.onSubmit) {
        result = await this.config.onSubmit(this.getFormData());
      } else if (options.url) {
        result = await this.submitToUrl(options);
      } else {
        result = this.getFormData();
      }
      
      this.setState({
        isSubmitting: false,
        isSubmitted: true,
        submitCount: this.state.submitCount + 1,
        errors: {}
      });
      
      if (this.config.onSuccess) {
        this.config.onSuccess(result);
      }
      
      this.emit('submit', { result });
      
      return result;
    } catch (error) {
      this.setState({ isSubmitting: false });
      
      if (this.config.onError) {
        this.config.onError(error);
      }
      
      this.emit('error', { error });
      
      throw error;
    }
  }
  
  reset(): void {
    this.fields.forEach((field, name) => {
      this.setFieldValue(name, field.defaultValue);
    });
    
    this.setState({
      errors: {},
      touched: {},
      dirty: {},
      isSubmitting: false,
      isSubmitted: false,
      submitCount: 0
    });
    
    this.emit('reset', {});
  }
  
  clear(): void {
    this.fields.forEach((field, name) => {
      this.setFieldValue(name, undefined);
    });
    
    this.setState({
      data: {},
      errors: {},
      touched: {},
      dirty: {},
      isValid: true,
      isSubmitting: false,
      isSubmitted: false,
      submitCount: 0
    });
    
    this.emit('clear', {});
  }
  
  destroy(): void {
    this.form.reset();
    this.fields.clear();
    this.handlers.clear();
    this.automationSteps = [];
    
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.emit('destroy', {});
  }
  
  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }
  
  off(event: string, handler: Function): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  getState(): FormState {
    return { ...this.state };
  }
  
  setState(state: Partial<FormState>): void {
    this.state = { ...this.state, ...state };
    this.emit('stateChange', { state: this.state });
  }
  
  // Private methods
  
  private initializeFields(): void {
    this.config.fields.forEach(field => {
      this.fields.set(field.name, field);
      this.state.data[field.name] = field.defaultValue;
    });
  }
  
  private setupEventListeners(): void {
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    
    this.fields.forEach((field, name) => {
      const element = this.form.elements.namedItem(name);
      if (element) {
        (element as HTMLElement).addEventListener('blur', () => {
          this.state.touched[name] = true;
          if (this.config.validateOn === 'blur') {
            const result = this.validateField(name);
            this.setState({ errors: { ...this.state.errors, ...result.errors } });
          }
        });
        
        (element as HTMLElement).addEventListener('change', () => {
          this.state.touched[name] = true;
          this.state.dirty[name] = true;
          
          if (this.config.validateOn === 'change') {
            const result = this.validateField(name);
            this.setState({ errors: { ...this.state.errors, ...result.errors } });
          }
          
          if (this.config.onChange) {
            this.config.onChange(this.getFormData());
          }
        });
      }
    });
    
    // Auto-save functionality
    if (this.config.autoSave && this.config.saveInterval) {
      this.setupAutoSave();
    }
  }
  
  private handleSubmit(event: Event): void {
    event.preventDefault();
    
    this.submit().catch(error => {
      console.error('Form submission error:', error);
    });
  }
  
  private setupAutoSave(): void {
    const save = () => {
      const data = this.getFormData();
      // Implement auto-save logic here
      console.log('Auto-saving form data:', data);
    };
    
    this.saveTimeout = setInterval(save, this.config.saveInterval);
  }
  
  private async submitToUrl(options: FormSubmissionOptions): Promise<any> {
    const formData = new FormData(this.form);
    const response = await fetch(options.url!, {
      method: options.method || 'POST',
      headers: options.headers || {},
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
  
  emit(event: string, data: any): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  }
}

/**
 * Form builder implementation
 */
export class FormBuilderImpl implements FormBuilder {
  private fields: FormField[] = [];
  private config: FormConfig = {
    fields: [],
    validateOn: 'blur',
    autoSave: false,
    saveInterval: 30000,
    submitButton: {
      text: 'Submit'
    }
  };
  
  addField(field: FormField): FormBuilder {
    this.fields.push(field);
    return this;
  }
  
  removeField(name: string): FormBuilder {
    this.fields = this.fields.filter(field => field.name !== name);
    return this;
  }
  
  updateField(name: string, updates: Partial<FormField>): FormBuilder {
    const field = this.fields.find(f => f.name === name);
    if (field) {
      Object.assign(field, updates);
    }
    return this;
  }
  
  setConfig(config: FormConfig): FormBuilder {
    this.config = { ...this.config, ...config };
    return this;
  }
  
  build(): FormManager {
    this.config.fields = this.fields;
    
    // Create a dummy form element
    const form = document.createElement('form');
    form.id = 'yq-form-' + Date.now();
    
    return new FormManagerImpl(form, this.config);
  }
}

/**
 * Form automation implementation
 */
export class FormAutomationImpl implements FormAutomation {
  private steps: FormAutomationStep[] = [];
  private currentStep = 0;
  private running = false;
  private paused = false;
  private formManager: FormManager;
  
  constructor(formManager: FormManager) {
    this.formManager = formManager;
  }
  
  addStep(step: FormAutomationStep): FormAutomation {
    this.steps.push(step);
    return this;
  }
  
  removeStep(index: number): FormAutomation {
    this.steps.splice(index, 1);
    return this;
  }
  
  async execute(): Promise<void> {
    this.running = true;
    this.paused = false;
    
    try {
      for (let i = this.currentStep; i < this.steps.length; i++) {
        if (this.paused) {
          this.currentStep = i;
          return;
        }
        
        const step = this.steps[i];
        await this.executeStep(step);
      }
    } finally {
      this.running = false;
      this.currentStep = 0;
    }
  }
  
  pause(): void {
    this.paused = true;
  }
  
  resume(): void {
    this.paused = false;
    if (this.running) {
      this.execute();
    }
  }
  
  stop(): void {
    this.running = false;
    this.paused = false;
    this.currentStep = 0;
  }
  
  isRunning(): boolean {
    return this.running;
  }
  
  private async executeStep(step: FormAutomationStep): Promise<void> {
    switch (step.type) {
      case 'set':
        if (step.target) {
          this.formManager.setFieldValue(step.target, step.value);
        }
        break;
        
      case 'validate':
        if (step.target) {
          const result = this.formManager.validateField(step.target);
          if (!result.isValid) {
            throw new Error(`Validation failed for field ${step.target}: ${result.errors[step.target]}`);
          }
        }
        break;
        
      case 'submit':
        await this.formManager.submit();
        break;
        
      case 'wait':
        if (step.delay) {
          await new Promise(resolve => setTimeout(resolve, step.delay));
        }
        break;
        
      case 'conditional':
        if (step.condition && this.evaluateCondition(step.condition)) {
          if (step.action) {
            this.formManager.setFieldValue(step.target!, step.action);
          }
        }
        break;
    }
  }
  
  private evaluateCondition(condition: { [key: string]: any }): boolean {
    // Simple condition evaluation
    return Object.entries(condition).every(([key, value]) => {
      const fieldValue = this.formManager.getFieldValue(key);
      return fieldValue === value;
    });
  }
}

/**
 * Form utilities
 */
export const formUtils = {
  /**
   * Create a new form builder
   */
  createBuilder: (): FormBuilder => {
    return new FormBuilderImpl();
  },
  
  /**
   * Create a form manager from an existing form element
   */
  createManager: (form: HTMLFormElement, config: FormConfig): FormManager => {
    return new FormManagerImpl(form, config);
  },
  
  /**
   * Create a form automation instance
   */
  createAutomation: (formManager: FormManager): FormAutomation => {
    return new FormAutomationImpl(formManager);
  },
  
  /**
   * Validate a single value against rules
   */
  validateValue: (value: any, rules: ValidationRule): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (rules.required && (value === '' || value === null || value === undefined)) {
      errors.push('This field is required');
    }
    
    if (!rules.required && (value === '' || value === null || value === undefined)) {
      return { isValid: true, errors: [] };
    }
    
    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      errors.push(`Minimum length is ${rules.minLength} characters`);
    }
    
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`Maximum length is ${rules.maxLength} characters`);
    }
    
    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      errors.push(`Minimum value is ${rules.min}`);
    }
    
    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      errors.push(`Maximum value is ${rules.max}`);
    }
    
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      errors.push('Invalid format');
    }
    
    if (rules.email && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push('Invalid email address');
    }
    
    if (rules.url && typeof value === 'string' && !/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(value)) {
      errors.push('Invalid URL');
    }
    
    if (rules.custom && typeof rules.custom === 'function') {
      const customResult = rules.custom(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : 'Invalid value');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  /**
   * Serialize form data to JSON
   */
  serializeForm: (form: HTMLFormElement): any => {
    const formData = new FormData(form);
    const data: any = {};
    
    formData.forEach((value, key) => {
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    });
    
    return data;
  },
  
  /**
   * Populate form with data
   */
  populateForm: (form: HTMLFormElement, data: any): void => {
    Object.keys(data).forEach(key => {
      const element = form.elements.namedItem(key);
      if (element) {
        const value = data[key];
        
        if ((element as HTMLInputElement).type === 'checkbox') {
          (element as HTMLInputElement).checked = !!value;
        } else if ((element as HTMLInputElement).type === 'radio') {
          (element as HTMLInputElement).checked = (element as HTMLInputElement).value === value;
        } else if ((element as HTMLSelectElement).multiple) {
          const select = element as HTMLSelectElement;
          Array.from(select.options).forEach(option => {
            option.selected = Array.isArray(value) ? value.includes(option.value) : option.value === value;
          });
        } else {
          (element as HTMLInputElement).value = value;
        }
      }
    });
  }
};

/**
 * Form validation utilities
 */
export const formValidation = {
  /**
   * Common validation rules
   */
  rules: {
    required: (value: any) => value !== '' && value !== null && value !== undefined,
    email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    url: (value: string) => /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(value),
    numeric: (value: string) => /^\d+$/.test(value),
    alpha: (value: string) => /^[a-zA-Z]+$/.test(value),
    alphanumeric: (value: string) => /^[a-zA-Z0-9]+$/.test(value),
    minLength: (min: number) => (value: string) => value.length >= min,
    maxLength: (max: number) => (value: string) => value.length <= max,
    min: (min: number) => (value: number) => value >= min,
    max: (max: number) => (value: number) => value <= max,
    pattern: (pattern: RegExp) => (value: string) => pattern.test(value)
  },
  
  /**
   * Create a validation schema
   */
  createSchema: (schema: { [key: string]: ValidationRule }): ValidationRule[] => {
    return Object.entries(schema).map(([key, rules]) => ({
      ...rules,
      name: key
    }));
  },
  
  /**
   * Validate data against a schema
   */
  validateSchema: (data: any, schema: { [key: string]: ValidationRule }): ValidationResult => {
    const errors: { [key: string]: string } = {};
    let isValid = true;
    
    Object.entries(schema).forEach(([key, rules]) => {
      const value = data[key];
      const result = formUtils.validateValue(value, rules);
      
      if (!result.isValid) {
        isValid = false;
        errors[key] = result.errors[0]; // Take first error
      }
    });
    
    return {
      isValid,
      errors,
      warnings: {}
    };
  }
};

/**
 * Form templates
 */
export const formTemplates = {
  /**
   * Create a contact form
   */
  contactForm: (): FormBuilder => {
    return formUtils.createBuilder()
      .addField({
        name: 'name',
        type: 'text',
        label: 'Name',
        required: true,
        validation: { minLength: 2 }
      })
      .addField({
        name: 'email',
        type: 'email',
        label: 'Email',
        required: true,
        validation: { email: true }
      })
      .addField({
        name: 'subject',
        type: 'text',
        label: 'Subject',
        required: true,
        validation: { minLength: 5 }
      })
      .addField({
        name: 'message',
        type: 'textarea',
        label: 'Message',
        required: true,
        validation: { minLength: 10 }
      });
  },
  
  /**
   * Create a user registration form
   */
  registrationForm: (): FormBuilder => {
    return formUtils.createBuilder()
      .addField({
        name: 'username',
        type: 'text',
        label: 'Username',
        required: true,
        validation: { 
          minLength: 3,
          maxLength: 20,
          alphanumeric: true
        }
      })
      .addField({
        name: 'email',
        type: 'email',
        label: 'Email',
        required: true,
        validation: { email: true }
      })
      .addField({
        name: 'password',
        type: 'password',
        label: 'Password',
        required: true,
        validation: { 
          minLength: 8,
          custom: (value) => {
            if (!/(?=.*[a-z])/.test(value)) return 'Must contain at least one lowercase letter';
            if (!/(?=.*[A-Z])/.test(value)) return 'Must contain at least one uppercase letter';
            if (!/(?=.*\d)/.test(value)) return 'Must contain at least one number';
            if (!/(?=.*[@$!%*?&])/.test(value)) return 'Must contain at least one special character';
            return true;
          }
        }
      })
      .addField({
        name: 'confirmPassword',
        type: 'password',
        label: 'Confirm Password',
        required: true,
        validation: {
          custom: (value) => {
            const password = document.querySelector('input[name="password"]') as HTMLInputElement;
            return value === password?.value || 'Passwords must match';
          }
        }
      })
      .addField({
        name: 'acceptTerms',
        type: 'checkbox',
        label: 'I accept the terms and conditions',
        required: true
      });
  },
  
  /**
   * Create a search form
   */
  searchForm: (): FormBuilder => {
    return formUtils.createBuilder()
      .addField({
        name: 'query',
        type: 'search',
        label: 'Search',
        placeholder: 'Enter search term...'
      })
      .addField({
        name: 'category',
        type: 'select',
        label: 'Category',
        options: [
          { value: '', label: 'All Categories' },
          { value: 'technology', label: 'Technology' },
          { value: 'business', label: 'Business' },
          { value: 'science', label: 'Science' },
          { value: 'entertainment', label: 'Entertainment' }
        ]
      })
      .addField({
        name: 'dateRange',
        type: 'date',
        label: 'Date Range'
      });
  }
};