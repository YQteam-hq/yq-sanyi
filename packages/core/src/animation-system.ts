import { State, Derived, ComponentDefinition } from './index.js'

export interface AnimationKeyframe {
  property: string
  value: any
  offset?: number
  easing?: string
}

export interface AnimationOptions {
  duration?: number
  easing?: string
  delay?: number
  fill?: 'none' | 'forwards' | 'backwards' | 'both'
  iterationCount?: number | 'infinite'
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  playState?: 'running' | 'paused'
  onComplete?: () => void
  onCancel?: () => void
  onUpdate?: (progress: number) => void
}

export interface TransitionOptions {
  duration?: number
  easing?: string
  delay?: number
  fill?: 'none' | 'forwards' | 'backwards' | 'both'
  onComplete?: () => void
  onCancel?: () => void
  onUpdate?: (progress: number) => void
}

export interface AnimationSequence {
  id: string
  animations: Array<{
    target: HTMLElement
    keyframes: AnimationKeyframe[]
    options: AnimationOptions
  }>
  parallel?: boolean
  delay?: number
}

export interface SpringPhysics {
  stiffness: number
  damping: number
  mass: number
  velocity?: number
  precision?: number
}

export interface SpringAnimationOptions extends AnimationOptions {
  physics?: SpringPhysics
  from?: number
  to?: number
  restThreshold?: number
}

export interface StaggerAnimationOptions extends AnimationOptions {
  staggerDelay?: number
  staggerDirection?: 'forward' | 'reverse' | 'center'
  staggerEasing?: string
}

export class AnimationEngine {
  private static animations = new Map<string, Animation>()
  private static sequences = new Map<string, AnimationSequence>()
  private static rafId: number | null = null
  private static isRunning = false

  // Animation control
  static animate(
    element: HTMLElement,
    keyframes: AnimationKeyframe[],
    options: AnimationOptions = {}
  ): string {
    const id = `animation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const animation = new Animation(element, keyframes, options, id)
    
    this.animations.set(id, animation)
    this.startAnimationLoop()
    
    return id
  }

  static transition(
    element: HTMLElement,
    from: { [key: string]: any },
    to: { [key: string]: any },
    options: TransitionOptions = {}
  ): string {
    const keyframes: AnimationKeyframe[] = [
      { property: 'from', value: from, offset: 0 },
      { property: 'to', value: to, offset: 1 }
    ]
    
    return this.animate(element, keyframes, options)
  }

  static spring(
    element: HTMLElement,
    property: string,
    from: number,
    to: number,
    options: SpringAnimationOptions = {}
  ): string {
    const physics: SpringPhysics = {
      stiffness: 100,
      damping: 10,
      mass: 1,
      ...options.physics
    }

    const springAnimation = new SpringAnimation(
      element,
      property,
      from,
      to,
      physics,
      options
    )
    
    const id = `spring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.animations.set(id, springAnimation)
    this.startAnimationLoop()
    
    return id
  }

  static stagger(
    elements: HTMLElement[],
    keyframes: AnimationKeyframe[],
    options: StaggerAnimationOptions = {}
  ): string[] {
    const { staggerDelay = 50, staggerDirection = 'forward', staggerEasing = 'ease' } = options
    const animationIds: string[] = []

    const sortedElements = [...elements].sort((a, b) => {
      const aIndex = parseInt(a.dataset.index || '0')
      const bIndex = parseInt(b.dataset.index || '0')
      return staggerDirection === 'forward' ? aIndex - bIndex : bIndex - aIndex
    })

    sortedElements.forEach((element, index) => {
      const delay = index * staggerDelay
      const elementOptions: AnimationOptions = {
        ...options,
        delay: (options.delay || 0) + delay
      }
      
      const animationId = this.animate(element, keyframes, elementOptions)
      animationIds.push(animationId)
    })

    return animationIds
  }

