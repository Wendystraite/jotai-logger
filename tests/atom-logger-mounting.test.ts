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

describe('mounting', () => {
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

  it('should unsubscribe while inside a transaction without starting a new one', () => {
    // Covers on-store-sub.ts lines 40-51: doStartTransaction=false in onStoreUnsubscribe
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom(0);
    let capturedUnsubscribe: (() => void) | undefined;

    const triggerAtom = atom(null, (_get, set) => {
      // Subscribe and immediately unsubscribe from within a transaction (set call)
      capturedUnsubscribe = store.sub(testAtom, vi.fn());
      set(testAtom, 1);
    });

    store.set(triggerAtom);

    vi.runAllTimers();

    expect(capturedUnsubscribe).toBeDefined();

    // Now unsubscribe from within another transaction (isInsideTransaction=true)
    const unsubAtom = atom(null, () => {
      capturedUnsubscribe!();
    });
    store.set(unsubAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls.length).toBeGreaterThan(0);
  });

  it('should log mounted and unmounted atoms', () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom(42);

    const unmount = store.sub(testAtom, vi.fn());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
      [`mounted ${testAtom}`, { value: 42 }],
    ]);

    unmount();

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
      [`mounted ${testAtom}`, { value: 42 }],

      [`transaction 2 : unsubscribed from ${testAtom}`],
      [`unmounted ${testAtom}`],
    ]);
  });

  it('should log mounted and unmounted atoms in colors', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
    });

    const testAtom = atom(42);

    const unmount = store.sub(testAtom, vi.fn());

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %csubscribed %cto %catom%c${atomNumber}`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #009E73; font-weight: bold;', // subscribed
        'color: #757575; font-weight: normal;', // to
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
      ],
      [
        `%cinitialized value %cof %catom%c${atomNumber} %cto %c42`,
        'color: #0072B2; font-weight: bold;', // initialized value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // to
        'color: default; font-weight: normal;', // 42
        { value: 42 },
      ],
      [
        `%cmounted %catom%c${atomNumber}`,
        'color: #009E73; font-weight: bold;', // mounted
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        { value: 42 },
      ],
    ]);

    vi.clearAllMocks();

    unmount();

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c2 %c: %cunsubscribed %cfrom %catom%c${atomNumber}`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 2
        `color: #757575; font-weight: normal;`, // :
        `color: #D55E00; font-weight: bold;`, // unsubscribed
        `color: #757575; font-weight: normal;`, // from
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
      ],
      [
        `%cunmounted %catom%c${atomNumber}`,
        `color: #D55E00; font-weight: bold;`, // unmounted
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
      ],
    ]);
  });

  it('should log atom value when mounted', () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom(42);

    store.sub(testAtom, vi.fn());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
      [`mounted ${testAtom}`, { value: 42 }],
    ]);
  });

  it('should log atom promise value when mounted', async () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(42);
        }, 1000);
      });
    });

    void store.get(testAtom); // resolves the promise
    await vi.advanceTimersByTimeAsync(1000);

    store.sub(testAtom, vi.fn());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`pending initial promise of ${testAtom}`],

      [`transaction 2 : resolved promise of ${testAtom}`],
      [`resolved initial promise of ${testAtom} to 42`, { value: 42 }],

      [`transaction 3 : subscribed to ${testAtom}`],
      [`mounted ${testAtom}`, { value: 42 }],
    ]);
  });
});
