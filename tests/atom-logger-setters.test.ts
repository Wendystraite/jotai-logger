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

describe('setters', () => {
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

  it('should log default atom setter', () => {
    store = createLoggedStore(store, defaultOptions);

    const simpleAtom = atom(0);
    store.set(simpleAtom, 1);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : set value of ${simpleAtom} to 1`, { value: 1 }],
      [`initialized value of ${simpleAtom} to 1`, { value: 1 }],
    ]);
  });

  it('should log default atom setter in colors', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
    });

    const simpleAtom = atom(0);
    store.set(simpleAtom, 1);

    const atomNumber = /atom(\d+)(.*)/.exec(simpleAtom.toString())?.[1];
    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %cset value %cof %catom%c${atomNumber} %cto %c1`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #E69F00; font-weight: bold;', // set value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // to
        'color: default; font-weight: normal;', // 1
        { value: 1 },
      ],
      [
        `%cinitialized value %cof %catom%c${atomNumber} %cto %c1`,
        'color: #0072B2; font-weight: bold;', // initialized value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // to
        'color: default; font-weight: normal;', // 1
        { value: 1 },
      ],
    ]);
  });

  it('should log custom atom setter', () => {
    store = createLoggedStore(store, defaultOptions);

    const valueAtom = atom(0);
    const oneSetAtom = atom(null, (get, set) => {
      set(valueAtom, 1);
    });
    const twoSetAtom = atom(null, (get, set, args: { newValue: number }) => {
      set(valueAtom, args.newValue);
    });
    const threeSetAtom = atom(null, (get, set) => {
      set(valueAtom, 3);
      return `myReturnValue-3`;
    });
    const fourSetAtom = atom(null, (get, set, args: { newValue: number }, otherArg: string) => {
      set(valueAtom, args.newValue);
      return `myOtherReturnValue-${args.newValue}-${otherArg}`;
    });

    store.get(valueAtom);

    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    const one = store.set(oneSetAtom);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    const two = store.set(twoSetAtom, { newValue: 2 });
    const three = store.set(threeSetAtom);
    const four = store.set(fourSetAtom, { newValue: 4 }, 'otherArg');

    expect(one).toBe(undefined);
    expect(two).toBe(undefined);
    expect(three).toBe('myReturnValue-3');
    expect(four).toBe('myOtherReturnValue-4-otherArg');

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${valueAtom}`],
      [`initialized value of ${valueAtom} to 0`, { value: 0 }],

      [`transaction 2 : called set of ${oneSetAtom}`],
      [`changed value of ${valueAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],

      [
        `transaction 3 : called set of ${twoSetAtom} with {"newValue":2}`,
        { args: [{ newValue: 2 }] },
      ],
      [`changed value of ${valueAtom} from 1 to 2`, { newValue: 2, oldValue: 1 }],

      [
        `transaction 4 : called set of ${threeSetAtom} and returned "myReturnValue-3"`,
        { result: 'myReturnValue-3' },
      ],
      [`changed value of ${valueAtom} from 2 to 3`, { newValue: 3, oldValue: 2 }],

      [
        `transaction 5 : called set of ${fourSetAtom} with [{"newValue":4},"otherArg"] and returned "myOtherReturnValue-4-otherArg"`,
        {
          args: [{ newValue: 4 }, 'otherArg'],
          result: 'myOtherReturnValue-4-otherArg',
        },
      ],
      [`changed value of ${valueAtom} from 3 to 4`, { newValue: 4, oldValue: 3 }],
    ]);
  });

  it('should log default atom setter with previous state function', () => {
    store = createLoggedStore(store, defaultOptions);

    const simpleAtom = atom(0);
    store.set(simpleAtom, (prev) => prev + 1);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : set value of ${simpleAtom}`],
      [`initialized value of ${simpleAtom} to 0`, { value: 0 }],
      [`changed value of ${simpleAtom} from 0 to 1`, { oldValue: 0, newValue: 1 }],
    ]);
  });
});