  static sequence(sequences: AnimationSequence[]): string {
    const sequenceId = `sequence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const executeSequence = async (index: number) => {
      if (index >= sequences.length) return
      
      const sequence = sequences[index]
      const animationPromises: Promise<void>[] = []
      
      for (const animationStep of sequence.animations) {
        const promise = new Promise<void>((resolve) => {
          const options = {
            ...animationStep.options,
            onComplete: () => {
              resolve()
              animationStep.options.onComplete?.()
            },
            onCancel: animationStep.options.onCancel
          }
          
          this.animate(animationStep.target, animationStep.keyframes, options)
        })
        
        animationPromises.push(promise)
      }
      
      if (sequence.parallel) {
        await Promise.all(animationPromises)
      } else {
        for (const promise of animationPromises) {
          await promise
        }
      }
      
      executeSequence(index + 1)
    }
    
    this.sequences.set(sequenceId, { sequences, id: sequenceId })
    executeSequence(0)
    
    return sequenceId
  }

  static pause(id: string): void {
    const animation = this.animations.get(id)
    if (animation) {
      animation.pause()
    }
  }

  static resume(id: string): void {
    const animation = this.animations.get(id)
    if (animation) {
      animation.resume()
    }
  }

  static cancel(id: string): void {
    const animation = this.animations.get(id)
    if (animation) {
      animation.cancel()
      this.animations.delete(id)
    }
  }

  static cancelAll(): void {
    for (const [id, animation] of this.animations) {
      animation.cancel()
    }
    this.animations.clear()
    this.sequences.clear()
  }

  private static startAnimationLoop(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    
    const animate = () => {
      let hasActiveAnimations = false
      
      for (const [id, animation] of this.animations) {
        if (!animation.isComplete()) {
          animation.update()
          hasActiveAnimations = true
        } else {
          this.animations.delete(id)
        }
      }
      
      if (hasActiveAnimations) {
        this.rafId = requestAnimationFrame(animate)
      } else {
        this.isRunning = false
        this.rafId = null
      }
    }
    
    this.rafId = requestAnimationFrame(animate)
  }
}

class Animation {
  private element: HTMLElement
  private keyframes: AnimationKeyframe[]
  private options: AnimationOptions
  private id: string
  private startTime: number | null = null
  private paused = false
  private pausedTime = 0
  private currentFrame = 0
  private totalFrames: number

  constructor(
    element: HTMLElement,
    keyframes: AnimationKeyframe[],
    options: AnimationOptions,
    id: string
  ) {
    this.element = element
    this.keyframes = keyframes
    this.options = options
    this.id = id
    this.totalFrames = keyframes.length
  }

  start(): void {
    this.startTime = performance.now()
    this.applyKeyframe(0)
  }

  pause(): void {
    this.paused = true
    this.pausedTime = performance.now()
  }

  resume(): void {
    if (this.paused) {
      this.paused = false
      if (this.pausedTime && this.startTime) {
        this.startTime += performance.now() - this.pausedTime
      }
    }
  }

  cancel(): void {
    this.options.onCancel?.()
    this.cleanup()
  }

  isComplete(): boolean {
    return this.currentFrame >= this.totalFrames - 1
  }

  update(): void {
    if (!this.startTime || this.paused) return

    const currentTime = performance.now()
    const elapsed = currentTime - this.startTime - (this.pausedTime || 0)
    
    const duration = this.options.duration || 1000
    const delay = this.options.delay || 0
    
    if (elapsed < delay) return

    const progress = Math.min((elapsed - delay) / duration, 1)
    
    this.options.onUpdate?.(progress)
    
    const frameIndex = Math.floor(progress * (this.totalFrames - 1))
    this.currentFrame = Math.min(frameIndex, this.totalFrames - 1)
    
    this.applyKeyframe(this.currentFrame)
    
    if (progress >= 1) {
      this.options.onComplete?.()
      this.cleanup()
    }
  }

  private applyKeyframe(frameIndex: number): void {
    const keyframe = this.keyframes[frameIndex]
    if (!keyframe) return

    const element = this.element
    const property = keyframe.property
    const value = keyframe.value

    if (property === 'from') {
      Object.entries(value).forEach(([key, val]) => {
        element.style[key] = val
      })
    } else if (property === 'to') {
      Object.entries(value).forEach(([key, val]) => {
        element.style[key] = val
      })
    } else {
      element.style[property] = value
    }
  }

  private cleanup(): void {
    if (this.options.fill === 'forwards') {
      const lastKeyframe = this.keyframes[this.keyframes.length - 1]
      if (lastKeyframe && lastKeyframe.property === 'to') {
        Object.entries(lastKeyframe.value).forEach(([key, val]) => {
          this.element.style[key] = val
        })
      }
    }
  }
}

class SpringAnimation extends Animation {
  private property: string
  private from: number
  private to: number
  private physics: SpringPhysics
  private options: SpringAnimationOptions
  private velocity = 0
  private position = 0
  private lastTime = 0

  constructor(
    element: HTMLElement,
    property: string,
    from: number,
    to: number,
    physics: SpringPhysics,
    options: SpringAnimationOptions
  ) {
    const keyframes: AnimationKeyframe[] = [
      { property: 'from', value: from, offset: 0 },
      { property: 'to', value: to, offset: 1 }
    ]
    
    super(element, keyframes, options, `spring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
    
    this.property = property
    this.from = from
    this.to = to
    this.physics = physics
    this.options = options
    this.position = from
    this.lastTime = performance.now()
  }

