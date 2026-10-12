# yq-sanyi Advanced Features Documentation

Welcome to the advanced features documentation for the yq-sanyi framework. This document provides comprehensive information about the enhanced capabilities that have been added to the zero-dependency template library.

## 🎯 Overview

The advanced features package extends the yq-sanyi framework with powerful capabilities for modern web applications, including:

- **Advanced State Management**: Time-travel debugging, persistence, analytics
- **Component Composition**: Inheritance, mixins, higher-order components
- **Real-time Collaboration**: WebSocket integration, operational transformation
- **Advanced Debugging**: Performance profiling, memory tracking, interactive debugging

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/YQteam-hq/yq-sanyi.git
cd yq-sanyi

# Install dependencies
npm install

# Build the project
npm run build
```

## 🚀 Quick Start

### Basic Setup

```typescript
// Import advanced features
import { 
  AdvancedStateManagement, 
  AdvancedComponentComposition,
  RealtimeCollaboration,
  AdvancedDebuggingTools
} from './packages/core/src';

// Initialize features
const stateManager = new AdvancedStateManagement();
const componentComposer = new AdvancedComponentComposition();
const collaboration = new RealtimeCollaboration();
const debugTools = new AdvancedDebuggingTools();
```

### Creating Your First Advanced Component

```typescript
// Define a component with advanced features
const MyAdvancedComponent = {
  name: 'MyAdvancedComponent',
  template: `
    <div class="component">
      <h1>{{ title }}</h1>
      <p>{{ message }}</p>
      <button @click="increment">Count: {{ count }}</button>
    </div>
  `,
  styles: `
    .component {
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin: 10px;
    }
  `,
  state: {
    title: 'Advanced Component',
    message: 'Hello from yq-sanyi!',
    count: 0
  },
  methods: {
    increment() {
      this.state.count++;
    }
  }
};

// Register the component
componentComposer.registerComponent(MyAdvancedComponent);
```

## 📚 Feature Documentation

### 1. Advanced State Management

#### Core Features

```typescript
// Create a global state with advanced features
const globalState = stateManager.createGlobalState({
  name: 'app-state',
  initialValue: {
    user: null,
    theme: 'light',
    notifications: []
  },
  persistence: {
    enabled: true,
    key: 'app-state',
    interval: 5000
  },
  history: {
    enabled: true,
    maxEntries: 100
  },
  analytics: {
    enabled: true,
    tracking: ['state-changes', 'performance']
  }
});

// Subscribe to state changes
stateManager.subscribe('app-state', (newState, oldState) => {
  console.log('State changed:', newState, oldState);
});

// Use derived states
const userExists = stateManager.createDerivedState('user-exists', {
  source: 'app-state',
  compute: (state) => state.user !== null
});

// Perform state operations with middleware
stateManager.dispatch('app-state', {
  type: 'SET_USER',
  payload: { id: 1, name: 'John Doe' }
}, (state) => {
  // Middleware transformation
  return {
    ...state,
    user: { ...payload, lastLogin: new Date() }
  };
});
```

#### Time-Travel Debugging

```typescript
// Navigate through state history
stateManager.undo('app-state'); // Go to previous state
stateManager.redo('app-state'); // Go to next state
stateManager.jumpTo('app-state', 5); // Jump to specific history entry

// Get state history
const history = stateManager.getHistory('app-state');
console.log('State history:', history);
```

#### State Analytics

```typescript
// Get state analytics
const analytics = stateManager.getAnalytics('app-state');
console.log('State analytics:', analytics);

// Track custom metrics
stateManager.track('app-state', 'custom-metric', {
  value: 42,
  timestamp: Date.now()
});
```

### 2. Advanced Component Composition

#### Component Inheritance

```typescript
// Define a base component
const BaseComponent = {
  name: 'BaseComponent',
  template: `
    <div class="base">
      <slot></slot>
    </div>
  `,
  styles: '.base { padding: 10px; }',
  methods: {
    baseMethod() {
      console.log('Base method called');
    }
  }
};

// Create a derived component
const DerivedComponent = {
  name: 'DerivedComponent',
  extends: BaseComponent,
  template: `
    <div class="derived">
      <h2>{{ title }}</h2>
      <slot></slot>
    </div>
  `,
  styles: '.derived { border: 1px solid #007bff; }',
  state: {
    title: 'Derived Component'
  },
  methods: {
    derivedMethod() {
      this.baseMethod(); // Call parent method
      console.log('Derived method called');
    }
  }
};
```

#### Component Mixins

```typescript
// Define mixins
const ClickableMixin = {
  template: `
    <button @click="onClick">
      <slot>Click Me</slot>
    </button>
  `,
  methods: {
    onClick() {
      console.log('Clicked!');
      this.$emit('click');
    }
  }
};

