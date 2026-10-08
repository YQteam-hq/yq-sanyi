/**
 * Animation and transition utilities for yq-sanyi components
 * @packageDocumentation
 */

/**
 * Animation timing functions
 */
export type TimingFunction = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier'

/**
 * Animation configuration options
 */
export interface AnimationConfig {
  /** Duration in milliseconds */
  duration: number
  /** Timing function */
  timing?: TimingFunction
  /** Delay in milliseconds */
  delay?: number
  /** Number of iterations */
  iterations?: number
  /** Fill mode */
  fill?: 'none' | 'forwards' | 'backwards' | 'both'
  /** Direction */
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
}

/**
 * Keyframe animation definition
 */
export interface KeyframeAnimation {
  /** Animation name */
  name: string
  /** Keyframes */
  keyframes: Keyframe[]
  /** Configuration */
  config: AnimationConfig
}

/**
 * Keyframe definition
 */
export interface Keyframe {
  /** Keyframe offset (0-1) */
  offset: number
  /** CSS properties */
  properties: Record<string, string | number>
}

/**
 * Transition configuration
 */
export interface TransitionConfig {
  /** Property name */
  property: string
  /** Duration in milliseconds */
  duration: number
  /** Timing function */
  timing?: TimingFunction
  /** Delay in milliseconds */
  delay?: number
  /** Transition type */
  type?: 'transition' | 'transform' | 'opacity'
}

/**
 * Animation state
 */
export interface AnimationState {
  /** Animation name */
  name: string
  /** Animation element */
  element: HTMLElement
  /** Animation start time */
  startTime: number
  /** Animation duration */
  duration: number
  /** Animation state */
  state: 'idle' | 'running' | 'paused' | 'completed'
  /** Animation start time */
  pauseTime?: number
  /** Pause offset */
  pauseOffset?: number
  /** Animation frame ID */
  animationFrameId?: number
}

/**
 * Animation manager for coordinating multiple animations
 */
export class AnimationManager {
  private animations: Map<string, AnimationState> = new Map()
  private rafId: number | null = null

  /**
   * Create a new animation manager
   */
  constructor() {
    this.startAnimationLoop()
  }

  /**
   * Create a CSS keyframe animation
   */
  createKeyframeAnimation(animation: KeyframeAnimation): string {
    const styleSheet = document.createElement('style')
    const keyframes = animation.keyframes.map(keyframe => {
      const properties = Object.entries(keyframe.properties)
        .map(([prop, value]) => `${prop}: ${value}`)
        .join('; ')
      return `${keyframe.offset * 100}% { ${properties} }`
    }).join('\n')

    const rule = `
      @keyframes ${animation.name} {
        ${keyframes}
      }
    `

    styleSheet.textContent = rule
    document.head.appendChild(styleSheet)

    return animation.name
  }

  /**
   * Apply an animation to an element
   */
  applyAnimation(element: HTMLElement, animationName: string, config: AnimationConfig): void {
    const animation = this.animations.get(`${animationName}-${element.id}`) || {
      name: animationName,
      element,
      startTime: Date.now(),
      duration: config.duration,
      state: 'running'
    }

    animation.startTime = Date.now()
    animation.duration = config.duration
    animation.state = 'running'

    this.animations.set(`${animationName}-${element.id}`, animation)

    // Apply CSS animation
    const cssAnimation = this.buildCSSAnimation(animationName, config)
    element.style.animation = cssAnimation
  }

  /**
   * Build CSS animation string
   */
  private buildCSSAnimation(name: string, config: AnimationConfig): string {
    const timing = config.timing || 'ease'
    const delay = config.delay || 0
    const iterations = config.iterations || 1
    const fill = config.fill || 'none'
    const direction = config.direction || 'normal'

    return `${name} ${config.duration}ms ${timing} ${delay}ms ${iterations} ${fill} ${direction}`
  }

  /**
   * Pause an animation
   */
  pauseAnimation(animationName: string, element: HTMLElement): void {
    const key = `${animationName}-${element.id}`
    const animation = this.animations.get(key)

    if (animation && animation.state === 'running') {
      animation.state = 'paused'
      animation.pauseTime = Date.now()
      animation.pauseOffset = Date.now() - animation.startTime
      element.style.animationPlayState = 'paused'
    }
  }

  /**
   * Resume an animation
   */
  resumeAnimation(animationName: string, element: HTMLElement): void {
    const key = `${animationName}-${element.id}`
    const animation = this.animations.get(key)

    if (animation && animation.state === 'paused') {
      animation.state = 'running'
      animation.startTime = Date.now() - (animation.pauseOffset || 0)
      delete animation.pauseTime
      delete animation.pauseOffset
      element.style.animationPlayState = 'running'
    }
  }

