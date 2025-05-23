// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Provider, atom, createStore, useAtom, useAtomValue, useSetAtom, useStore } from 'jotai';
import { withAtomEffect } from 'jotai-effect';
import React, { useEffect } from 'react';
import StackTrace from 'stacktrace-js';
import {
  type Mock,
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AtomsLoggerOptions } from '../src/types/atoms-logger.js';
import { useAtomsLogger } from '../src/use-atoms-logger.js';

let mockDate: MockInstance;

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  vi.stubEnv('TZ', 'UTC');
  mockDate = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(() => '00:00:00');
  vi.spyOn(console, 'error').mockImplementation((error) => {
    // Ignore StackTrace error 'Error: TypeError [ERR_INVALID_PROTOCOL]: Protocol "c:" not supported. Expected "http:"'
    if (typeof error === 'string' && error.includes('ERR_INVALID_PROTOCOL')) {
      return;
    }

    // Use the actual console.error for other errors
    void vi.importActual('console').then((originalConsole) => {
      (originalConsole as unknown as typeof console).error(error);
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  mockDate.mockRestore();
});

describe('useAtomsLogger', () => {
  let consoleMock: {
    log: Mock;
    group: Mock;
    groupEnd: Mock;
    groupCollapsed: Mock;
  };
  let defaultOptions: AtomsLoggerOptions;

  beforeEach(() => {
    consoleMock = {
      log: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
      groupCollapsed: vi.fn(),
    };
    defaultOptions = {
      logger: consoleMock,
      groupLogs: false,
      formattedOutput: false,
      showTransactionElapsedTime: false,
      shouldShowPrivateAtoms: false,
      getStackTrace() {
        try {
          throw new Error('Stack trace');
        } catch (error) {
          return StackTrace.fromError(error as Error, { offline: true });
        }
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const countAtom = atom(0);
  countAtom.debugLabel = 'countAtom';

  const incrementAtom = atom(
    (get) => get(countAtom),
    (get, set) => {
      const count = get(countAtom);
      set(countAtom, count + 1);
    },
  );
  incrementAtom.debugLabel = 'incrementAtom';

  function AtomsLogger(options?: AtomsLoggerOptions) {
    useAtomsLogger({ ...defaultOptions, ...options });
    return null;
  }

  function renderWithLogger(children: React.ReactNode, options?: AtomsLoggerOptions) {
    const store = createStore();
    render(
      <Provider store={store}>
        <AtomsLogger {...options} />
        {children}
      </Provider>,
    );
  }

  it('should log stack traces when using useAtomValue', async () => {
    function MyCounter() {
      const count = useAtomValue(countAtom);
      return <div>count = {count}</div>;
    }

    renderWithLogger(<MyCounter />);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [stack-traces] MyCounter retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
      [`transaction 2 : subscribed to ${countAtom}`],
      [`mounted ${countAtom}`, { value: 0 }],
    ]);
  });

  it(
    'should log stack traces when using useSetAtom',
    {
      fails: true, // Not working in a React callback
    },
    async () => {
      function MyCounter() {
        const count = useAtomValue(countAtom);
        const increment = useSetAtom(incrementAtom);
        return (
          <button
            onClick={() => {
              increment();
            }}
          >
            Increment {count}
          </button>
        );
      }

      renderWithLogger(<MyCounter />);

      screen.getByRole('button', { name: 'Increment 0' }).click();

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [stack-traces] MyCounter retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],

        [`transaction 2 : [stack-traces] MyCounter subscribed to ${countAtom}`],
        [`mounted ${countAtom}`, { value: 0 }],

        [`transaction 3 : [stack-traces] MyCounter called set of ${incrementAtom}`],
        [`changed value of ${countAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],
      ]);
    },
  );

  it('should log stack traces when using useAtom', async () => {
    function MyCounter() {
      const [count] = useAtom(countAtom);
      return <div>count = {count}</div>;
    }

    renderWithLogger(<MyCounter />);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [stack-traces] MyCounter retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
      [`transaction 2 : subscribed to ${countAtom}`],
      [`mounted ${countAtom}`, { value: 0 }],
    ]);
  });

  it('should log stack traces when directly using store.get', async () => {
    function MyCounter() {
      const store = useStore();
      const count = store.get(countAtom);
      return <div>count = {count}</div>;
    }

    renderWithLogger(<MyCounter />);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [stack-traces] MyCounter retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it(
    'should log stack traces when directly using store.set',
    {
      fails: true, // Not working inside useEffect
    },
    async () => {
      function MyCounter() {
        const store = useStore();
        useEffect(() => {
          store.set(countAtom, (count) => count + 1);
        }, []);
        return <div>counter</div>;
      }

      renderWithLogger(<MyCounter />);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 :  [stack-traces] MyCounter set value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
        [`changed value of ${countAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],
      ]);
    },
  );

  it(
    'should log stack traces when using store.sub',
    {
      fails: true, // Not working inside useEffect
    },
    async () => {
      function MyCounter() {
        const store = useStore();
        useEffect(() => {
          const unsubscribe = store.sub(countAtom, vi.fn());
          return unsubscribe;
        }, []);
        return <div>counter</div>;
      }

      renderWithLogger(<MyCounter />);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 :  [stack-traces] MyCounter subscribed to ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
        [`mounted ${countAtom}`, { value: 0 }],
      ]);
    },
  );

  it('should log stack traces with hooks when using useAtomValue', async () => {
    function useMyCounter() {
      return useAtomValue(countAtom);
    }

    function MyCounter() {
      const count = useMyCounter();
      return <div>count = {count}</div>;
    }

    renderWithLogger(<MyCounter />);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [stack-traces] MyCounter.useMyCounter retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
      [`transaction 2 : subscribed to ${countAtom}`],
      [`mounted ${countAtom}`, { value: 0 }],
    ]);
  });

  it('should not log stack traces of libraries', async () => {
    const countWithEffect = withAtomEffect(countAtom, vi.fn());
    countWithEffect.debugLabel = 'countWithEffect';

    function MyCounter() {
      const count = useAtomValue(countWithEffect);
      return <div>count = {count}</div>;
    }

    renderWithLogger(<MyCounter />);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [stack-traces] MyCounter retrieved value of ${countWithEffect}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],

      [`transaction 2`], // Does not show [atomEffect] Object.effectAtom.unstable_onInit
      [
        `initialized value of ${countWithEffect} to 0`,
        { value: 0, dependencies: [`${countAtom}`] },
      ],

      [`transaction 3 : subscribed to ${countWithEffect}`],
      [`mounted ${countAtom}`, { value: 0 }],
      [`mounted ${countWithEffect}`, { dependencies: [`${countAtom}`], value: 0 }],
    ]);
  });
});
