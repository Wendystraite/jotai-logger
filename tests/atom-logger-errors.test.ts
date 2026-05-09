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

describe('errors', () => {
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

  it('should log error values without stringifying when stringifyValues is false', async () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, stringifyValues: false }),
    });

    const errorAtom = atom<unknown>(() => Promise.reject(new Error('initial error')));

    store.sub(errorAtom, vi.fn());
    await vi.advanceTimersByTimeAsync(250);

    vi.runAllTimers();

    // Covers event-log-pipeline.ts line 265: stringifyValues=false, isNewValueError=true, no old value
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${errorAtom}`],
      [`pending initial promise of ${errorAtom}`],
      [`mounted ${errorAtom}`],
      [`rejected initial promise of ${errorAtom} to`, new Error('initial error')],
    ]);
  });

  it('should log old error and new error without stringifying when stringifyValues is false', async () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, stringifyValues: false }),
    });

    const depAtom = atom(0);
    depAtom.debugPrivate = true;
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/require-await
    const errorAtom = atom<unknown>(async (get) => {
      get(depAtom);
      count += 1;
      throw new Error(`error ${count}`);
    });

    store.sub(errorAtom, vi.fn());
    await vi.advanceTimersByTimeAsync(250);

    vi.clearAllMocks();

    // Change dep so errorAtom re-runs: old error → new pending → new error
    store.set(depAtom, 1);
    await vi.advanceTimersByTimeAsync(250);

    vi.runAllTimers();

    // Covers event-log-pipeline.ts lines 215, 262:
    // - line 215: stringifyValues=false, old error shown in pending log (old value was error)
    // - line 262: stringifyValues=false, hasOldValue && isOldValueError, new value is also error
    const calls = consoleMock.log.mock.calls;
    expect(calls).toContainEqual(expect.arrayContaining([expect.stringContaining('pending')]));
    expect(calls).toContainEqual(expect.arrayContaining([expect.stringContaining('rejected')]));
  });

  it('should log custom errors', async () => {
    store = createLoggedStore(store, defaultOptions);

    const customError = RangeError('Custom error message');
    const promiseAtom = atom(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(customError);
        }, 0);
      });
    });

    const promise = store.get(promiseAtom);

    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).rejects.toThrow('Custom error message');

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${promiseAtom}`],
      [`pending initial promise of ${promiseAtom}`],
      [
        `rejected initial promise of ${promiseAtom} to RangeError: Custom error message`,
        { error: customError },
      ],
    ]);
  });

  it('should not emit a changed event when a derived atom transitions to a synchronous error', () => {
    let shouldThrow = false;
    const depAtom = atom(0);
    const derivedAtom = atom((get) => {
      get(depAtom);
      if (shouldThrow) throw new Error('sync error');
      return 42;
    });

    // initialize derivedAtom to 42
    store = createLoggedStore(store, defaultOptions);
    store.sub(derivedAtom, vi.fn());
    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${derivedAtom}`],
      [`initialized value of ${depAtom} to 0`, { dependents: [`${derivedAtom}`], value: 0 }],
      [`initialized value of ${derivedAtom} to 42`, { dependencies: [`${depAtom}`], value: 42 }],
      [`mounted ${depAtom}`, { dependents: [`${derivedAtom}`], value: 0 }],
      [`mounted ${derivedAtom}`, { dependencies: [`${depAtom}`], value: 42 }],
    ]);
    consoleMock.log.mockClear();

    // update depAtom to trigger derivedAtom to throw.
    // no changed event should be emitted for derivedAtom since its value never changed to the error
    shouldThrow = true;
    store.set(depAtom, 1);
    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 2 : set value of ${depAtom} to 1`, { value: 1 }],
      [
        `changed value of ${depAtom} from 0 to 1`,
        { dependents: [`${derivedAtom}`], newValue: 1, oldValue: 0 },
      ],
    ]);
  });
});