const HoverableMixin = {
  template: `
    <div @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
      <slot></slot>
    </div>
  `,
  state: {
    isHovered: false
  },
  methods: {
    onMouseEnter() {
      this.state.isHovered = true;
    },
    onMouseLeave() {
      this.state.isHovered = false;
    }
  }
};

// Apply mixins to component
const ButtonWithFeatures = {
  name: 'ButtonWithFeatures',
  mixins: [ClickableMixin, HoverableMixin],
  template: `
    <div class="button-container" :class="{ 'hovered': state.isHovered }">
      <slot></slot>
    </div>
  `
};
```

#### Higher-Order Components

```typescript
// Create a higher-order component
const withLoading = (WrappedComponent) => {
  return {
    name: `WithLoading-${WrappedComponent.name}`,
    template: `
      <div class="loading-container">
        <div v-if="state.isLoading" class="loading-spinner">
          Loading...
        </div>
        <WrappedComponent v-else :state="state" :methods="methods" />
      </div>
    `,
    styles: '.loading-spinner { text-align: center; padding: 20px; }`,
    state: {
      isLoading: false
    },
    methods: {
      startLoading() {
        this.state.isLoading = true;
      },
      stopLoading() {
        this.state.isLoading = false;
      }
    },
    components: {
      WrappedComponent
    }
  };
};

// Use the higher-order component
const MyComponent = {
  name: 'MyComponent',
  template: '<div>{{ state.message }}</div>',
  state: { message: 'Hello World' }
};

const EnhancedComponent = withLoading(MyComponent);
```

### 3. Real-time Collaboration

#### Basic Setup

```typescript
// Initialize collaboration
collaboration.initialize({
  url: 'ws://localhost:8080',
  userId: 'user-123',
  documentId: 'shared-document',
  options: {
    reconnect: true,
    maxRetries: 5
  }
});
```

#### Collaborative Operations

```typescript
// Text operations
collaboration.insertText(0, 'Hello, world!');
collaboration.deleteText(5, 5);
collaboration.replaceText(0, 5, 'Hi');

// Cursor operations
collaboration.moveCursor(10);
collaboration.selectRange(5, 15);

// Document operations
collaboration.insertImage(0, 'image-url');
collaboration.deleteElement(0);
```

#### Event Handling

```typescript
// Handle collaborative events
collaboration.on('text-insert', (event) => {
  console.log('Text inserted:', event);
});

collaboration.on('text-delete', (event) => {
  console.log('Text deleted:', event);
});

collaboration.on('cursor-move', (event) => {
  console.log('Cursor moved:', event);
});

collaboration.on('user-joined', (event) => {
  console.log('User joined:', event);
});

collaboration.on('user-left', (event) => {
  console.log('User left:', event);
});
```

#### Conflict Resolution

```typescript
// Handle conflicts
collaboration.on('conflict', (conflict) => {
  console.log('Conflict detected:', conflict);
  
  // Resolve conflict automatically
  const resolution = collaboration.resolveConflict(conflict);
  console.log('Conflict resolved:', resolution);
});

// Custom conflict resolution
collaboration.setConflictResolver((conflict) => {
  // Custom conflict resolution logic
  return conflict.operations[0]; // Always take first operation
});
```

### 4. Advanced Debugging Tools

#### Performance Profiling

```typescript
// Start performance profiling
const profileId = debugTools.startProfile('Component Rendering');

// Monitor component performance
debugTools.monitorComponent('my-component', {
  renderTime: true,
  memoryUsage: true,
  errorTracking: true,
  updateFrequency: 1000
});

// Stop profiling and get results
debugTools.stopProfile(profileId);
const profile = debugTools.getProfile(profileId);
console.log('Performance profile:', profile);
```

#### Memory Leak Detection

```typescript
// Check for memory leaks
debugTools.checkMemoryLeaks();

// Monitor memory usage
debugTools.monitorMemoryUsage({
  interval: 5000,
  threshold: 100 * 1024 * 1024 // 100MB
});

// Get memory insights
const memoryInsights = debugTools.getMemoryInsights();
console.log('Memory insights:', memoryInsights);
```

#### Component Debugging

```typescript
// Debug specific component
debugTools.debugComponent('my-component', {
  showProps: true,
  showState: true,
  showMethods: true,
  showLifecycle: true
});

// Get component debug info
const debugInfo = debugTools.getComponentDebugInfo('my-component');
console.log('Component debug info:', debugInfo);
```

#### Interactive Debugging Panel

```typescript
// Open debugging panel
debugTools.openDebugPanel();

