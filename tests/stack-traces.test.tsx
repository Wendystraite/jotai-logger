// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Provider, atom, createStore, useAtom, useAtomValue, useSetAtom, useStore } from 'jotai';
import React, { captureOwnerStack, useEffect } from 'react';
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
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  mockDate.mockRestore();
});

function getReact19ComponentDisplayName(): string | undefined {
  const React19 = React as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
      A?: { getOwner?: () => { type?: { displayName?: string; name?: string } } };
    };
    __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
      A?: { getOwner?: () => { type?: { displayName?: string; name?: string } } };
    };
  };
  const component = (
    React19.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ??
    React19.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  )?.A?.getOwner?.().type;
  return component?.displayName ?? component?.name;
}

describe('stack traces', () => {
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
      getOwnerStack: captureOwnerStack,
      getComponentDisplayName: getReact19ComponentDisplayName,
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

  describe('useAtomValue', () => {
    it('should log owner stack without component display name if its the root component', async () => {
      function MyCounter() {
        const count = useAtomValue(countAtom);
        return <div>count = {count}</div>;
      }

      renderWithLogger(<MyCounter />);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [MyCounter] retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
        [`transaction 2 : [MyCounter] subscribed to ${countAtom}`],
        [`mounted ${countAtom}`, { value: 0 }],
      ]);
    });

    it('should log owner stack with component display name', async () => {
      function MyApp() {
        return <MyCounterParent />;
      }

      function MyCounterParent() {
        return <MyCounter />;
      }

      function MyCounter() {
        const count = useAtomValue(countAtom);
        return <div>count = {count}</div>;
      }

      renderWithLogger(<MyApp />);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [MyApp.MyCounterParent] MyCounter retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],

        // React 19's getOwner doesn't work in `useEffect`
        [`transaction 2 : [MyApp.MyCounterParent] subscribed to ${countAtom}`],
        [`mounted ${countAtom}`, { value: 0 }],
      ]);
    });

    it('should log a maximum of 2 components in the owner stack', async () => {
      function ComponentLevel4() {
        const count = useAtomValue(countAtom);
        return <div>count = {count}</div>;
      }
      function ComponentLevel3() {
        return <ComponentLevel4 />;
      }
      function ComponentLevel2() {
        return <ComponentLevel3 />;
      }
      function ComponentLevel1() {
        return <ComponentLevel2 />;
      }
      function MyApp() {
        return <ComponentLevel1 />;
      }

      renderWithLogger(<MyApp />);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [
          // Does not log MyApp and ComponentLevel1
          `transaction 1 : [ComponentLevel2.ComponentLevel3] ComponentLevel4 retrieved value of ${countAtom}`,
        ],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],

        // React 19's getOwner doesn't work in `useEffect`
        [`transaction 2 : [ComponentLevel2.ComponentLevel3] subscribed to ${countAtom}`],
        [`mounted ${countAtom}`, { value: 0 }],
      ]);
    });

    it('should not log custom hooks', async () => {
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
        [`transaction 1 : [MyCounter] retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
        [`transaction 2 : [MyCounter] subscribed to ${countAtom}`],
        [`mounted ${countAtom}`, { value: 0 }],
      ]);
    });
  });

  describe('useSetAtom', () => {
    it('should log owner stack with component display name', async () => {
      function MyApp() {
        return <MyCounterParent />;
      }

      function MyCounterParent() {
        return <MyCounter />;
      }

      function MyCounter() {
        const increment = useSetAtom(incrementAtom);
        return (
          <button
            onClick={() => {
              increment();
            }}
          >
            Increment
          </button>
        );
      }

      renderWithLogger(<MyApp />);

      screen.getByRole('button', { name: 'Increment' }).click();

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        // React 19's getOwner doesn't work in callbacks
        [`transaction 1 : [MyCounter.button] called set of ${incrementAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
        [`changed value of ${countAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],
      ]);
    });
  });

  describe('useAtom', () => {
    it('should log owner stack with component display name', async () => {
      function MyApp() {
        return <MyCounterParent />;
      }

      function MyCounterParent() {
        return <MyCounter />;
      }

      function MyCounter() {
        const [count, setCount] = useAtom(countAtom);
        return (
          <button
            onClick={() => {
              setCount((c) => c + 1);
            }}
          >
            Increment {count}
          </button>
        );
      }

      renderWithLogger(<MyApp />);

      screen.getByRole('button', { name: 'Increment 0' }).click();

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [MyApp.MyCounterParent] MyCounter retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],

        // React 19's getOwner doesn't work in `useEffect`
        [`transaction 2 : [MyApp.MyCounterParent] subscribed to ${countAtom}`],
        [`mounted ${countAtom}`, { value: 0 }],

        // React 19's getOwner doesn't work in callbacks
        [`transaction 3 : [MyCounter.button] set value of ${countAtom}`],
        [`changed value of ${countAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],
      ]);
    });
  });

  describe('direct store access', () => {
    it('should log owner stack with component display name', async () => {
      function MyApp() {
        return <MyCounterParent />;
      }

      function MyCounterParent() {
        return <MyCounter />;
      }

      function MyCounter() {
        const store = useStore();
        const count = store.get(countAtom);
        useEffect(() => {
          const unsubscribe = store.sub(countAtom, vi.fn());
          return unsubscribe;
        }, []);
        return (
          <button
            onClick={() => {
              store.set(countAtom, (c) => c + 1);
            }}
          >
            Increment {count}
          </button>
        );
      }

      renderWithLogger(<MyApp />);

      screen.getByRole('button', { name: 'Increment 0' }).click();

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [MyApp.MyCounterParent] MyCounter retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],

        // React 19's getOwner doesn't work in `useEffect`
        [`transaction 2 : [MyApp.MyCounterParent] subscribed to ${countAtom}`],
        [`mounted ${countAtom}`, { value: 0 }],

        // React 19's getOwner doesn't work in callbacks
        [`transaction 3 : [MyCounter.button] set value of ${countAtom}`],
        [`changed value of ${countAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],
      ]);
    });
  });
});
