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
  onTestFinished,
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

describe('options', () => {
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

  describe('transactionDebounceMs', () => {
    it('should log transactions with debounce by default', () => {
      store = createLoggedStore(store, defaultOptions);

      const testAtom = atom('trans-1.0');
      const setTestAtom = atom(null, (get, set) => {
        setTimeout(() => {
          // This is a new unknown transaction
          set(testAtom, 'trans-1.1');
          vi.advanceTimersByTime(249); // debounce
          set(testAtom, 'trans-1.2');
          vi.advanceTimersByTime(249); // debounce
          set(testAtom, 'trans-1.3');

          // Will be in another transaction if >= 250ms
          vi.advanceTimersByTime(250);
          set(testAtom, 'trans-2.1');
        }, 1000);
      });
      store.set(setTestAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1`],
        [`initialized value of ${testAtom} to "trans-1.1"`, { value: 'trans-1.1' }],
        [
          `changed value of ${testAtom} 2 times from "trans-1.1" to "trans-1.3"`,
          {
            newValue: 'trans-1.3',
            oldValues: ['trans-1.1', 'trans-1.2'],
          },
        ],

        [`transaction 2`],
        [
          `changed value of ${testAtom} from "trans-1.3" to "trans-2.1"`,
          { newValue: 'trans-2.1', oldValue: 'trans-1.3' },
        ],
      ]);
    });

    it('should log transactions with debounce with transactionDebounceMs option', () => {
      const transactionDebounceMs = 100;

      store = createLoggedStore(store, {
        ...defaultOptions,
        transactionDebounceMs,
      });

      const testAtom = atom('trans-1.0');
      const setTestAtom = atom(null, (get, set) => {
        setTimeout(() => {
          // This is a new unknown transaction
          set(testAtom, 'trans-1.1');
          vi.advanceTimersByTime(transactionDebounceMs - 1); // debounce
          set(testAtom, 'trans-1.2');
          vi.advanceTimersByTime(transactionDebounceMs - 1); // debounce
          set(testAtom, 'trans-1.3');

          // Will be in another transaction if >= transactionDebounceMs
          vi.advanceTimersByTime(transactionDebounceMs);
          set(testAtom, 'trans-2.1');
        }, 1000);
      });
      store.set(setTestAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1`],
        [`initialized value of ${testAtom} to "trans-1.1"`, { value: 'trans-1.1' }],
        [
          `changed value of ${testAtom} 2 times from "trans-1.1" to "trans-1.3"`,
          {
            newValue: 'trans-1.3',
            oldValues: ['trans-1.1', 'trans-1.2'],
          },
        ],

        [`transaction 2`],
        [
          `changed value of ${testAtom} from "trans-1.3" to "trans-2.1"`,
          { newValue: 'trans-2.1', oldValue: 'trans-1.3' },
        ],
      ]);
    });

    it('should log transactions without debounce when transactionDebounceMs is 0', () => {
      store = createLoggedStore(store, {
        ...defaultOptions,
        transactionDebounceMs: 0,
      });

      const testAtom = atom('trans-1.0');
      const setTestAtom = atom(null, (get, set) => {
        setTimeout(() => {
          set(testAtom, 'trans-1.1'); // This is a new unknown transaction
          set(testAtom, 'trans-1.2'); // This is a new unknown transaction
          vi.advanceTimersByTime(1);
          set(testAtom, 'trans-2.1'); // This is a new unknown transaction
        }, 1000);
      });
      store.set(setTestAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1`],
        [`initialized value of ${testAtom} to "trans-1.1"`, { value: 'trans-1.1' }],

        [`transaction 2`],
        [
          `changed value of ${testAtom} from "trans-1.1" to "trans-1.2"`,
          { newValue: 'trans-1.2', oldValue: 'trans-1.1' },
        ],

        [`transaction 3`],
        [
          `changed value of ${testAtom} from "trans-1.2" to "trans-2.1"`,
          { newValue: 'trans-2.1', oldValue: 'trans-1.2' },
        ],
      ]);
    });
  });

  describe('requestIdleCallbackTimeoutMs', () => {
    const transactionCallbacks: (() => void)[] = [];
    let requestIdleCallbackMockFn: Mock;

    beforeEach(() => {
      requestIdleCallbackMockFn = vi.fn((cb: IdleRequestCallback) => {
        transactionCallbacks.push(() => {
          cb({ didTimeout: false, timeRemaining: () => 50 });
        });
        return 1;
      });
      globalThis.requestIdleCallback = requestIdleCallbackMockFn;
    });

    afterEach(() => {
      delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;
    });

    it('should schedule and log transactions using requestIdleCallback by default', () => {
      store = createLoggedStore(store, defaultOptions);

      const testAtom = atom(0);

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
      expect(consoleMock.log.mock.calls).toEqual([]);

      store.get(testAtom);
      vi.runAllTimers();

      expect(requestIdleCallbackMockFn).toHaveBeenCalledExactlyOnceWith(expect.any(Function), {
        timeout: 250,
      });

      expect(consoleMock.log.mock.calls).toEqual([]);
      requestIdleCallbackMockFn.mockClear();
      transactionCallbacks.shift()!(); // Run the first transaction
      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
      ]);
      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    });

    it('should schedule and log transactions using requestIdleCallback with requestIdleCallbackTimeoutMs option', () => {
      store = createLoggedStore(store, {
        ...defaultOptions,
        requestIdleCallbackTimeoutMs: 666,
      });

      const testAtom = atom(0);

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
      expect(consoleMock.log.mock.calls).toEqual([]);

      store.get(testAtom);
      vi.runAllTimers();

      expect(requestIdleCallbackMockFn).toHaveBeenCalledExactlyOnceWith(expect.any(Function), {
        timeout: 666,
      });

      expect(consoleMock.log.mock.calls).toEqual([]);
      requestIdleCallbackMockFn.mockClear();
      transactionCallbacks.shift()!(); // Run the first transaction
      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
      ]);
      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    });

    it('should schedule and log transactions using requestIdleCallback without timeout with requestIdleCallbackTimeoutMs option to 0', () => {
      store = createLoggedStore(store, {
        ...defaultOptions,
        requestIdleCallbackTimeoutMs: 0,
      });

      const testAtom = atom(0);

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
      expect(consoleMock.log.mock.calls).toEqual([]);

      store.get(testAtom);
      vi.runAllTimers();

      expect(requestIdleCallbackMockFn).toHaveBeenCalledExactlyOnceWith(expect.any(Function), {
        timeout: 0,
      });

      expect(consoleMock.log.mock.calls).toEqual([]);
      requestIdleCallbackMockFn.mockClear();
      transactionCallbacks.shift()!(); // Run the first transaction
      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
      ]);
      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    });

    it('should log transactions synchronously when requestIdleCallbackTimeoutMs is -1', () => {
      store = createLoggedStore(store, {
        ...defaultOptions,
        requestIdleCallbackTimeoutMs: -1,
      });

      const testAtom = atom(0);

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
      expect(consoleMock.log.mock.calls).toEqual([]);

      store.get(testAtom);

      expect(consoleMock.log.mock.calls).toEqual([]);

      vi.advanceTimersByTime(250); // Default debounce time

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should log transactions synchronously when requestIdleCallbackTimeoutMs and transactionDebounceMs are -1', () => {
      store = createLoggedStore(store, {
        ...defaultOptions,
        requestIdleCallbackTimeoutMs: -1,
        transactionDebounceMs: -1,
      });

      const testAtom = atom(0);

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
      expect(consoleMock.log.mock.calls).toEqual([]);

      store.get(testAtom);

      // vi.runAllTimers(); // No need to run timers, it should log synchronously

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
      ]);
    });
  });

  describe('maxProcessingTimeMs', () => {
    it('should process and log transactions in chunks when processing takes too long by default', () => {
      const performanceNowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);

      let callCount = 0;
      performanceNowSpy.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 100; // First call: 0ms (start), second call: 100ms (exceeded)
      });

      const requestIdleCallbacks: (() => void)[] = []; // Store scheduled callbacks
      const requestIdleCallbackMockFn = vi.fn().mockImplementation((cb: IdleRequestCallback) => {
        requestIdleCallbacks.push(() => {
          cb({ didTimeout: false, timeRemaining: () => 50 });
        });
        return 1;
      });
      globalThis.requestIdleCallback = requestIdleCallbackMockFn;
      onTestFinished(() => {
        delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;
      });

      store = createLoggedStore(store, {
        ...defaultOptions,
      });

      // Create 12 atoms : 10 will be logged in the first chunk, 2 in the second chunk
      const testAtoms = Array.from({ length: 12 }, (_, i) => atom(i + 1));
      for (const testAtom of testAtoms) {
        store.get(testAtom);
      }

      vi.runAllTimers();

      // Waiting for requestIdleCallback
      expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(1);
      // performance.now is always called now for start/end timestamps
      expect(consoleMock.log.mock.calls).toEqual([]);
      requestIdleCallbackMockFn.mockClear();
      performanceNowSpy.mockClear();
      consoleMock.log.mockClear();
      // Reset callCount so the scheduler's first call returns 0ms, second returns 100ms
      callCount = 0;

      requestIdleCallbacks.shift()!(); // Invoke the 1st scheduled callback

      expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(1); // Called again due to time limit
      expect(performanceNowSpy).toHaveBeenCalledTimes(2); // Start + first check
      expect(consoleMock.log.mock.calls).toEqual(
        Array.from({ length: 10 }, (_, i) => [
          [`transaction ${i + 1} : retrieved value of ${testAtoms[i]}`],
          [`initialized value of ${testAtoms[i]} to ${i + 1}`, { value: i + 1 }],
        ]).flat(1),
      );
      requestIdleCallbackMockFn.mockClear();
      performanceNowSpy.mockClear();
      consoleMock.log.mockClear();

      requestIdleCallbacks.shift()!(); // Invoke the 2nd scheduled callback

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled(); // Finished processing
      expect(performanceNowSpy).toHaveBeenCalledTimes(1); // Start only (not reached checkTimeInterval)
      expect(consoleMock.log.mock.calls).toEqual(
        Array.from({ length: 2 }, (_, i) => [
          [`transaction ${i + 11} : retrieved value of ${testAtoms[i + 10]}`],
          [`initialized value of ${testAtoms[i + 10]} to ${i + 11}`, { value: i + 11 }],
        ]).flat(1),
      );
    });
  });
});
