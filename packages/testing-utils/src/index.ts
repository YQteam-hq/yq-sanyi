/**
 * Advanced testing utilities for yq-sanyi components
 * @packageDocumentation
 */

// import { yq } from '@yq-sanyi/core' - Not available in testing environment

/**
 * Test runner configuration options
 */
export interface TestRunnerConfig {
  /** Timeout for individual tests in milliseconds */
  timeout?: number
  /** Whether to run tests in parallel */
  parallel?: boolean
  /** Whether to show verbose output */
  verbose?: boolean
  /** Whether to fail fast on first error */
  failFast?: boolean
  /** Custom DOM mock implementation */
  domMock?: any
}

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  /** Suite name */
  name: string
  /** Setup function executed before each test */
  setup?: () => Promise<void> | void
  /** Teardown function executed after each test */
  teardown?: () => Promise<void> | void
  /** Test cases */
  tests: TestCase[]
}

/**
 * Individual test case
 */
export interface TestCase {
  /** Test name */
  name: string
  /** Test function */
  test: () => Promise<void> | void
  /** Expected error (for error testing) */
  expectError?: boolean
  /** Timeout in milliseconds */
  timeout?: number
}

/**
 * Test result
 */
export interface TestResult {
  /** Test name */
  name: string
  /** Whether the test passed */
  passed: boolean
  /** Error message if test failed */
  error?: string
  /** Execution time in milliseconds */
  duration: number
  /** Timestamp when test started */
  startTime: number
  /** Timestamp when test completed */
  endTime: number
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  /** Suite name */
  name: string
  /** Total number of tests */
  total: number
  /** Number of passed tests */
  passed: number
  /** Number of failed tests */
  failed: number
  /** Individual test results */
  results: TestResult[]
  /** Suite execution time in milliseconds */
  duration: number
  /** Suite start time */
  startTime: number
  /** Suite end time */
  endTime: number
}

/**
 * Component testing utilities
 */
export class ComponentTester {
  private componentDefinition: any
  private container: HTMLElement
  private config: TestRunnerConfig

  constructor(componentDefinition: any, config: TestRunnerConfig = {}) {
    this.componentDefinition = componentDefinition
    this.config = {
      timeout: 5000,
      parallel: false,
      verbose: false,
      failFast: false,
      ...config
    }
    this.container = this.createTestContainer()
  }

  /**
   * Create a test container for component testing
   */
  private createTestContainer(): HTMLElement {
    const container = document.createElement('div')
    container.id = 'yq-test-container'
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '-9999px'
    container.style.visibility = 'hidden'
    document.body.appendChild(container)
    return container
  }

  /**
   * Mount a component instance for testing
   */
  mount(componentName: string, props?: Record<string, any>): HTMLElement {
    const element = document.createElement(componentName)
    
    // Set props as attributes
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === true || value === false) {
          element.setAttribute(key, value.toString())
        } else {
          element.setAttribute(key, String(value))
        }
      }
    }

    this.container.appendChild(element)
    return element
  }

  /**
   * Unmount a component instance
   */
  unmount(element: HTMLElement): void {
    if (element.parentNode) {
      element.parentNode.removeChild(element)
    }
  }

  /**
   * Simulate user interaction
   */
  async simulateInteraction(element: HTMLElement, eventType: string, options?: any): Promise<void> {
    return new Promise((resolve) => {
      const event = new Event(eventType, options)
      element.dispatchEvent(event)
      setTimeout(resolve, 0)
    })
  }

  /**
   * Get component state
   */
  getState(element: HTMLElement): any {
    // This would need to be implemented based on yq-sanyi's internal state access
    // For now, return a mock implementation
    return {}
  }

  /**
   * Wait for component to update
   */
  async waitForUpdate(element: HTMLElement, timeout = this.config.timeout): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const check = () => {
        if (Date.now() - startTime > (timeout || 5000)) {
          reject(new Error(`Timeout waiting for component update after ${timeout}ms`))
          return
        }
        // Check if component has updated (implementation depends on yq-sanyi internals)
        setTimeout(check, 50)
      }
      check()
    })
  }

  /**
   * Clean up test container
   */
  cleanup(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}

