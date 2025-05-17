import { describe, expect, it } from 'vitest';

import type { StackFrame } from '../src/types/atoms-logger.js';
import { parseStackFrames } from '../src/utils/parse-stack-frames.js';

describe('parseStackFrames', () => {
  it('should return stackTrace when no atom hooks are found', () => {
    const stackFrames: StackFrame[] = [{ functionName: 'someFunction', fileName: 'somefile.ts' }];

    const result = parseStackFrames(stackFrames);

    expect(result).toEqual({
      stackFrames,
    });
  });

  it('should identify useAtomValue in stack trace', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'useCustomHook', fileName: 'hooks/custom.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];

    const result = parseStackFrames(stackFrames);

    expect(result).toEqual({
      stackFrames,
      file: {
        path: '/src/components/TestComponent.tsx',
        name: 'TestComponent',
      },
      react: {
        hooks: ['useCustomHook'],
        component: 'Component',
      },
    });
  });

  it('should identify useSetAtom in stack trace', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useSetAtom', fileName: 'atoms.ts' },
      { functionName: 'useCustomHook', fileName: 'hooks/custom.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];

    const result = parseStackFrames(stackFrames);

    expect(result).toEqual({
      stackFrames,
      file: {
        path: '/src/components/TestComponent.tsx',
        name: 'TestComponent',
      },
      react: {
        hooks: ['useCustomHook'],
        component: 'Component',
      },
    });
  });

  it('should ignore useAtom calls in stack trace', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'useAtom', fileName: 'atoms.ts' },
      { functionName: 'useCustomHook', fileName: 'hooks/custom.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];

    const result = parseStackFrames(stackFrames);

    expect(result).toEqual({
      stackFrames,
      file: {
        path: '/src/components/TestComponent.tsx',
        name: 'TestComponent',
      },
      react: {
        hooks: ['useCustomHook'],
        component: 'Component',
      },
    });
  });

  it('should handle index files by including parent directory', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'Component', fileName: '/src/components/Button/index.tsx' },
      { functionName: 'ParentComponent', fileName: '/src/components/Button.tsx' },
    ];

    const result = parseStackFrames(stackFrames);

    expect(result).toEqual({
      stackFrames,
      file: {
        path: '/src/components/Button/index.tsx',
        name: 'Button/index',
      },
      react: {
        component: 'Component',
      },
    });
  });

  it('should handle multiple hooks in stack trace', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useSetAtom', fileName: 'atoms.ts' },
      { functionName: 'useSecondHook', fileName: 'hooks/second.ts' },
      { functionName: 'useFirstHook', fileName: 'hooks/first.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];

    const result = parseStackFrames(stackFrames);

    expect(result).toEqual({
      stackFrames,
      file: {
        path: '/src/components/TestComponent.tsx',
        name: 'TestComponent',
      },
      react: {
        hooks: ['useFirstHook', 'useSecondHook'],
        component: 'Component',
      },
    });
  });

  it('should not include hooks if none are found after useSetAtom', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useSetAtom', fileName: 'atoms.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
      file: {
        path: '/src/components/TestComponent.tsx',
        name: 'TestComponent',
      },
      react: {
        component: 'Component',
      },
    });
  });

  it('should not include hooks if none are found after useAtomValue', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
      file: {
        path: '/src/components/TestComponent.tsx',
        name: 'TestComponent',
      },
      react: {
        component: 'Component',
      },
    });
  });

  it('should not include hooks if none are found after useAtom', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtom', fileName: 'atoms.ts' },
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
      file: {
        path: '/src/components/TestComponent.tsx',
        name: 'TestComponent',
      },
      react: {
        component: 'Component',
      },
    });
  });

  it('should handle empty stack trace', () => {
    const stackFrames: StackFrame[] = [];

    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
    });
  });

  it('should ignore non-hook functions', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'someFunction', fileName: 'somefile.ts' },
      { functionName: 'anotherFunction', fileName: 'anotherfile.ts' },
    ];

    const result = parseStackFrames(stackFrames);

    expect(result).toEqual({
      stackFrames,
    });
  });

  it('should ignore functions before useAtomValue or useSetAtom', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'someFunction', fileName: 'someFile.ts' },
      { functionName: 'someOtherFunction', fileName: 'someOtherFile.ts' },
      { functionName: 'useSomething', fileName: 'someOtherFile.ts' },
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'MyComponent', fileName: 'myComponent.ts' },
    ];

    const result = parseStackFrames(stackFrames);

    expect(result).toEqual({
      stackFrames,
      file: {
        path: 'myComponent.ts',
        name: 'myComponent',
      },
      react: {
        component: 'MyComponent',
      },
    });
  });

  it('should ignore functions after the Component', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'MyComponent', fileName: 'myComponent.ts' },
      { functionName: 'someFunction', fileName: 'someFile.ts' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
      file: {
        path: 'myComponent.ts',
        name: 'myComponent',
      },
      react: {
        component: 'MyComponent',
      },
    });
  });

  it('should ignore stack traces with no function names', () => {
    const stackFrames: StackFrame[] = [
      { functionName: '', fileName: 'atoms.ts' },
      { functionName: '', fileName: 'myComponent.ts' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
    });
  });

  it('should handle stack traces with no file names', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: '' },
      { functionName: 'MyComponent', fileName: '' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      react: {
        component: 'MyComponent',
      },
      stackFrames,
    });
  });

  it('should ignore hooks without components', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: '', fileName: 'myComponent.ts' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
    });
  });

  it('should ignore custom hooks without components', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'useCustomHook', fileName: 'hooks/custom.ts' },
      { functionName: '', fileName: 'myComponent.ts' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
    });
  });

  it('should ignore stack traces with no function names after useAtomValue', () => {
    const stackFrames: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: '', fileName: 'myComponent.ts' },
      { functionName: 'OtherComponent', fileName: 'anotherComponent.ts' },
    ];
    const result = parseStackFrames(stackFrames);
    expect(result).toEqual({
      stackFrames,
    });
  });
});
