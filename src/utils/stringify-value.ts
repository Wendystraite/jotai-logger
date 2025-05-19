/**
 * Converts a value of any type to a string representation
 *
 * Handles special cases like Promises, Errors, Symbols, and circular references.
 * The output can be truncated to a specified maximum length.
 *
 * @param value - The value value to convert to string
 * @param options - Configuration options
 * @param options.maxLength - Maximum length of the returned string. If the string is longer,
 *                            it will be truncated and appended with '…'. Use 0 for no limit.
 * @returns A string representation of the value value
 *
 * @example
 * // Returns "{"name":"John"}"
 * stringifyState({ name: 'John' }, { maxLength: 100 });
 *
 * @example
 * // Returns "[object Promise]"
 * stringifyState(Promise.resolve(), { maxLength: 100 });
 *
 * @example
 * // Returns "Error: Something went wrong"
 * stringifyState(new Error('Something went wrong'), { maxLength: 100 });
 */
export function stringifyValue(
  value: unknown,
  options: {
    stringify: ((this: void, value: unknown) => string) | undefined;
    stringifyLimit: number;
  },
): string {
  const { stringify, stringifyLimit } = options;
  let stateString: string | undefined;
  try {
    if (stringify) {
      stateString = stringify(value);
    } else {
      if (value instanceof Date) {
        stateString = value.toISOString();
      } else if (
        typeof value === 'object' &&
        value &&
        !Array.isArray(value) &&
        'toString' in value &&
        typeof value.toString === 'function'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        stateString = value.toString();
        if (stateString === '[object Object]') {
          stateString = undefined;
        }
      }
      stateString ??= JSON.stringify(value) as string | undefined; // can return undefined if value is not serializable
      stateString ??= String(value);
    }
    if (typeof stateString !== 'string') {
      throw new TypeError('stringified value is not a string');
    }
  } catch (error: unknown) {
    if (error instanceof TypeError && error.message.includes('circular')) {
      stateString = '[Circular]';
    } else {
      stateString = '[Unknown]';
    }
  }
  if (stringifyLimit > 0 && stateString.length > stringifyLimit) {
    stateString = stateString.slice(0, stringifyLimit) + '…';
  }
  return stateString;
}