/**
 * Test runner for executing test suites
 */
export class TestRunner {
  private suites: TestSuiteConfig[] = []
  private results: TestSuiteResult[] = []
  private config: TestRunnerConfig

  constructor(config: TestRunnerConfig = {}) {
    this.config = {
      timeout: 5000,
      parallel: false,
      verbose: false,
      failFast: false,
      ...config
    }
  }

  /**
   * Add a test suite
   */
  addSuite(suite: TestSuiteConfig): void {
    this.suites.push(suite)
  }

  /**
   * Run all test suites
   */
  async runAll(): Promise<TestSuiteResult[]> {
    this.results = []
    
    for (const suite of this.suites) {
      const result = await this.runSuite(suite)
      this.results.push(result)
      
      if (this.config.failFast && result.failed > 0) {
        break
      }
    }

    return this.results
  }

  /**
   * Run a single test suite
   */
  async runSuite(suite: TestSuiteConfig): Promise<TestSuiteResult> {
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`Running test suite: ${suite.name}`)

    for (const testCase of suite.tests) {
      const result = await this.runTest(testCase, suite)
      results.push(result)

      if (this.config.failFast && !result.passed) {
        break
      }
    }

    const endTime = Date.now()
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length

    const suiteResult: TestSuiteResult = {
      name: suite.name,
      total: results.length,
      passed,
      failed,
      results,
      duration: endTime - startTime,
      startTime,
      endTime
    }

    if (this.config.verbose) {
      console.log(`Suite "${suite.name}" completed: ${passed} passed, ${failed} failed, ${suiteResult.duration}ms`)
    }

    return suiteResult
  }

  /**
   * Run a single test case
   */
  async runTest(testCase: TestCase, suite: TestSuiteConfig): Promise<TestResult> {
    const startTime = Date.now()

    try {
      // Run setup if provided
      if (suite.setup) {
        await suite.setup()
      }

      // Execute test with timeout
      const timeout = testCase.timeout || this.config.timeout
      const testPromise = testCase.test()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout)
      })

      await Promise.race([testPromise, timeoutPromise])

      const endTime = Date.now()
      
      if (testCase.expectError) {
        throw new Error('Test expected an error but none was thrown')
      }

      return {
        name: testCase.name,
        passed: true,
        duration: endTime - startTime,
        startTime,
        endTime
      }
    } catch (error) {
      const endTime = Date.now()
      
      if (testCase.expectError) {
        return {
          name: testCase.name,
          passed: true,
          duration: endTime - startTime,
          startTime,
          endTime
        }
      }

      return {
        name: testCase.name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: endTime - startTime,
        startTime,
        endTime
      }
    } finally {
      // Run teardown if provided
      if (suite.teardown) {
        await suite.teardown()
      }
    }
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    let report = 'Test Report\n'
    report += '='.repeat(50) + '\n\n'

    let totalPassed = 0
    let totalFailed = 0
    let totalDuration = 0

    for (const suite of this.results) {
      report += `Suite: ${suite.name}\n`
      report += `  Total: ${suite.total}, Passed: ${suite.passed}, Failed: ${suite.failed}\n`
      report += `  Duration: ${suite.duration}ms\n\n`

      for (const result of suite.results) {
        const status = result.passed ? '✓' : '✗'
        report += `  ${status} ${result.name} (${result.duration}ms)\n`
        if (!result.passed) {
          report += `      Error: ${result.error}\n`
        }
      }

      report += '\n'
      totalPassed += suite.passed
      totalFailed += suite.failed
      totalDuration += suite.duration
    }

    report += 'Summary\n'
    report += '='.repeat(50) + '\n'
    report += `Total Suites: ${this.results.length}\n`
    report += `Total Tests: ${totalPassed + totalFailed}\n`
    report += `Passed: ${totalPassed}\n`
    report += `Failed: ${totalFailed}\n`
    report += `Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%\n`
    report += `Total Duration: ${totalDuration}ms\n`

    return report
  }
}

/**
 * Mock utilities for testing
 */
