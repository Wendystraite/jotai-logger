/**
 * Parse a trace from [captureOwnerStack](https://react.dev/reference/react/captureOwnerStack) (React 19.1+) or any other source.
 *
 * Example of a trace from `captureOwnerStack` that would return `['MiddleWrapper', 'ParentContainer', 'App']`:
 * ```
 *    at MiddleWrapper (http://localhost:5173/src/App.tsx?t=1757750948197:70:21)
 *    at ParentContainer (http://localhost:5173/src/App.tsx?t=1757750948197:31:21)
 *    at App (http://localhost:5173/src/App.tsx?t=1757750948197:108:21)
 * ```
 *
 * @returns the components names in the same order or `undefined` if the stack is empty or not provided.
 */
export function parseOwnerStack(
  stack: string | null | undefined,
  ownerStackLimit: number,
): string[] | undefined {
  if (!stack || ownerStackLimit === 0) return undefined;
  let components = stack
    .split('\n')
    .map((line) => /^\s*at\s+([^\s]+)\s+/.exec(line)?.[1])
    .filter((c) => typeof c === 'string');
  if (ownerStackLimit !== Infinity && ownerStackLimit > 0) {
    components = components.slice(0, ownerStackLimit);
  }
  return components.length > 0 ? components : undefined;
}