// Customize debugging panel
debugTools.configureDebugPanel({
  theme: 'dark',
  position: 'bottom-right',
  size: 'large',
  features: ['performance', 'memory', 'components', 'network']
});
```

## 🎨 Interactive Demo

The `examples/comprehensive-features-demo.html` file provides a comprehensive interactive demo showcasing all advanced features:

### Demo Features

1. **State Management Demo**
   - Interactive counter with time-travel controls
   - State persistence demonstration
   - Analytics dashboard

2. **Component Composition Demo**
   - Dynamic component creation
   - Component inheritance demonstration
   - Mixins and HOCs showcase

3. **Collaboration Demo**
   - Real-time collaboration simulation
   - Multiple user interaction
   - Conflict resolution demonstration

4. **Debugging Demo**
   - Performance profiling
   - Memory leak detection
   - Interactive debugging panel

### Running the Demo

```bash
# Start a local server
cd yq-sanyi
python -m http.server 8000

# Open the demo in browser
open http://localhost:8000/examples/comprehensive-features-demo.html
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific feature tests
npm test -- --grep "Advanced State Management"
npm test -- --grep "Component Composition"
npm test -- --grep "Real-time Collaboration"
npm test -- --grep "Debugging Tools"

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

```typescript
// Test for advanced state management
describe('Advanced State Management', () => {
  it('should create global state with persistence', () => {
    const stateManager = new AdvancedStateManagement();
    const state = stateManager.createGlobalState({
      name: 'test-state',
      initialValue: { count: 0 },
      persistence: { enabled: true }
    });
    
    expect(state).toBeDefined();
    expect(state.state.count).toBe(0);
  });

  it('should support undo/redo operations', () => {
    const stateManager = new AdvancedStateManagement();
    const state = stateManager.createGlobalState({
      name: 'test-state',
      initialValue: { count: 0 },
      history: { enabled: true }
    });
    
    stateManager.dispatch('test-state', { type: 'INCREMENT' });
    expect(state.state.count).toBe(1);
    
    stateManager.undo('test-state');
    expect(state.state.count).toBe(0);
  });
});
```

## 📊 Performance Optimization

### Best Practices

1. **State Management**
   - Use derived states for computed values
   - Implement proper state subscription cleanup
   - Use middleware for state transformation

2. **Component Composition**
   - Keep mixins focused and single-purpose
   - Use component inheritance for shared behavior
   - Implement proper component lifecycle management

3. **Collaboration**
   - Implement proper connection handling
   - Use batching for collaborative operations
   - Implement conflict resolution strategies

4. **Debugging**
   - Use performance profiling sparingly
   - Implement proper memory cleanup
   - Use conditional debugging in production

### Performance Monitoring

```typescript
// Monitor application performance
debugTools.monitorPerformance({
  fps: true,
  memory: true,
  network: true,
  components: true
});

// Get performance insights
const insights = debugTools.getPerformanceInsights();
console.log('Performance insights:', insights);
```

## 🔧 Configuration

### Global Configuration

```typescript
// Configure advanced features globally
const config = {
  stateManagement: {
    persistence: {
      enabled: true,
      key: 'yq-sanyi-state',
      interval: 5000
    },
    history: {
      enabled: true,
      maxEntries: 100
    }
  },
  componentComposition: {
    inheritance: {
      enabled: true,
      depth: 5
    },
    mixins: {
      enabled: true,
      maxMixins: 10
    }
  },
  collaboration: {
    url: 'ws://localhost:8080',
    reconnect: true,
    maxRetries: 5
  },
  debugging: {
    enabled: process.env.NODE_ENV === 'development',
    performance: true,
    memory: true
  }
};

// Apply configuration
stateManager.configure(config.stateManagement);
componentComposer.configure(config.componentComposition);
collaboration.configure(config.collaboration);
debugTools.configure(config.debugging);
```

## 🚀 Deployment

### Building for Production

```bash
# Build the project
npm run build

# Minify and optimize
npm run build:prod

# Generate documentation
npm run docs
```

### Deployment Considerations

1. **State Persistence**: Disable in production if not needed
2. **Debugging Tools**: Disable in production
3. **Collaboration**: Use production WebSocket URL
4. **Performance**: Optimize bundle size

## 🤝 Contributing

### Development Setup

```bash
# Clone the repository
git clone https://github.com/YQteam-hq/yq-sanyi.git
cd yq-sanyi

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test
```

### Code Style

- Follow TypeScript best practices
- Use meaningful variable names
- Add comprehensive comments
- Write tests for new features

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Update documentation
6. Submit a pull request

## 📞 Support

### Getting Help

- Documentation: [ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md)
- Examples: [examples/comprehensive-features-demo.html](./examples/comprehensive-features-demo.html)
- Issues: [GitHub Issues](https://github.com/YQteam-hq/yq-sanyi/issues)

### Community

- Join our Discord server
- Participate in discussions
- Share your projects
- Contribute to the framework

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

This advanced features documentation provides comprehensive information about the enhanced capabilities of the yq-sanyi framework. For more information, please refer to the main [README](./README.md) file.