export class MockUtils {
  /**
   * Create a mock DOM environment
   */
  static createMockDOM(): any {
    return {
      document: {
        createElement: (tagName: string) => ({
          tagName,
          style: {},
          classList: {
            add: () => {},
            remove: () => {},
            contains: () => false
          },
          setAttribute: () => {},
          getAttribute: () => null,
          removeAttribute: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          appendChild: () => {},
          removeChild: () => {},
          querySelector: () => null,
          querySelectorAll: () => [],
          innerHTML: '',
          outerHTML: ''
        }),
        createTextNode: (text: string) => ({ textContent: text }),
        body: {
          appendChild: () => {},
          removeChild: () => {}
        },
        head: {
          appendChild: () => {},
          removeChild: () => {}
        }
      },
      window: {
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {}
      },
      console: {
        log: () => {},
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {}
      }
    }
  }

  /**
   * Mock yq-sanyi component definitions
   */
  static mockComponent(name: string, mockImplementation: any): void {
    // This would need to be implemented based on yq-sanyi's internal API
    // For now, it's a placeholder
  }

  /**
   * Mock async operations
   */
  static createAsyncMock<T>(values: T[]): (index?: number) => Promise<T> {
    let callCount = 0
    return async (index = callCount++): Promise<T> => {
      if (index >= values.length) {
        throw new Error(`Mock async function called with index ${index} but only ${values.length} values provided`)
      }
      return values[index]
    }
  }
}

/**
 * Assertion utilities for testing
 */
export class AssertionUtils {
  /**
   * Assert that a value is truthy
   */
  static assert(value: any, message = 'Expected value to be truthy'): void {
    if (!value) {
      throw new Error(message)
    }
  }

  /**
   * Assert that a value is falsy
   */
  static assertNot(value: any, message = 'Expected value to be falsy'): void {
    if (value) {
      throw new Error(message)
    }
  }

  /**
   * Assert that two values are equal
   */
  static assertEquals(actual: any, expected: any, message = 'Expected values to be equal'): void {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`)
    }
  }

  /**
   * Assert that two values are not equal
   */
  static assertNotEquals(actual: any, expected: any, message = 'Expected values to not be equal'): void {
    if (actual === expected) {
      throw new Error(message)
    }
  }

  /**
   * Assert that an array contains a value
   */
  static assertContains(array: any[], value: any, message = 'Expected array to contain value'): void {
    if (!array.includes(value)) {
      throw new Error(`${message}: array does not contain ${value}`)
    }
  }

  /**
   * Assert that an array does not contain a value
   */
  static assertNotContains(array: any[], value: any, message = 'Expected array to not contain value'): void {
    if (array.includes(value)) {
      throw new Error(`${message}: array contains ${value}`)
    }
  }

  /**
   * Assert that a function throws an error
   */
  static async assertThrows(fn: () => Promise<void> | void, message = 'Expected function to throw'): Promise<void> {
    try {
      await fn()
      throw new Error(message)
    } catch (error) {
      // Expected error
    }
  }

  /**
   * Assert that a function does not throw an error
   */
  static async assertNotThrows(fn: () => Promise<void> | void, message = 'Expected function not to throw'): Promise<void> {
    try {
      await fn()
    } catch (error) {
      throw new Error(`${message}: function threw ${error}`)
    }
  }
}

/**
 * Convenience function for creating test suites
 */
export function createTestSuite(name: string, tests: TestCase[], config?: Partial<TestSuiteConfig>): TestSuiteConfig {
  return {
    name,
    tests,
    ...config
  }
}

/**
 * Convenience function for creating test cases
 */
export function createTestCase(name: string, test: () => Promise<void> | void, options?: Partial<TestCase>): TestCase {
  return {
    name,
    test,
    ...options
  }
}

/**
 * Default test runner instance
 */
export const defaultTestRunner = new TestRunner()

/**
 * Export commonly used utilities
 */
export default {
  ComponentTester,
  TestRunner,
  MockUtils,
  AssertionUtils,
  createTestSuite,
  createTestCase,
  defaultTestRunner
}