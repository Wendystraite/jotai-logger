import { getSync as getSyncStackTrace } from 'stacktrace-js';

export interface StackFrame {
  functionName?: string;
  fileName?: string;
}

/**
 * Information about the stack trace of the event that triggered the logger.
 * This information is used to identify the component and the hooks that triggered the event.
 */
export interface AtomsLoggerStackTrace {
  /**
   * Full path of the file where the event was triggered.
   * The file name is extracted from the stack trace.
   */
  filePath?: string;

  /**
   * Name of the file where the event was triggered.
   * The file name is extracted from the stack trace.
   * The file name is the last part of the path, without the extension.
   */
  fileName?: string;

  /**
   * Name of the hooks that triggered the event.
   * `useAtomValue`, `useSetAtom` and `useAtom` are ignored.
   */
  hooks?: string[];

  /**
   * Name of the React component that triggered the event.
   */
  componentName?: string;

  /**
   * Full stack trace of the current call stack.
   * Retrieved using stacktrace-js's {@link getSyncStackTrace}.
   */
  stackTrace: StackFrame[];
}

export function getAtomsLoggerStackTrace(
  getStackTrace: () => StackFrame[] = getSyncStackTrace,
): AtomsLoggerStackTrace | undefined {
  const stackTrace = getStackTrace();

  // Retrieve the index of the first occurrence of `useAtomValue` or `useSetAtom` in the stack trace.
  // This is the point where the event was triggered for either `store.get` or `store.set`.
  const useAtomStateStackTraceIndex = stackTrace.findIndex((trace) => {
    return trace.functionName === 'useAtomValue' || trace.functionName === 'useSetAtom';
  });

  if (useAtomStateStackTraceIndex === -1) {
    return { stackTrace };
  }

  let hooks: string[] | undefined;
  let componentName: string | undefined;
  let filePath: string | undefined;
  let fileName: string | undefined;

  for (
    let stackTraceIndex = useAtomStateStackTraceIndex + 1;
    stackTraceIndex < stackTrace.length;
    stackTraceIndex++
  ) {
    const trace = stackTrace[stackTraceIndex];
    if (!trace?.functionName) {
      break;
    }

    // Ignore `useAtom` calls, as they are not relevant for the event.
    if (trace.functionName === 'useAtom') {
      continue;
    }

    // Store all hooks that are not `useAtomValue` or `useSetAtom` in the `hooks` array.
    if (trace.functionName.startsWith('use')) {
      (hooks ??= []).unshift(trace.functionName);
      continue;
    }

    // Finally store the component name and file path.
    componentName = trace.functionName;

    if (trace.fileName) {
      filePath = trace.fileName;
      const fileNameWithExtension = filePath.split('/').pop();
      fileName = fileNameWithExtension?.split('.').shift();

      // If the file name is an index file, try to get the parent directory name.
      if (
        stackTraceIndex + 1 < stackTrace.length &&
        stackTrace[stackTraceIndex + 1]?.fileName &&
        fileName === 'index'
      ) {
        const parentFilePath = stackTrace[stackTraceIndex + 1]?.fileName;
        const parentFileNameWithExtension = parentFilePath?.split('/').pop();
        const parentFilePathWithoutExtension = parentFileNameWithExtension?.split('.').shift();
        if (parentFilePathWithoutExtension) {
          fileName = `${parentFilePathWithoutExtension}/${fileName}`;
        }
      }
    }

    break;
  }

  if (!componentName) {
    return { stackTrace };
  }

  return { stackTrace, filePath, fileName, hooks, componentName };
}
