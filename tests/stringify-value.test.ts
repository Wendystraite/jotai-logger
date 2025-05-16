import { describe, expect, it } from 'vitest';

import { stringifyValue } from '../src/utils/stringify-value.js';

describe('stringifyValue', () => {
  const defaultOptions = {
    stringifyLimit: 0,
    stringify: undefined,
  };

  it('should stringify primitive values', () => {
    expect(stringifyValue('test', defaultOptions)).toBe('"test"');
    expect(stringifyValue(42, defaultOptions)).toBe('42');
    expect(stringifyValue(true, defaultOptions)).toBe('true');
    expect(stringifyValue(null, defaultOptions)).toBe('null');
    expect(stringifyValue(undefined, defaultOptions)).toBe('undefined');
  });

  it('should stringify objects', () => {
    expect(stringifyValue({ name: 'John' }, defaultOptions)).toBe('{"name":"John"}');
  });

  it('should stringify arrays', () => {
    expect(stringifyValue([1, 2, 3], defaultOptions)).toBe('[1,2,3]');
  });

  it('should stringify arrays with nested objects', () => {
    expect(stringifyValue([{ name: 'John' }, { age: 30 }], defaultOptions)).toBe(
      '[{"name":"John"},{"age":30}]',
    );
  });

  it('should handle promises', () => {
    expect(stringifyValue(Promise.resolve(), defaultOptions)).toBe('[object Promise]');
  });

  it('should handle errors with message', () => {
    expect(stringifyValue(new Error('Something went wrong'), defaultOptions)).toBe(
      'Error: Something went wrong',
    );
  });

  it('should handle errors without message', () => {
    const error = new Error();
    error.message = '';
    expect(stringifyValue(error, defaultOptions)).toBe('Error');
  });

  it('should handle custom errors', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    expect(stringifyValue(new CustomError('Custom error'), defaultOptions)).toBe(
      'CustomError: Custom error',
    );
  });

  it('should handle symbols with description', () => {
    expect(stringifyValue(Symbol('test'), defaultOptions)).toBe('Symbol(test)');
  });

  it('should handle symbols without description', () => {
    expect(stringifyValue(Symbol(), defaultOptions)).toBe('Symbol()');
  });

  it('should handle circular references', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(stringifyValue(obj, defaultOptions)).toBe('[Circular]');
  });

  it('should handle non-serializable values', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const fn = () => {};
    expect(stringifyValue(fn, defaultOptions)).toBe('() => {\n    }');
  });

  it('should truncate output when maxLength is specified', () => {
    expect(stringifyValue('1234567890', { ...defaultOptions, stringifyLimit: 5 })).toBe('"1234…');
    expect(
      stringifyValue({ long: 'very long text here' }, { ...defaultOptions, stringifyLimit: 10 }),
    ).toBe('{"long":"v…');
  });

  it('should not truncate when maxLength is 0', () => {
    const longString = 'a'.repeat(1000);
    expect(stringifyValue(longString, defaultOptions)).toBe('"' + longString + '"');
  });

  it('should handle Map objects', () => {
    const map = new Map();
    map.set('key1', 'value1');
    map.set('key2', 'value2');
    expect(stringifyValue(map, defaultOptions)).toBe('[object Map]');
  });

  it('should handle WeakMap objects', () => {
    const weakMap = new WeakMap();
    const obj = {};
    weakMap.set(obj, 'value');
    expect(stringifyValue(weakMap, defaultOptions)).toBe('[object WeakMap]');
  });

  it('should handle Set objects', () => {
    const set = new Set(['value1', 'value2']);
    expect(stringifyValue(set, defaultOptions)).toBe('[object Set]');
  });

  it('should handle WeakSet objects', () => {
    const weakSet = new WeakSet();
    const obj = {};
    weakSet.add(obj);
    expect(stringifyValue(weakSet, defaultOptions)).toBe('[object WeakSet]');
  });

  it('should handle Date objects', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    expect(stringifyValue(date, defaultOptions)).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should handle RegExp objects', () => {
    expect(stringifyValue(/test/g, defaultOptions)).toBe('/test/g');
  });

  it('should handle URL objects', () => {
    const url = new URL('https://example.com');
    expect(stringifyValue(url, defaultOptions)).toBe('https://example.com/');
  });

  it('should handle URLSearchParams', () => {
    const params = new URLSearchParams('q=test&page=1');
    expect(stringifyValue(params, defaultOptions)).toBe('q=test&page=1');
  });

  it('should handle DOM-related objects', () => {
    const event = new Event('test');
    expect(stringifyValue(event, defaultOptions)).toContain('[object Event]');
    expect(stringifyValue(new CustomEvent('custom'), defaultOptions)).toBe('[object CustomEvent]');
  });

  it('should handle classes values', () => {
    class TestClass {
      constructor(public name: string) {}
    }
    const instance = new TestClass('Test');
    expect(stringifyValue(instance, defaultOptions)).toBe('{"name":"Test"}');
  });

  it('should not handle complex objects containing multiple classes', () => {
    expect(
      stringifyValue(
        {
          url: new URL('https://example.com'),
          date: new Date('2023-01-01T00:00:00Z'),
          map: new Map([['key', 'value']]),
          set: new Set(['value1', 'value2']),
          weakMap: new WeakMap([[{}, 'value']]),
          weakSet: new WeakSet([{}]),
          error: new Error('An error occurred'),
        },
        defaultOptions,
      ),
    ).toBe(
      '{"url":"https://example.com/","date":"2023-01-01T00:00:00.000Z","map":{},"set":{},"weakMap":{},"weakSet":{},"error":{}}',
    );
  });

  it('should return [Unknown] for unknown types', () => {
    expect(stringifyValue(BigInt(0), defaultOptions)).toBe('[Unknown]');
  });
});
