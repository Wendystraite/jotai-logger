import { atom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
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
import type { AnyAtom } from '../src/vanilla/types/event.js';

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

describe('transactions', () => {
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

  it('should log transactions details triggered by public atoms', () => {
    store = createLoggedStore(store, defaultOptions);
    const publicAtom = atom(0);
    const notPrivateSetAtom = atom(null, (get, set) => {
      set(publicAtom, 1);
    });
    store.set(notPrivateSetAtom);
    vi.runAllTimers();
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : called set of ${notPrivateSetAtom}`],
      [`initialized value of ${publicAtom} to 1`, { value: 1 }],
    ]);
  });

  it('should not log transactions details triggered by private atoms', () => {
    store = createLoggedStore(store, defaultOptions);
    const publicAtom = atom(0);
    const privateSetAtom = atom(null, (get, set) => {
      set(publicAtom, 1);
    });
    privateSetAtom.debugPrivate = true;
    store.set(privateSetAtom);
    vi.runAllTimers();
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1`],
      [`initialized value of ${publicAtom} to 1`, { value: 1 }],
    ]);
  });

  it('should not log transactions with only private atoms', () => {
    store = createLoggedStore(store, { ...defaultOptions, shouldShowPrivateAtoms: false });
    const privateAtom = atom(0);
    privateAtom.debugPrivate = true;
    const privateSetAtom = atom(null, (get, set) => {
      set(privateAtom, 1);
    });
    privateSetAtom.debugPrivate = true;
    store.set(privateSetAtom);
    vi.runAllTimers();
    expect(consoleMock.log.mock.calls).toEqual([]);
  });

  it('should not log transactions without events', () => {
    store = createLoggedStore(store, defaultOptions);
    const testSetAtom = atom(null, () => {
      // No events
    });
    store.set(testSetAtom);
    vi.runAllTimers();
    expect(consoleMock.log.mock.calls).toEqual([]);
  });

  it('should log changes made outside of transactions inside an unknown transaction', () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom(0);
    const setTestAtom = atom(null, (get, set) => {
      setTimeout(() => {
        set(testAtom, 42); // Outside of store.set transaction
      }, 1000);
    });
    store.set(setTestAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1`], // No transaction name since it's an unknown transaction
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
    ]);
  });

  it('should debounce events in the same transaction', () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom('trans-1.0');
    const setTestAtom = atom(null, (get, set) => {
      setTimeout(() => {
        // This is a new unknown transaction
        set(testAtom, 'trans-1.1');
        vi.advanceTimersByTime(50); // debounce
        set(testAtom, 'trans-1.2');
        vi.advanceTimersByTime(50); // debounce
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

  describe('requestIdleCallback', () => {
    it('should schedule and log queued transactions by using requestIdleCallback', () => {
      const requestIdleCallbacks: (() => void)[] = [];
      const requestIdleCallbackMockFn = vi.fn((cb: IdleRequestCallback) => {
        requestIdleCallbacks.push(() => {
          cb({ didTimeout: false, timeRemaining: () => 50 });
        });
        return 1;
      });
      globalThis.requestIdleCallback = requestIdleCallbackMockFn;
      onTestFinished(() => {
        delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;
      });

      store = createLoggedStore(store, defaultOptions);

      const testAtom = atom(0);

      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
      expect(consoleMock.log.mock.calls).toEqual([]);

      // Run all transactions
      store.get(testAtom);
      store.set(testAtom, 1);
      store.set(testAtom, 2);
      vi.runAllTimers();
      expect(requestIdleCallbackMockFn).toHaveBeenCalledOnce(); // First transaction scheduled
      requestIdleCallbackMockFn.mockClear();
      expect(consoleMock.log.mock.calls).toEqual([]); // Nothing logged yet

      requestIdleCallbacks.shift()!(); // Run the queued transactions
      vi.runAllTimers();
      expect(requestIdleCallbackMockFn).not.toHaveBeenCalled(); // No more transactions scheduled
      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
        [`transaction 2 : set value of ${testAtom} to 1`, { value: 1 }],
        [`changed value of ${testAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],
        [`transaction 3 : set value of ${testAtom} to 2`, { value: 2 }],
        [`changed value of ${testAtom} from 1 to 2`, { newValue: 2, oldValue: 1 }],
      ]);
    });
  });

  it('should merge nested direct store calls', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => {
      consoleWarnSpy.mockRestore();
    });

    store = createLoggedStore(store, defaultOptions);

    const otherAtom1 = atom(0);
    const otherAtom2 = atom(0);
    const otherAtom3 = atom(0);

    const testAtomCallback = (otherAtom: PrimitiveAtom<number>) => () => {
      store.get(otherAtom); // Nested store.get call
      store.set(otherAtom, 2); // Nested store.set call
      store.sub(otherAtom, vi.fn()); // Nested store.sub call
    };

    const testAtom1 = atom(testAtomCallback(otherAtom1), testAtomCallback(otherAtom1));
    const testAtom2 = atom(testAtomCallback(otherAtom2), testAtomCallback(otherAtom2));
    const testAtom3 = atom(testAtomCallback(otherAtom3), testAtomCallback(otherAtom3));

    store.get(testAtom1);
    store.set(testAtom2);
    store.sub(testAtom3, vi.fn());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      // Nested inside store.get
      [`transaction 1 : retrieved value of ${testAtom1}`],
      // `- Nested store.get transaction
      [`initialized value of ${otherAtom1} to 0`, { value: 0 }],
      // `- Nested store.set transaction
      [`changed value of ${otherAtom1} from 0 to 2`, { newValue: 2, oldValue: 0 }],
      // `- Nested store.sub transaction
      [`mounted ${otherAtom1}`, { value: 2 }],
      [`initialized value of ${testAtom1} to undefined`, { value: undefined }],

      // Nested inside store.set
      [`transaction 2 : called set of ${testAtom2}`],
      // `- Nested store.get transaction
      [`initialized value of ${otherAtom2} to 0`, { value: 0 }],
      // `- Nested store.set transaction
      [`changed value of ${otherAtom2} from 0 to 2`, { newValue: 2, oldValue: 0 }],
      // `- Nested store.sub transaction
      [`mounted ${otherAtom2}`, { value: 2 }],

      // Nested inside store.sub
      [`transaction 3 : subscribed to ${testAtom3}`],
      // `- Nested store.get transaction
      [`initialized value of ${otherAtom3} to 0`, { value: 0 }],
      // `- Nested store.set transaction
      [`changed value of ${otherAtom3} from 0 to 2`, { newValue: 2, oldValue: 0 }],
      // `- Nested store.sub transaction
      [`mounted ${otherAtom3}`, { value: 2 }],
      [`initialized value of ${testAtom3} to undefined`, { value: undefined }],
      [`mounted ${testAtom3}`, { value: undefined }],
    ]);

    // Jotai should warns about direct store mutations inside atoms
    expect(consoleWarnSpy.mock.calls).toEqual([
      ['Detected store mutation during atom read. This is not supported.'],
      ['Detected store mutation during atom read. This is not supported.'],
    ]);
  });

  describe('combinations of transaction options', () => {
    const testCases = [
      // 0000 - all false
      {
        binary: '0000',
        showTransactionNumber: false,
        showTransactionEventsCount: false,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: false,
        expected: (testAtom: AnyAtom) => `retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%cretrieved value %cof %catom%c${atomNumber}`,
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 0001 - only showTransactionLocaleTime true
      {
        binary: '0001',
        showTransactionNumber: false,
        showTransactionEventsCount: false,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: true,
        expected: (testAtom: AnyAtom) => `00:00:00 : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%c00:00:00 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // 00:00:00
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 0010 - only showTransactionElapsedTime true
      {
        binary: '0010',
        showTransactionNumber: false,
        showTransactionEventsCount: false,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: false,
        expected: (testAtom: AnyAtom) => `345.00 ms : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%c345.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // 345.00 ms
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 0011 - showTransactionElapsedTime and showTransactionLocaleTime true
      {
        binary: '0011',
        showTransactionNumber: false,
        showTransactionEventsCount: false,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: true,
        expected: (testAtom: AnyAtom) => `00:00:00 - 345.00 ms : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%c00:00:00 %c- %c345.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // 00:00:00
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 345.00 ms
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 0100 - only showTransactionEventsCount true
      {
        binary: '0100',
        showTransactionNumber: false,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: false,
        expected: (testAtom: AnyAtom) => `1 event : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%c1 event %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // 1 event
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 0101 - showTransactionEventsCount and showTransactionLocaleTime true
      {
        binary: '0101',
        showTransactionNumber: false,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: true,
        expected: (testAtom: AnyAtom) => `1 event - 00:00:00 : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%c1 event %c- %c00:00:00 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // 1 event
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 00:00:00
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 0110 - showTransactionEventsCount and showTransactionElapsedTime true
      {
        binary: '0110',
        showTransactionNumber: false,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: false,
        expected: (testAtom: AnyAtom) => `1 event - 345.00 ms : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%c1 event %c- %c345.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // 1 event
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 345.00 ms
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 0111 - showTransactionEventsCount, showTransactionElapsedTime and showTransactionLocaleTime true
      {
        binary: '0111',
        showTransactionNumber: false,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: true,
        expected: (testAtom: AnyAtom) =>
          `1 event - 00:00:00 - 345.00 ms : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%c1 event %c- %c00:00:00 %c- %c345.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // 1 event
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 00:00:00
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 345.00 ms
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 1000 - only showTransactionNumber true
      {
        binary: '1000',
        showTransactionNumber: true,
        showTransactionEventsCount: false,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: false,
        expected: (testAtom: AnyAtom) => `transaction 1 : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 1001 - showTransactionNumber and showTransactionLocaleTime true
      {
        binary: '1001',
        showTransactionNumber: true,
        showTransactionEventsCount: false,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: true,
        expected: (testAtom: AnyAtom) =>
          `transaction 1 - 00:00:00 : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%ctransaction %c1 %c- %c00:00:00 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 00:00:00
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 1010 - showTransactionNumber and showTransactionElapsedTime true
      {
        binary: '1010',
        showTransactionNumber: true,
        showTransactionEventsCount: false,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: false,
        expected: (testAtom: AnyAtom) =>
          `transaction 1 - 345.00 ms : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%ctransaction %c1 %c- %c345.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 345.00 ms
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 1011 - showTransactionNumber, showTransactionElapsedTime and showTransactionLocaleTime true
      {
        binary: '1011',
        showTransactionNumber: true,
        showTransactionEventsCount: false,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: true,
        expected: (testAtom: AnyAtom) =>
          `transaction 1 - 00:00:00 - 345.00 ms : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%ctransaction %c1 %c- %c00:00:00 %c- %c345.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 00:00:00
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 345.00 ms
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 1100 - showTransactionNumber and showTransactionEventsCount true
      {
        binary: '1100',
        showTransactionNumber: true,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: false,
        expected: (testAtom: AnyAtom) => `transaction 1 - 1 event : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%ctransaction %c1 %c- %c1 event %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 1 event
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 1101 - showTransactionNumber, showTransactionEventsCount and showTransactionLocaleTime true
      {
        binary: '1101',
        showTransactionNumber: true,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: true,
        expected: (testAtom: AnyAtom) =>
          `transaction 1 - 1 event - 00:00:00 : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%ctransaction %c1 %c- %c1 event %c- %c00:00:00 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 1 event
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 00:00:00
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 1110 - showTransactionNumber, showTransactionEventsCount and showTransactionElapsedTime true
      {
        binary: '1110',
        showTransactionNumber: true,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: false,
        expected: (testAtom: AnyAtom) =>
          `transaction 1 - 1 event - 345.00 ms : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%ctransaction %c1 %c- %c1 event %c- %c345.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 1 event
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 345.00 ms
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
      // 1111 - all true
      {
        binary: '1111',
        showTransactionNumber: true,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: true,
        showTransactionLocaleTime: true,
        expected: (testAtom: AnyAtom) =>
          `transaction 1 - 1 event - 00:00:00 - 345.00 ms : retrieved value of ${testAtom}`,
        expectedColors: (testAtom: AnyAtom, atomNumber: string) => [
          `%ctransaction %c1 %c- %c1 event %c- %c00:00:00 %c- %c345.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 1 event
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 00:00:00
          'color: #757575; font-weight: normal;', // -
          'color: #757575; font-weight: normal;', // 345.00 ms
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
      },
    ];

    it.each(testCases)(
      'should show correctly with options $binary (number=$showTransactionNumber, events=$showTransactionEventsCount, time=$showTransactionElapsedTime, locale=$showTransactionLocaleTime)',
      ({
        showTransactionNumber,
        showTransactionEventsCount,
        showTransactionElapsedTime,
        showTransactionLocaleTime,
        expected,
      }) => {
        store = createLoggedStore(store, {
          formatter: consoleFormatter({
            ...defaultFormatterOptions,
            showTransactionNumber,
            showTransactionEventsCount,
            showTransactionElapsedTime,
            showTransactionLocaleTime,
          }),
        });

        const testAtom = atom(() => {
          vi.advanceTimersByTime(345); // Fake the delay of the transaction
          return 0;
        });
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [expected(testAtom)],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      },
    );

    it.each(testCases)(
      'should show correctly with colors with options $binary (number=$showTransactionNumber, events=$showTransactionEventsCount, time=$showTransactionElapsedTime, locale=$showTransactionLocaleTime)',
      ({
        showTransactionNumber,
        showTransactionEventsCount,
        showTransactionElapsedTime,
        showTransactionLocaleTime,
        expectedColors,
      }) => {
        store = createLoggedStore(store, {
          formatter: consoleFormatter({
            ...defaultFormatterOptions,
            formattedOutput: true,
            showTransactionNumber,
            showTransactionEventsCount,
            showTransactionElapsedTime,
            showTransactionLocaleTime,
          }),
        });

        const testAtom = atom(() => {
          vi.advanceTimersByTime(345); // Fake the delay of the transaction
          return 0;
        });
        store.get(testAtom);

        const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
        expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          expectedColors(testAtom, atomNumber!),
          [
            `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
            'color: #0072B2; font-weight: bold;', // initialized value
            'color: #757575; font-weight: normal;', // of
            'color: #757575; font-weight: normal;', // atom
            'color: default; font-weight: normal;', // atomNumber
            'color: #757575; font-weight: normal;', // to
            'color: default; font-weight: normal;', // 0
            { value: 0 },
          ],
        ]);
      },
    );
  });
});
