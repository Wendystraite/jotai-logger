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
 * // Returns "[Promise]"
 * stringifyState(Promise.resolve(), { maxLength: 100 });
 *
 * @example
 * // Returns "[Error: Something went wrong]"
 * stringifyState(new Error('Something went wrong'), { maxLength: 100 });
 */
export function stringifyValue(value: unknown, options: { maxLength: number }): string {
  const { maxLength } = options;
  let stateString: string | undefined;
  try {
    if (value instanceof Promise) {
      stateString = '[Promise]';
    } else if (value instanceof Error) {
      const errorName = value.name.includes('Error') ? value.name : 'Error';
      if (value.message) {
        stateString = `[${errorName}: ${value.message}]`;
      } else {
        stateString = `[${errorName}]`;
      }
    } else if (value instanceof Symbol) {
      if (value.description) {
        stateString = `Symbol(${value.description})`;
      } else {
        stateString = 'Symbol()';
      }
    } else {
      stateString = JSON.stringify(value) as string | undefined; // can return undefined if value is not serializable
      stateString ??= String(value);
    }
  } catch (error: unknown) {
    if (error instanceof TypeError && error.message.includes('circular')) {
      stateString = '[Circular]';
    } else {
      stateString = '[Unknown]';
    }
  }
  if (maxLength > 0 && stateString.length > maxLength) {
    stateString = stateString.slice(0, maxLength) + '…';
  }
  return stateString;
}
