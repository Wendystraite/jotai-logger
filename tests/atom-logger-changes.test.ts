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

describe('changes', () => {
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

  it('should log atom value changes', () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom<unknown>(42);

    // value
    store.get(testAtom);

    // old value -> new value
    store.set(testAtom, 43);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],

      [`transaction 2 : set value of ${testAtom} to 43`, { value: 43 }],
      [`changed value of ${testAtom} from 42 to 43`, { newValue: 43, oldValue: 42 }],
    ]);
  });

  it('should log atom value and promise changes', async () => {
    store = createLoggedStore(store, defaultOptions);

    const valueTypeAtom = atom<'value' | 'resolve' | 'reject' | 'reject2'>('resolve');
    valueTypeAtom.debugPrivate = true;

    let count = 0;
    const promiseAtom = atom<Promise<number>>(async (get) => {
      count += 1;
      const type = get(valueTypeAtom);
      if (type === 'value') {
        return count;
      } else if (type === 'reject' || type === 'reject2') {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`${count}`));
          }, 100);
        });
      } else {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(count);
          }, 100);
        });
      }
    });

    // value
    store.set(valueTypeAtom, 'value');
    store.sub(promiseAtom, vi.fn());
    await vi.advanceTimersByTimeAsync(250);

    // value -> promise resolve
    store.set(valueTypeAtom, 'resolve');
    await vi.advanceTimersByTimeAsync(250);

    // promise resolve -> promise reject
    store.set(valueTypeAtom, 'reject');
    await vi.advanceTimersByTimeAsync(250);

    // promise reject -> promise resolve
    store.set(valueTypeAtom, 'resolve');
    await vi.advanceTimersByTimeAsync(250);

    // promise resolve -> value
    store.set(valueTypeAtom, 'value');
    await vi.advanceTimersByTimeAsync(250);

    // value -> promise reject
    store.set(valueTypeAtom, 'reject');
    await vi.advanceTimersByTimeAsync(250);

    // promise reject -> promise reject
    store.set(valueTypeAtom, 'reject2');
    await vi.advanceTimersByTimeAsync(250);

    // promise reject -> value
    store.set(valueTypeAtom, 'value');
    await vi.advanceTimersByTimeAsync(250);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      // value
      [`transaction 1 : subscribed to ${promiseAtom}`],
      [`pending initial promise of ${promiseAtom}`],
      [`mounted ${promiseAtom}`],
      [`resolved initial promise of ${promiseAtom} to 1`, { value: 1 }],

      // value -> promise resolve
      ['transaction 2'],
      [`pending promise of ${promiseAtom} from 1`, { oldValue: 1 }],
      [`resolved promise of ${promiseAtom} from 1 to 2`, { oldValue: 1, newValue: 2 }],

      // promise resolve -> promise reject
      ['transaction 3'],
      [`pending promise of ${promiseAtom} from 2`, { oldValue: 2 }],
      [
        `rejected promise of ${promiseAtom} from 2 to Error: 3`,
        { oldValue: 2, error: new Error('3') },
      ],

      // promise reject -> promise resolve
      ['transaction 4'],
      [`pending promise of ${promiseAtom} from Error: 3`, { oldError: new Error('3') }],
      [
        `resolved promise of ${promiseAtom} from Error: 3 to 4`,
        { oldError: new Error('3'), value: 4 },
      ],

      // promise resolve -> value
      ['transaction 5'],
      [`pending promise of ${promiseAtom} from 4`, { oldValue: 4 }],
      [`resolved promise of ${promiseAtom} from 4 to 5`, { newValue: 5, oldValue: 4 }],

      // value -> promise reject
      ['transaction 6'],
      [`pending promise of ${promiseAtom} from 5`, { oldValue: 5 }],
      [
        `rejected promise of ${promiseAtom} from 5 to Error: 6`,
        { oldValue: 5, error: new Error('6') },
      ],

      // promise reject -> promise reject
      ['transaction 7'],
      [`pending promise of ${promiseAtom} from Error: 6`, { oldError: new Error('6') }],
      [
        `rejected promise of ${promiseAtom} from Error: 6 to Error: 7`,
        { oldError: new Error('6'), newError: new Error('7') },
      ],

      // promise reject -> value
      ['transaction 8'],
      [`pending promise of ${promiseAtom} from Error: 7`, { oldError: new Error('7') }],
      [
        `resolved promise of ${promiseAtom} from Error: 7 to 8`,
        { oldError: new Error('7'), value: 8 },
      ],
    ]);
  });

  it('should merge atom value changes if they are in the same transaction', () => {
    store = createLoggedStore(store, defaultOptions);

    const valueAtom = atom(0);

    const valueSetAtom = atom(null, (get, set) => {
      set(valueAtom, 1);
      set(valueAtom, 2);
      set(valueAtom, 3);
      set(valueAtom, 4);
      set(valueAtom, 5);
    });

    store.set(valueSetAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : called set of ${valueSetAtom}`],
      [`initialized value of ${valueAtom} to 1`, { value: 1 }],
      [
        `changed value of ${valueAtom} 4 times from 1 to 5`,
        { oldValues: [1, 2, 3, 4], newValue: 5 },
      ],
    ]);
  });

  it('should log merged atom value changes as is', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        formattedOutput: false,
        stringifyValues: false,
      }),
    });

    const valueAtom = atom(0);

    const valueSetAtom = atom(null, (get, set) => {
      set(valueAtom, 1);
      set(valueAtom, 2);
      set(valueAtom, 3);
      set(valueAtom, 4);
      set(valueAtom, 5);
    });

    store.set(valueSetAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : called set of ${valueSetAtom}`],
      [`initialized value of ${valueAtom} to`, 1],
      [`changed value of ${valueAtom} 4 times from`, [1, 2, 3, 4], `to`, 5],
    ]);
  });

  it('should log merged atom value changes in colors', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
    });

    const valueAtom = atom(0);

    const valueSetAtom = atom(null, (get, set) => {
      set(valueAtom, 1);
      set(valueAtom, 2);
      set(valueAtom, 3);
      set(valueAtom, 4);
      set(valueAtom, 5);
    });

    const valueAtomNumber = /atom(\d+)(.*)/.exec(valueAtom.toString())?.[1];
    const valueSetAtomNumber = /atom(\d+)(.*)/.exec(valueSetAtom.toString())?.[1];
    expect(Number.isInteger(parseInt(valueAtomNumber!))).toBeTruthy();
    expect(Number.isInteger(parseInt(valueSetAtomNumber!))).toBeTruthy();

    store.set(valueSetAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %ccalled set %cof %catom%c${valueSetAtomNumber}`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #E69F00; font-weight: bold;', // called set
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
      ],
      [
        `%cinitialized value %cof %catom%c${valueAtomNumber} %cto %c1`,
        'color: #0072B2; font-weight: bold;', // initialized value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // to
        'color: default; font-weight: normal;', // 1
        { value: 1 },
      ],
      [
        `%cchanged value %cof %catom%c${valueAtomNumber} %c4 %ctimes %cfrom %c1 %cto %c5`,
        'color: #56B4E9; font-weight: bold;', // changed value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: default; font-weight: normal;', // 4
        'color: #757575; font-weight: normal;', // times
        'color: #757575; font-weight: normal;', // from
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // to
        'color: default; font-weight: normal;', // 5
        { newValue: 5, oldValues: [1, 2, 3, 4] },
      ],
    ]);
  });

  it('should not crash when logging an atom with a circular value', () => {
    store = createLoggedStore(store, defaultOptions);

    const circularValue = {} as { self: unknown };
    circularValue.self = circularValue;
    const circularAtom = atom(circularValue);

    store.get(circularAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${circularAtom}`],
      [`initialized value of ${circularAtom} to [Circular]`, { value: circularValue }],
    ]);
  });

  it('should emit a changed event when value changes from -0 to 0 (Object.is differs but === does not)', () => {
    const numAtom = atom(-0);
    store = createLoggedStore(store, defaultOptions);

    store.sub(numAtom, vi.fn());
    vi.runAllTimers();
    vi.clearAllMocks();

    store.set(numAtom, 0);
    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 2 : set value of ${numAtom} to 0`, { value: 0 }],
      [`changed value of ${numAtom} from 0 to 0`, { newValue: 0, oldValue: -0 }],
    ]);
  });
});
