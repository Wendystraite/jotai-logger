// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { atom, createStore, useStore } from 'jotai';
import { useAtomsDevtools } from 'jotai-devtools';
import type { Store } from 'jotai/vanilla/store';
import React from 'react';
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

import { consoleFormatter } from '../src/formatters/console/index.js';
import { AtomLoggerProvider, createLoggedStore, isLoggedStore } from '../src/index.js';
import type { AtomLoggerOptions } from '../src/vanilla/types/options.js';

function isDevtoolsStore(store: Store): boolean {
  return 'get_internal_weak_map' in store;
}

let mockDate: MockInstance;

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  vi.stubEnv('TZ', 'UTC');
  mockDate = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(() => '00:00:00');
  vi.spyOn(console, 'warn').mockImplementation((warning) => {
    // Ignore Please install/enable Redux devtools extension
    if (
      typeof warning === 'string' &&
      warning.includes('Please install/enable Redux devtools extension')
    ) {
      return;
    }

    // Use the actual console.warn for other errors
    void vi.importActual('console').then((originalConsole) => {
      (originalConsole as unknown as typeof console).warn(warning);
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  mockDate.mockRestore();
});

describe('AtomLoggerProvider', () => {
  it('jotai-devtools should create a dev store when calling createStore', () => {
    expect(isDevtoolsStore(createStore())).toBeTruthy();
  });

  it('should provide a logged store when wrapping a devtools store', () => {
    const devtoolsStore = createStore();
    expect(isDevtoolsStore(devtoolsStore)).toBeTruthy();

    let childStore: Store | undefined;

    function Child() {
      useAtomsDevtools('devtools', { store: devtoolsStore });
      childStore = useStore();
      return null;
    }

    render(
      <AtomLoggerProvider>
        <Child />
      </AtomLoggerProvider>,
    );

    expect(isLoggedStore(childStore!)).toBeTruthy();
    expect(isDevtoolsStore(devtoolsStore)).toBeTruthy();
  });
});

describe('createLoggedStore', () => {
  let store: Store;
  let loggedStore: Store;
  let consoleMock: {
    log: Mock;
    group: Mock;
    groupEnd: Mock;
    groupCollapsed: Mock;
  };
  let defaultOptions: AtomLoggerOptions;

  beforeEach(() => {
    store = createStore();
    consoleMock = {
      log: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
      groupCollapsed: vi.fn(),
    };
    defaultOptions = {
      formatter: consoleFormatter({
        logger: consoleMock,
        groupTransactions: false,
        groupEvents: false,
        formattedOutput: false,
        showTransactionElapsedTime: false,
        autoAlignTransactions: false,
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a logged store from a devtools store', () => {
    expect(isDevtoolsStore(store)).toBeTruthy();
    loggedStore = createLoggedStore(store);
    expect(isLoggedStore(loggedStore)).toBeTruthy();
    expect(isDevtoolsStore(store)).toBeTruthy();
  });

  it('should log mounted and unmounted atoms with a devtool store', () => {
    expect(isDevtoolsStore(store)).toBeTruthy();
    loggedStore = createLoggedStore(store, defaultOptions);

    const testAtom = atom(42);

    const unmount = loggedStore.sub(testAtom, vi.fn());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 2 events : subscribed to ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
      [`mounted ${testAtom}`, { value: 42 }],
    ]);

    unmount();

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 2 events : subscribed to ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
      [`mounted ${testAtom}`, { value: 42 }],

      [`transaction 2 - 1 event : unsubscribed from ${testAtom}`],
      [`unmounted ${testAtom}`],
    ]);
  });

  it('should log dependents when mounted with a devtool store', () => {
    expect(isDevtoolsStore(store)).toBeTruthy();
    loggedStore = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom((get) => get(aAtom) * 2);

    loggedStore.sub(bAtom, vi.fn());
    loggedStore.set(aAtom, 2);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 4 events : subscribed to ${bAtom}`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [`initialized value of ${bAtom} to 2`, { value: 2, dependencies: [`${aAtom}`] }],
      [`mounted ${aAtom}`, { value: 1 }],
      [`mounted ${bAtom}`, { value: 2, dependencies: [`${aAtom}`] }],

      [`transaction 2 - 2 events : set value of ${aAtom} to 2`, { value: 2 }],
      [
        `changed value of ${aAtom} from 1 to 2`,
        {
          dependents: [`${bAtom}`],
          newValue: 2,
          oldValue: 1,
        },
      ],
      [
        `changed value of ${bAtom} from 2 to 4`,
        {
          dependencies: [`${aAtom}`],
          newValue: 4,
          oldValue: 2,
        },
      ],
    ]);
  });
});
