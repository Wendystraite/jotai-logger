import { describe, expect, it } from 'vitest';

import { stringifyValue } from '../src/utils/stringify-value.js';

describe('stringifyValue', () => {
  it('should stringify primitive values', () => {
    expect(stringifyValue('test', { maxLength: 0 })).toBe('"test"');
    expect(stringifyValue(42, { maxLength: 0 })).toBe('42');
    expect(stringifyValue(true, { maxLength: 0 })).toBe('true');
    expect(stringifyValue(null, { maxLength: 0 })).toBe('null');
    expect(stringifyValue(undefined, { maxLength: 0 })).toBe('undefined');
  });

  it('should stringify objects', () => {
    expect(stringifyValue({ name: 'John' }, { maxLength: 0 })).toBe('{"name":"John"}');
  });

  it('should stringify arrays', () => {
    expect(stringifyValue([1, 2, 3], { maxLength: 0 })).toBe('[1,2,3]');
  });

  it('should handle promises', () => {
    expect(stringifyValue(Promise.resolve(), { maxLength: 0 })).toBe('[Promise]');
  });

  it('should handle errors with message', () => {
    expect(stringifyValue(new Error('Something went wrong'), { maxLength: 0 })).toBe(
      '[Error: Something went wrong]',
    );
  });

  it('should handle errors without message', () => {
    const error = new Error();
    error.message = '';
    expect(stringifyValue(error, { maxLength: 0 })).toBe('[Error]');
  });

  it('should handle custom errors', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    expect(stringifyValue(new CustomError('Custom error'), { maxLength: 0 })).toBe(
      '[CustomError: Custom error]',
    );
  });

  it('should handle symbols with description', () => {
    expect(stringifyValue(Symbol('test'), { maxLength: 0 })).toBe('Symbol(test)');
  });

  it('should handle symbols without description', () => {
    expect(stringifyValue(Symbol(), { maxLength: 0 })).toBe('Symbol()');
  });

  it('should handle circular references', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(stringifyValue(obj, { maxLength: 0 })).toBe('[Circular]');
  });

  it('should handle non-serializable values', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const fn = () => {};
    expect(stringifyValue(fn, { maxLength: 0 })).toBe('() => {\n    }');
  });

  it('should truncate output when maxLength is specified', () => {
    expect(stringifyValue('1234567890', { maxLength: 5 })).toBe('"1234…');
    expect(stringifyValue({ long: 'very long text here' }, { maxLength: 10 })).toBe('{"long":"v…');
  });

  it('should not truncate when maxLength is 0', () => {
    const longString = 'a'.repeat(1000);
    expect(stringifyValue(longString, { maxLength: 0 })).toBe('"' + longString + '"');
  });
});