  /**
   * Cancel an animation
   */
  cancelAnimation(animationName: string, element: HTMLElement): void {
    const key = `${animationName}-${element.id}`
    const animation = this.animations.get(key)

    if (animation) {
      animation.state = 'completed'
      element.style.animation = 'none'
      this.animations.delete(key)
    }
  }

  /**
   * Animation loop for managing animations
   */
  private startAnimationLoop(): void {
    const loop = () => {
      const now = Date.now()

      for (const [key, animation] of this.animations) {
        if (animation.state === 'running') {
          const elapsed = now - animation.startTime
          const progress = Math.min(elapsed / animation.duration, 1)

          if (progress >= 1) {
            animation.state = 'completed'
            this.animations.delete(key)
          }
        }
      }

      this.rafId = requestAnimationFrame(loop)
    }

    this.rafId = requestAnimationFrame(loop)
  }

  /**
   * Clean up all animations
   */
  cleanup(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
    }

    this.animations.clear()
  }
}

/**
 * Transition manager for handling element transitions
 */
export class TransitionManager {
  private transitions: Map<string, TransitionConfig[]> = new Map()

  /**
   * Add a transition to an element
   */
  addTransition(element: HTMLElement, transition: TransitionConfig): void {
    const key = element.id || element.className
    const existing = this.transitions.get(key) || []
    existing.push(transition)
    this.transitions.set(key, existing)

    this.applyTransition(element, transition)
  }

  /**
   * Apply a transition to an element
   */
  private applyTransition(element: HTMLElement, transition: TransitionConfig): void {
    const property = transition.property
    const duration = `${transition.duration}ms`
    const timing = transition.timing || 'ease'
    const delay = `${transition.delay || 0}ms`

    element.style.transition = `${property} ${duration} ${timing} ${delay}`
  }

  /**
   * Trigger a transition by changing a property
   */
  triggerTransition(element: HTMLElement, property: string, newValue: string | number): void {
    const key = element.id || element.className
    const transitions = this.transitions.get(key) || []

    const transition = transitions.find(t => t.property === property)
    if (transition) {
      // Force a reflow to ensure transition starts
      element.style.transition = 'none'
      element.style[property as any] = String(newValue)
      element.offsetHeight // Trigger reflow

      this.applyTransition(element, transition)
    } else {
      element.style[property as any] = String(newValue)
    }
  }

  /**
   * Remove all transitions from an element
   */
  removeTransitions(element: HTMLElement): void {
    const key = element.id || element.className
    this.transitions.delete(key)
    element.style.transition = 'none'
  }

  /**
   * Create a smooth fade transition
   */
  createFadeTransition(duration: number = 300, delay: number = 0): TransitionConfig {
    return {
      property: 'opacity',
      duration,
      timing: 'ease-in-out',
      delay,
      type: 'opacity'
    }
  }

  /**
   * Create a smooth slide transition
   */
  createSlideTransition(direction: 'left' | 'right' | 'up' | 'down', duration: number = 300, delay: number = 0): TransitionConfig {
    const property = direction === 'left' || direction === 'right' ? 'transform' : 'transform'
    return {
      property,
      duration,
      timing: 'ease-in-out',
      delay,
      type: 'transform'
    }
  }

  /**
   * Create a scale transition
   */
  createScaleTransition(duration: number = 300, delay: number = 0): TransitionConfig {
    return {
      property: 'transform',
      duration,
      timing: 'ease-in-out',
      delay,
      type: 'transform'
    }
  }
}

/**
 * Animation utilities for common animations
 */
export class AnimationUtils {
  private animationManager: AnimationManager
  private transitionManager: TransitionManager

  constructor() {
    this.animationManager = new AnimationManager()
    this.transitionManager = new TransitionManager()
  }

