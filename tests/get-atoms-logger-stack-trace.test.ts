import { describe, expect, it } from 'vitest';

import {
  type StackFrame,
  getAtomsLoggerStackTrace,
} from '../src/utils/get-atoms-logger-stack-trace.js';

describe('getAtomsLoggerStackTrace', () => {
  it('should return stackTrace when no atom hooks are found', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'someFunction', fileName: 'somefile.ts' },
    ];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);

    expect(result).toEqual({
      stackTrace: mockStackTrace,
    });
  });

  it('should identify useAtomValue in stack trace', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'useCustomHook', fileName: 'hooks/custom.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);

    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: '/src/components/TestComponent.tsx',
      fileName: 'TestComponent',
      hooks: ['useCustomHook'],
      componentName: 'Component',
    });
  });

  it('should identify useSetAtom in stack trace', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useSetAtom', fileName: 'atoms.ts' },
      { functionName: 'useCustomHook', fileName: 'hooks/custom.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);

    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: '/src/components/TestComponent.tsx',
      fileName: 'TestComponent',
      hooks: ['useCustomHook'],
      componentName: 'Component',
    });
  });

  it('should ignore useAtom calls in stack trace', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'useAtom', fileName: 'atoms.ts' },
      { functionName: 'useCustomHook', fileName: 'hooks/custom.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);

    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: '/src/components/TestComponent.tsx',
      fileName: 'TestComponent',
      hooks: ['useCustomHook'],
      componentName: 'Component',
    });
  });

  it('should handle index files by including parent directory', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'Component', fileName: '/src/components/Button/index.tsx' },
      { functionName: 'ParentComponent', fileName: '/src/components/Button.tsx' },
    ];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);

    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: '/src/components/Button/index.tsx',
      fileName: 'Button/index',
      componentName: 'Component',
    });
  });

  it('should handle multiple hooks in stack trace', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useSetAtom', fileName: 'atoms.ts' },
      { functionName: 'useSecondHook', fileName: 'hooks/second.ts' },
      { functionName: 'useFirstHook', fileName: 'hooks/first.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);

    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: '/src/components/TestComponent.tsx',
      fileName: 'TestComponent',
      hooks: ['useFirstHook', 'useSecondHook'],
      componentName: 'Component',
    });
  });

  it('should not include hooks if none are found after useSetAtom', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useSetAtom', fileName: 'atoms.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: '/src/components/TestComponent.tsx',
      fileName: 'TestComponent',
      componentName: 'Component',
    });
  });

  it('should not include hooks if none are found after useAtomValue', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: '/src/components/TestComponent.tsx',
      fileName: 'TestComponent',
      componentName: 'Component',
    });
  });

  it('should not include hooks if none are found after useAtom', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtom', fileName: 'atoms.ts' },
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'Component', fileName: '/src/components/TestComponent.tsx' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: '/src/components/TestComponent.tsx',
      fileName: 'TestComponent',
      componentName: 'Component',
    });
  });

  it('should handle empty stack trace', () => {
    const mockStackTrace: StackFrame[] = [];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
    });
  });

  it('should ignore non-hook functions', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'someFunction', fileName: 'somefile.ts' },
      { functionName: 'anotherFunction', fileName: 'anotherfile.ts' },
    ];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);

    expect(result).toEqual({
      stackTrace: mockStackTrace,
    });
  });

  it('should ignore functions before useAtomValue or useSetAtom', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'someFunction', fileName: 'someFile.ts' },
      { functionName: 'someOtherFunction', fileName: 'someOtherFile.ts' },
      { functionName: 'useSomething', fileName: 'someOtherFile.ts' },
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'MyComponent', fileName: 'myComponent.ts' },
    ];

    const result = getAtomsLoggerStackTrace(() => mockStackTrace);

    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: 'myComponent.ts',
      fileName: 'myComponent',
      componentName: 'MyComponent',
    });
  });

  it('should ignore functions after the Component', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'MyComponent', fileName: 'myComponent.ts' },
      { functionName: 'someFunction', fileName: 'someFile.ts' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
      filePath: 'myComponent.ts',
      fileName: 'myComponent',
      componentName: 'MyComponent',
    });
  });

  it('should ignore stack traces with no function names', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: '', fileName: 'atoms.ts' },
      { functionName: '', fileName: 'myComponent.ts' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
    });
  });

  it('should handle stack traces with no file names', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: '' },
      { functionName: 'MyComponent', fileName: '' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      componentName: 'MyComponent',
      stackTrace: mockStackTrace,
    });
  });

  it('should ignore hooks without components', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: '', fileName: 'myComponent.ts' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
    });
  });

  it('should ignore custom hooks without components', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: 'useCustomHook', fileName: 'hooks/custom.ts' },
      { functionName: '', fileName: 'myComponent.ts' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
    });
  });

  it('should ignore stack traces with no function names after useAtomValue', () => {
    const mockStackTrace: StackFrame[] = [
      { functionName: 'useAtomValue', fileName: 'atoms.ts' },
      { functionName: '', fileName: 'myComponent.ts' },
      { functionName: 'OtherComponent', fileName: 'anotherComponent.ts' },
    ];
    const result = getAtomsLoggerStackTrace(() => mockStackTrace);
    expect(result).toEqual({
      stackTrace: mockStackTrace,
    });
  });
});
