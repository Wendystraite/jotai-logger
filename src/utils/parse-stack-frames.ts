import type { AtomsLoggerStackTrace, StackFrame } from '../types/atoms-logger.js';

// eslint-disable-next-line complexity
export function parseStackFrames(stackFrames: StackFrame[]): AtomsLoggerStackTrace | undefined {
  // Retrieve the stack trace from the jotai store access entry point.
  // Find the last stack trace to prevent cases where there are multiple `useAtomValue` or `useSetAtom` calls in the stack trace.
  let useAtomStateStackTraceIndex: number | undefined;
  for (let i = stackFrames.length - 1; i >= 0; i--) {
    const trace = stackFrames[i];
    if (!trace?.functionName) {
      continue;
    }

    // Jotai React hooks entry points (note: `useAtom` is not included here since it uses `useAtomValue` and `useSetAtom` internally)
    if (/useAtomValue|useSetAtom/.exec(trace.functionName) !== null) {
      useAtomStateStackTraceIndex = i;
      break;
    }

    // Direct store access
    if (
      trace.fileName?.includes('jotai-logger') &&
      /onStoreGet|onStoreSet|onStoreSub/.exec(trace.functionName) !== null
    ) {
      useAtomStateStackTraceIndex = i;
      break;
    }
  }

  if (useAtomStateStackTraceIndex === undefined || useAtomStateStackTraceIndex < 0) {
    return { stackFrames };
  }

  let hooks: string[] | undefined;
  let component: string | undefined;
  let file: { path: string; name: string } | undefined;

  for (
    let stackTraceIndex = useAtomStateStackTraceIndex + 1;
    stackTraceIndex < stackFrames.length;
    stackTraceIndex++
  ) {
    const trace = stackFrames[stackTraceIndex];
    if (!trace?.functionName) {
      break;
    }

    // Ignore `useAtom` calls, as they are not relevant for the event.
    if (trace.functionName === 'useAtom') {
      continue;
    }

    // Ignore libraries calls
    if (trace.fileName?.includes('node_modules')) {
      continue;
    }

    // Store all hooks that are not `useAtomValue` or `useSetAtom` in the `hooks` array.
    if (trace.functionName.startsWith('use')) {
      (hooks ??= []).unshift(trace.functionName);
      continue;
    }

    // Finally store the component name and file path.
    component = trace.functionName;

    if (trace.fileName) {
      file = { path: trace.fileName, name: trace.fileName };

      const fileNameWithExtension = file.path.split(/[/\\]/).pop();
      const fileNameWithoutExtension = fileNameWithExtension?.split('.').shift();
      if (fileNameWithoutExtension) {
        file.name = fileNameWithoutExtension;
      }

      // If the file name is an index file, try to get the parent directory name.
      if (
        file.name &&
        stackTraceIndex + 1 < stackFrames.length &&
        stackFrames[stackTraceIndex + 1]?.fileName &&
        file.name === 'index'
      ) {
        const parentFilePath = stackFrames[stackTraceIndex + 1]?.fileName;
        const parentFileNameWithExtension = parentFilePath?.split(/[/\\]/).pop();
        const parentFilePathWithoutExtension = parentFileNameWithExtension?.split('.').shift();
        if (parentFilePathWithoutExtension) {
          file.name = `${parentFilePathWithoutExtension}/${file.name}`;
        }
      }
    }

    break;
  }

  if (!component) {
    return { stackFrames };
  }

  return { stackFrames, file, react: { hooks, component } };
}
