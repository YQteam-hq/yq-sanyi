# Pull Request: Enhanced Error Handling, Performance Monitoring & New Directives

## Summary

This PR introduces significant enhancements to the yq-sanyi framework, focusing on three key areas:

1. **Enhanced Error Handling** with better error messages and debugging support
2. **Performance Monitoring** with built-in metrics tracking  
3. **New Directives** for debounce and throttle functionality

## Changes Made

### 1. Enhanced Error Handling (`packages/core/src/enhanced-utils.ts`)

- **EnhancedErrorHandler Class**: Provides detailed error information with suggestions
- **Error Message Enhancement**: Adds component context and template location to error messages
- **Error Code System**: Categorizes errors with specific error codes for better debugging
- **Performance Metrics**: Built-in performance tracking for reactive updates

### 2. Performance Monitoring

- **Real-time Metrics**: Tracks update count, average/slowest update times
- **Derivation & Effect Tracking**: Monitors derived states and effects execution
- **Performance Decorator**: `@measurePerformance` decorator for custom performance tracking
- **Metrics Reset**: Ability to reset metrics for testing and monitoring

### 3. New Directives: Debounce & Throttle

- **Debounce Directive**: `yq-on:click="handler debounce:500"` - Delays execution
- **Throttle Directive**: `yq-on:click="handler throttle:1000"` - Limits execution rate
- **Flexible Syntax**: Supports any event type with debounce/throttle modifiers
- **Automatic Cleanup**: Proper cleanup of timeout resources

### 4. Template Validation (`ValidationUtils`)

- **Real-time Validation**: Validates template syntax during parsing
- **Error Detection**: Detects unclosed expressions, empty expressions, unbalanced tags
- **Component Name Validation**: Validates custom element names
- **Directive Validation**: Validates directive syntax and usage

### 5. Comprehensive Demo (`examples/enhanced-demo.html`)

- **Interactive Examples**: Live demonstration of all new features
- **Performance Metrics Display**: Real-time performance monitoring
- **Error Handling Demo**: Shows enhanced error messages
- **Template Validation**: Live template validation with feedback

## Technical Details

### New Event Syntax

```html
<!-- Debounce event handler -->
<input 
  yq-on:input="searchInput debounce:300"
  placeholder="Search..."
>

<!-- Throttle event handler -->
<button 
  yq-on:click="saveData throttle:1000"
>
  Save Data
</button>

<!-- Combined with existing features -->
<input 
  yq-on:input="handleInput debounce:500 throttle:100"
  yq-model="searchQuery"
>
```

### Performance Monitoring

```javascript
import { EnhancedErrorHandler } from 'yq-sanyi'

// Get current performance metrics
const metrics = EnhancedErrorHandler.getPerformanceMetrics()
console.log('Update count:', metrics.updateCount)
console.log('Average update time:', metrics.averageUpdateTime, 'ms')

// Reset metrics
EnhancedErrorHandler.resetMetrics()
```

### Template Validation

```javascript
import { ValidationUtils } from 'yq-sanyi'

const validation = ValidationUtils.validateTemplate(template)
if (!validation.valid) {
  console.log('Template errors:', validation.errors)
}
```

## Benefits

### For Developers

1. **Better Debugging**: Enhanced error messages with context and suggestions
2. **Performance Insights**: Real-time performance monitoring
3. **Improved Developer Experience**: Template validation and better error handling
4. **New Directives**: Built-in debounce and throttle for better performance

### For Applications

1. **Performance Optimization**: Built-in performance monitoring helps identify bottlenecks
2. **Stability**: Better error handling prevents crashes and improves user experience
3. **Code Quality**: Template validation catches errors early
4. **User Experience**: Debounce and throttle improve interaction responsiveness

## Testing

- **Unit Tests**: Comprehensive test suite for all new features
- **Integration Tests**: Tests for integration with existing functionality
- **Demo Application**: Live demonstration of all features
- **TypeScript Validation**: Full type safety and validation

## Backward Compatibility

All changes are fully backward compatible:
- No breaking changes to existing APIs
- New features are opt-in
- Existing functionality remains unchanged

## Performance Impact

- **Minimal Overhead**: Performance monitoring has minimal impact on runtime performance
- **Optional Features**: All new features are opt-in
- **Efficient Implementation**: Uses efficient algorithms and data structures

## Files Modified

- `packages/core/src/enhanced-utils.ts` - New utilities and enhancements
- `packages/core/src/index.ts` - Updated exports and initialization
- `packages/core/src/renderer.ts` - Enhanced event handling with debounce/throttle
- `examples/enhanced-demo.html` - Comprehensive demo application
- `packages/core/test/enhanced-utils.test.mjs` - Test suite

## Breaking Changes

None - All changes are backward compatible.

## How to Test

1. Open `examples/enhanced-demo.html` in a browser
2. Test the debounce and throttle functionality
3. Monitor performance metrics in real-time
4. Try template validation features
5. Run the test suite with `npm test`

## Future Enhancements

The foundation laid by this PR enables future enhancements such as:
- Advanced performance profiling
- Custom error boundary components
- More validation rules
- Additional utility directives

## Conclusion

This PR significantly enhances the yq-sanyi framework with better error handling, performance monitoring, and new utility directives. These improvements make the framework more developer-friendly, performant, and robust while maintaining full backward compatibility.