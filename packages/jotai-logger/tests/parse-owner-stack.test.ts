import { describe, it, expect } from 'vitest';

import { parseOwnerStack } from '../src/utils/parse-owner-stack.js';

describe('parseOwnerStack', () => {
  it('should return undefined for null input', () => {
    expect(parseOwnerStack(null, Infinity)).toBeUndefined();
  });

  it('should return undefined for undefined input', () => {
    expect(parseOwnerStack(undefined, Infinity)).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(parseOwnerStack('', Infinity)).toBeUndefined();
  });

  it('should parse valid React captureOwnerStack trace', () => {
    const stack = `    at MiddleWrapper (http://localhost:5173/src/App.tsx?t=1757750948197:70:21)
    at ParentContainer (http://localhost:5173/src/App.tsx?t=1757750948197:31:21)
    at App (http://localhost:5173/src/App.tsx?t=1757750948197:108:21)`;

    expect(parseOwnerStack(stack, Infinity)).toEqual(['MiddleWrapper', 'ParentContainer', 'App']);
  });

  it('should handle single component in stack', () => {
    const stack = '    at MyComponent (http://localhost:3000/src/Component.tsx:15:10)';
    expect(parseOwnerStack(stack, Infinity)).toEqual(['MyComponent']);
  });

  it('should filter out invalid lines', () => {
    const stack = `    at ValidComponent (http://localhost:5173/src/App.tsx:70:21)
invalid line without proper format
        at AnotherComponent (http://localhost:5173/src/App.tsx:31:21)`;

    expect(parseOwnerStack(stack, Infinity)).toEqual(['ValidComponent', 'AnotherComponent']);
  });

  it('should return undefined when no valid components found', () => {
    const stack = `invalid line 1
another invalid line
not a proper stack trace`;

    expect(parseOwnerStack(stack, Infinity)).toBeUndefined();
  });

  it('should handle different whitespace patterns', () => {
    const stack = `at Component1 (file.js:1:1)
    at Component2 (file.js:2:2)
            at Component3 (file.js:3:3)`;

    expect(parseOwnerStack(stack, Infinity)).toEqual(['Component1', 'Component2', 'Component3']);
  });

  it('should handle components with special characters in names', () => {
    const stack = `    at Component$WithDollar (file.js:1:1)
        at Component_WithUnderscore (file.js:2:2)
        at Component123 (file.js:3:3)`;

    expect(parseOwnerStack(stack, Infinity)).toEqual([
      'Component$WithDollar',
      'Component_WithUnderscore',
      'Component123',
    ]);
  });

  it('should return undefined when ownerStackLimit is 0', () => {
    const stack = `    at Component1 (file.js:1:1)
      at Component2 (file.js:2:2)
      at Component3 (file.js:3:3)`;

    expect(parseOwnerStack(stack, 0)).toBeUndefined();
  });

  it('should limit components when ownerStackLimit is 1', () => {
    const stack = `    at Component1 (file.js:1:1)
      at Component2 (file.js:2:2)
      at Component3 (file.js:3:3)`;

    expect(parseOwnerStack(stack, 1)).toEqual(['Component1']);
  });

  it('should limit components when ownerStackLimit is 2', () => {
    const stack = `    at Component1 (file.js:1:1)
      at Component2 (file.js:2:2)
      at Component3 (file.js:3:3)`;

    expect(parseOwnerStack(stack, 2)).toEqual(['Component1', 'Component2']);
  });

  it('should return all components when ownerStackLimit is greater than available components', () => {
    const stack = `    at Component1 (file.js:1:1)
      at Component2 (file.js:2:2)`;

    expect(parseOwnerStack(stack, 5)).toEqual(['Component1', 'Component2']);
  });

  it('should handle negative ownerStackLimit by returning all components', () => {
    const stack = `    at Component1 (file.js:1:1)
      at Component2 (file.js:2:2)
      at Component3 (file.js:3:3)`;

    expect(parseOwnerStack(stack, -1)).toEqual(['Component1', 'Component2', 'Component3']);
  });

  it('should apply limit after filtering invalid lines', () => {
    const stack = `invalid line
      at Component1 (file.js:1:1)
  another invalid line
      at Component2 (file.js:2:2)
      at Component3 (file.js:3:3)`;

    expect(parseOwnerStack(stack, 2)).toEqual(['Component1', 'Component2']);
  });
});
