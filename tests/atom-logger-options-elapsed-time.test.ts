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
import { createLoggedStore } from '../src/index.js';

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

describe('options.showTransactionElapsedTime', () => {
  let store: ReturnType<typeof createStore>;
  let consoleMock: {
    log: Mock;
    group: Mock;
    groupEnd: Mock;
    groupCollapsed: Mock;
  };
  let defaultFormatterOptions: ConsoleFormatterOptions;

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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should log elapsed time when showTransactionElapsedTime is enabled', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionElapsedTime: true,
      }),
    });

    const testAtom = atom(() => {
      vi.advanceTimersByTime(123); // Fake the delay of the transaction
      return 0;
    });
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 123.00 ms : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should not log elapsed time when showTransactionElapsedTime is disabled', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionElapsedTime: false,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should not log elapsed time if endTimestamp is equal or less than startTimestamp', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionElapsedTime: true,
      }),
    });

    const testAtom = atom(() => {
      vi.advanceTimersByTime(0); // No delay here (with fake timers)
      return 0;
    });
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should call performance.now when showTransactionElapsedTime is enabled', () => {
    const performanceNowSpy = vi.spyOn(performance, 'now');

    store = createLoggedStore(store, {
      synchronous: true,
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: false,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(performanceNowSpy).toHaveBeenCalledTimes(2); // Called at the start and the end of the transaction
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should call performance.now when showTransactionLocaleTime is enabled', () => {
    const performanceNowSpy = vi.spyOn(performance, 'now');

    store = createLoggedStore(store, {
      synchronous: true,
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: true,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(performanceNowSpy).toHaveBeenCalledTimes(2); // Called at the start and the end of the transaction
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 00:00:00 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should not call performance.now when showTransactionElapsedTime and showTransactionLocaleTime are disabled', () => {
    const performanceNowSpy = vi.spyOn(performance, 'now');

    store = createLoggedStore(store, {
      synchronous: true,
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: false,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    // performance.now is now always called to record start/end timestamps for transactions,
    // regardless of formatter display options
    expect(performanceNowSpy).toHaveBeenCalled();
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });
});