  /**
   * Create a fade in animation
   */
  fadeIn(element: HTMLElement, duration: number = 300, delay: number = 0): void {
    element.style.opacity = '0'
    this.animationManager.applyAnimation(element, 'fade-in', {
      duration,
      delay,
      fill: 'forwards'
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="fade-in"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', 'fade-in')
      style.textContent = `
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Create a fade out animation
   */
  fadeOut(element: HTMLElement, duration: number = 300, delay: number = 0): void {
    this.animationManager.applyAnimation(element, 'fade-out', {
      duration,
      delay,
      fill: 'forwards'
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="fade-out"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', 'fade-out')
      style.textContent = `
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Create a slide in animation
   */
  slideIn(element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'left', duration: number = 300, delay: number = 0): void {
    const transform = direction === 'left' ? 'translateX(-100%)' : 
                     direction === 'right' ? 'translateX(100%)' : 
                     direction === 'up' ? 'translateY(-100%)' : 'translateY(100%)'
    
    element.style.transform = transform
    this.animationManager.applyAnimation(element, `slide-in-${direction}`, {
      duration,
      delay,
      fill: 'forwards'
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="slide-in-${direction}"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', `slide-in-${direction}`)
      style.textContent = `
        @keyframes slide-in-${direction} {
          from { transform: ${transform}; }
          to { transform: translateX(0) translateY(0); }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Create a slide out animation
   */
  slideOut(element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'left', duration: number = 300, delay: number = 0): void {
    const transform = direction === 'left' ? 'translateX(-100%)' : 
                     direction === 'right' ? 'translateX(100%)' : 
                     direction === 'up' ? 'translateY(-100%)' : 'translateY(100%)'
    
    this.animationManager.applyAnimation(element, `slide-out-${direction}`, {
      duration,
      delay,
      fill: 'forwards'
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="slide-out-${direction}"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', `slide-out-${direction}`)
      style.textContent = `
        @keyframes slide-out-${direction} {
          from { transform: translateX(0) translateY(0); }
          to { transform: ${transform}; }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Create a scale animation
   */
  scale(element: HTMLElement, scale: number, duration: number = 300, delay: number = 0): void {
    element.style.transform = `scale(${scale})`
    this.animationManager.applyAnimation(element, 'scale', {
      duration,
      delay,
      fill: 'forwards'
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="scale"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', 'scale')
      style.textContent = `
        @keyframes scale {
          from { transform: scale(1); }
          to { transform: scale(${scale}); }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Create a bounce animation
   */
  bounce(element: HTMLElement, duration: number = 500, delay: number = 0): void {
    this.animationManager.applyAnimation(element, 'bounce', {
      duration,
      delay,
      timing: 'ease-in-out' as any
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="bounce"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', 'bounce')
      style.textContent = `
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-30px); }
          60% { transform: translateY(-15px); }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Create a shake animation
   */
  shake(element: HTMLElement, duration: number = 500, delay: number = 0): void {
    this.animationManager.applyAnimation(element, 'shake', {
      duration,
      delay,
      timing: 'ease-in-out'
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="shake"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', 'shake')
      style.textContent = `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Create a pulse animation
   */
  pulse(element: HTMLElement, duration: number = 1000, delay: number = 0): void {
    this.animationManager.applyAnimation(element, 'pulse', {
      duration,
      delay,
      timing: 'ease-in-out'
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="pulse"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', 'pulse')
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Create a flip animation
   */
  flip(element: HTMLElement, duration: number = 600, delay: number = 0): void {
    this.animationManager.applyAnimation(element, 'flip', {
      duration,
      delay,
      timing: 'ease-in-out'
    })

    // Create keyframes if not already created
    if (!document.querySelector(`style[data-animation="flip"]`)) {
      const style = document.createElement('style')
      style.setAttribute('data-animation', 'flip')
      style.textContent = `
        @keyframes flip {
          0% { transform: perspective(400px) rotateY(0); }
          50% { transform: perspective(400px) rotateY(90deg); }
          100% { transform: perspective(400px) rotateY(0); }
        }
      `
      document.head.appendChild(style)
    }
  }

  /**
   * Clean up all animations
   */
  cleanup(): void {
    this.animationManager.cleanup()
  }
}

/**
 * Pre-defined animation presets
 */
export const AnimationPresets = {
  fadeIn: { duration: 300, timing: 'ease-in-out' },
  fadeOut: { duration: 300, timing: 'ease-in-out' },
  slideInLeft: { duration: 300, timing: 'ease-out' },
  slideInRight: { duration: 300, timing: 'ease-out' },
  slideInUp: { duration: 300, timing: 'ease-out' },
  slideInDown: { duration: 300, timing: 'ease-out' },
  slideOutLeft: { duration: 300, timing: 'ease-in' },
  slideOutRight: { duration: 300, timing: 'ease-in' },
  slideOutUp: { duration: 300, timing: 'ease-in' },
  slideOutDown: { duration: 300, timing: 'ease-in' },
  bounce: { duration: 500, timing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
  shake: { duration: 500, timing: 'ease-in-out' },
  pulse: { duration: 1000, timing: 'ease-in-out' },
  flip: { duration: 600, timing: 'ease-in-out' }
}

/**
 * Default animation utilities instance
 */
export const defaultAnimationUtils = new AnimationUtils()

/**
 * Export commonly used utilities
 */
export default {
  AnimationManager,
  TransitionManager,
  AnimationUtils,
  AnimationPresets,
  defaultAnimationUtils
}