  update(): void {
    if (!this.lastTime) return

    const currentTime = performance.now()
    const deltaTime = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    const { stiffness, damping, mass, precision = 0.01 } = this.physics
    const restThreshold = this.options.restThreshold || precision

    // Spring physics calculation
    const force = -stiffness * (this.position - this.to) - damping * this.velocity
    const acceleration = force / mass
    
    this.velocity += acceleration * deltaTime
    this.position += this.velocity * deltaTime

    // Apply the value
    this.element.style[this.property] = `${this.position}px`

    // Check if animation should complete
    const distance = Math.abs(this.position - this.to)
    const velocityMagnitude = Math.abs(this.velocity)
    
    if (distance < restThreshold && velocityMagnitude < restThreshold) {
      this.position = this.to
      this.element.style[this.property] = `${this.to}px`
      this.options.onComplete?.()
      this.cleanup()
    }
  }

  isComplete(): boolean {
    return this.position === this.to
  }
}

// Animation utilities
export const AnimationUtils = {
  // Preset animations
  presets: {
    fadeIn: {
      keyframes: [
        { property: 'opacity', value: 0, offset: 0 },
        { property: 'opacity', value: 1, offset: 1 }
      ],
      duration: 300,
      easing: 'ease-in-out'
    },
    
    fadeOut: {
      keyframes: [
        { property: 'opacity', value: 1, offset: 0 },
        { property: 'opacity', value: 0, offset: 1 }
      ],
      duration: 300,
      easing: 'ease-in-out'
    },
    
    slideInLeft: {
      keyframes: [
        { property: 'transform', value: 'translateX(-100%)', offset: 0 },
        { property: 'transform', value: 'translateX(0)', offset: 1 }
      ],
      duration: 300,
      easing: 'ease-out'
    },
    
    slideOutRight: {
      keyframes: [
        { property: 'transform', value: 'translateX(0)', offset: 0 },
        { property: 'transform', value: 'translateX(100%)', offset: 1 }
      ],
      duration: 300,
      easing: 'ease-in'
    },
    
    bounceIn: {
      keyframes: [
        { property: 'transform', value: 'scale(0.3)', offset: 0 },
        { property: 'transform', value: 'scale(1.05)', offset: 0.7 },
        { property: 'transform', value: 'scale(0.9)', offset: 0.85 },
        { property: 'transform', value: 'scale(1)', offset: 1 }
      ],
      duration: 800,
      easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    },
    
    shake: {
      keyframes: [
        { property: 'transform', value: 'translateX(0)', offset: 0 },
        { property: 'transform', value: 'translateX(-10px)', offset: 0.1 },
        { property: 'transform', value: 'translateX(10px)', offset: 0.2 },
        { property: 'transform', value: 'translateX(-10px)', offset: 0.3 },
        { property: 'transform', value: 'translateX(10px)', offset: 0.4 },
        { property: 'transform', value: 'translateX(-10px)', offset: 0.5 },
        { property: 'transform', value: 'translateX(10px)', offset: 0.6 },
        { property: 'transform', value: 'translateX(-10px)', offset: 0.7 },
        { property: 'transform', value: 'translateX(10px)', offset: 0.8 },
        { property: 'transform', value: 'translateX(0)', offset: 1 }
      ],
      duration: 500,
      easing: 'ease-in-out'
    }
  },

  // Apply preset animation
  applyPreset: (
    element: HTMLElement,
    presetName: keyof typeof AnimationUtils.presets,
    options: AnimationOptions = {}
  ): string => {
    const preset = AnimationUtils.presets[presetName]
    if (!preset) {
      throw new Error(`Animation preset '${presetName}' not found`)
    }
    
    return AnimationEngine.animate(element, preset.keyframes, { ...preset, ...options })
  },

  // Create custom animation
  createAnimation: (
    keyframes: AnimationKeyframe[],
    options: AnimationOptions = {}
  ): ((element: HTMLElement) => string) => {
    return (element: HTMLElement) => {
      return AnimationEngine.animate(element, keyframes, options)
    }
  },

  // Create transition
  createTransition: (
    from: { [key: string]: any },
    to: { [key: string]: any },
    options: TransitionOptions = {}
  ): ((element: HTMLElement) => string) => {
    return (element: HTMLElement) => {
      return AnimationEngine.transition(element, from, to, options)
    }
  },

  // Create spring animation
  createSpring: (
    property: string,
    from: number,
    to: number,
    options: SpringAnimationOptions = {}
  ): ((element: HTMLElement) => string) => {
    return (element: HTMLElement) => {
      return AnimationEngine.spring(element, property, from, to, options)
    }
  },

  // Create stagger animation
  createStagger: (
    keyframes: AnimationKeyframe[],
    options: StaggerAnimationOptions = {}
  ): ((elements: HTMLElement[]) => string[]) => {
    return (elements: HTMLElement[]) => {
      return AnimationEngine.stagger(elements, keyframes, options)
    }
  },

  // Animate CSS classes
  animateClass: (
    element: HTMLElement,
    className: string,
    options: AnimationOptions = {}
  ): string => {
    const keyframes: AnimationKeyframe[] = [
      { property: 'class', value: element.className, offset: 0 },
      { property: 'class', value: `${element.className} ${className}`, offset: 1 }
    ]
    
    return AnimationEngine.animate(element, keyframes, options)
  },

  // Animate transform
  animateTransform: (
    element: HTMLElement,
    transforms: Array<{
      property: string
      value: string
      offset?: number
    }>,
    options: AnimationOptions = {}
  ): string => {
    const keyframes: AnimationKeyframe[] = transforms.map(t => ({
      property: 'transform',
      value: t.value,
      offset: t.offset || 0
    }))
    
    return AnimationEngine.animate(element, keyframes, options)
  },

  // Animate opacity
  animateOpacity: (
    element: HTMLElement,
    from: number,
    to: number,
    options: AnimationOptions = {}
  ): string => {
    const keyframes: AnimationKeyframe[] = [
      { property: 'opacity', value: from, offset: 0 },
      { property: 'opacity', value: to, offset: 1 }
    ]
    
    return AnimationEngine.animate(element, keyframes, options)
  },

  // Animate color
  animateColor: (
    element: HTMLElement,
    property: string,
    from: string,
    to: string,
    options: AnimationOptions = {}
  ): string => {
    const keyframes: AnimationKeyframe[] = [
      { property, value: from, offset: 0 },
      { property, value: to, offset: 1 }
    ]
    
    return AnimationEngine.animate(element, keyframes, options)
  },

  // Create page transition
  createPageTransition: (
    fromPage: HTMLElement,
    toPage: HTMLElement,
    direction: 'forward' | 'backward',
    options: AnimationOptions = {}
  ): string => {
    const sequence: AnimationSequence = {
      id: 'page_transition',
      animations: [
        {
          target: fromPage,
          keyframes: [
            { property: 'opacity', value: 1, offset: 0 },
            { property: 'opacity', value: 0, offset: 1 }
          ],
          options: { duration: 300, ...options }
        },
        {
          target: toPage,
          keyframes: [
            { property: 'opacity', value: 0, offset: 0 },
            { property: 'opacity', value: 1, offset: 1 }
          ],
          options: { duration: 300, delay: 150, ...options }
        }
      ],
      parallel: false
    }
    
    return AnimationEngine.sequence([sequence])
  },

  // Create modal animation
  createModalAnimation: (
    element: HTMLElement,
    type: 'open' | 'close',
    options: AnimationOptions = {}
  ): string => {
    const keyframes = type === 'open' ? [
      { property: 'opacity', value: 0, offset: 0 },
      { property: 'transform', value: 'scale(0.9)', offset: 0 },
      { property: 'opacity', value: 1, offset: 1 },
      { property: 'transform', value: 'scale(1)', offset: 1 }
    ] : [
      { property: 'opacity', value: 1, offset: 0 },
      { property: 'transform', value: 'scale(1)', offset: 0 },
      { property: 'opacity', value: 0, offset: 1 },
      { property: 'transform', value: 'scale(0.9)', offset: 1 }
    ]
    
    return AnimationEngine.animate(element, keyframes, {
      duration: 300,
      easing: 'ease-out',
      ...options
    })
  },

  // Create list animation
  createListAnimation: (
    elements: HTMLElement[],
    type: 'enter' | 'exit' | 'move',
    options: AnimationOptions = {}
  ): string[] => {
    const animationIds: string[] = []
    
    elements.forEach((element, index) => {
      const keyframes = type === 'enter' ? [
        { property: 'opacity', value: 0, offset: 0 },
        { property: 'transform', value: 'translateY(20px)', offset: 0 },
        { property: 'opacity', value: 1, offset: 1 },
        { property: 'transform', value: 'translateY(0)', offset: 1 }
      ] : type === 'exit' ? [
        { property: 'opacity', value: 1, offset: 0 },
        { property: 'transform', value: 'translateY(0)', offset: 0 },
        { property: 'opacity', value: 0, offset: 1 },
        { property: 'transform', value: 'translateY(-20px)', offset: 1 }
      ] : [
        { property: 'transform', value: 'translateX(0)', offset: 0 },
        { property: 'transform', value: 'translateX(50px)', offset: 0.5 },
        { property: 'transform', value: 'translateX(0)', offset: 1 }
      ]
      
      const animationId = AnimationEngine.animate(element, keyframes, {
        duration: 300,
        delay: index * 50,
        ...options
      })
      
      animationIds.push(animationId)
    })
    
    return animationIds
  },

  // Cleanup all animations
  cleanup: (): void => {
    AnimationEngine.cancelAll()
  }
}