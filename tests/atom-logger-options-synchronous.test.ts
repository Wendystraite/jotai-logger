import { atom } from 'jotai';
import { createStore } from 'jotai/vanilla';
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
import type { ConsoleFormatterOptions } from '../src/formatters/console/types.js';
import { type AtomLoggerOptions, createLoggedStore } from '../src/index.js';

let mockDate: MockInstance;

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  vi.stubEnv('TZ', 'UTC');
  mockDate = vi
    .spyOn(Date.prototype, 'toLocaleTimeString')
    .mockImplementation(function toLocaleTimeStringMock(this: Date) {
      return this.toISOString().split('T')[1]!.split('.')[0]!; // 14:39:27
    });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  mockDate.mockRestore();
});

describe('options.synchronous', () => {
  let store: ReturnType<typeof createStore>;
  let consoleMock: {
    log: Mock;
    group: Mock;
    groupEnd: Mock;
    groupCollapsed: Mock;
  };
  let defaultFormatterOptions: ConsoleFormatterOptions;
  let defaultOptions: AtomLoggerOptions;

  beforeEach(() => {
    store = createStore();
    consoleMock = {
      log: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
      groupCollapsed: vi.fn(),
    };
    defaultFormatterOptions = {
      logger: consoleMock,
      groupTransactions: false,
      groupEvents: false,
      formattedOutput: false,
      showTransactionElapsedTime: false,
      showTransactionEventsCount: false,
      collapseTransactions: false,
      collapseEvents: false,
      autoAlignTransactions: false,
    };
    defaultOptions = {
      formatter: consoleFormatter(defaultFormatterOptions),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should log asynchronously by default', () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom(42);
    store.get(testAtom);
    store.set(testAtom, 43);

    expect(consoleMock.log.mock.calls).toEqual([]);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
      [`transaction 2 : set value of ${testAtom} to 43`, { value: 43 }],
      [`changed value of ${testAtom} from 42 to 43`, { oldValue: 42, newValue: 43 }],
    ]);
  });

  it('should log synchronously when synchronous is true', () => {
    store = createLoggedStore(store, { ...defaultOptions, synchronous: true });

    const testAtom = atom(42);
    store.get(testAtom);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
    ]);

    consoleMock.log.mockClear();
    store.set(testAtom, 43);

    // vi.runAllTimers(); // No need to run timers, it should log synchronously

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 2 : set value of ${testAtom} to 43`, { value: 43 }],
      [`changed value of ${testAtom} from 42 to 43`, { oldValue: 42, newValue: 43 }],
    ]);
  });

  it('should ignore transactionDebounceMs, requestIdleCallbackTimeoutMs and maxProcessingTimeMs options when synchronous is true', () => {
    const options: AtomLoggerOptions = {
      ...defaultOptions,
      synchronous: true,
      requestIdleCallbackTimeoutMs: 345,
      transactionDebounceMs: 456,
      maxProcessingTimeMs: 789,
    };

    store = createLoggedStore(store, options);

    // Values are kept but are ignored
    expect(options).toEqual(
      expect.objectContaining({
        synchronous: true,
        requestIdleCallbackTimeoutMs: 345,
        transactionDebounceMs: 456,
        maxProcessingTimeMs: 789,
      }),
    );

    // Mutating synchronous at runtime also works
    options.synchronous = false;
    expect(options.synchronous).toBe(false);
  });
});
