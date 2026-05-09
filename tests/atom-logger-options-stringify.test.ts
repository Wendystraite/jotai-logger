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

  describe('stringifyLimit', () => {
    it('should truncate atom values with stringifyLimit', () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, stringifyLimit: 5 }),
      });

      const testAtom = atom({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
      store.get(testAtom);
      store.set(testAtom, { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [
          `initialized value of ${testAtom} to {"a":…`,
          { value: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 } },
        ],
        [
          `transaction 2 : set value of ${testAtom} to {"a":…`,
          { value: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 } },
        ],
        [
          `changed value of ${testAtom} from {"a":… to {"a":…`,
          {
            oldValue: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
            newValue: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
          },
        ],
      ]);
    });

    it('should truncate atom values by default', () => {
      store = createLoggedStore(store, { ...defaultOptions });

      const value = Array.from({ length: 60 }, () => 'a').join('');
      const testAtom = atom(value);
      store.get(testAtom);

      vi.runAllTimers();

      const expected = '"' + Array.from({ length: 49 }, () => 'a').join('') + '…';

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to ${expected}`, { value: value }],
      ]);
    });

    it('should not truncate atom values when stringifyLimit is 0', () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, stringifyLimit: 0 }),
      });

      const value = Array.from({ length: 60 }, () => 'a').join('');
      const testAtom = atom(value);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to "${value}"`, { value: value }],
      ]);
    });
  });

  describe('stringifyValues', () => {
    const testAtom = atom({ foo: 'bar' } as unknown);
    const setTestAtom = atom(null, (get, set, newValue: unknown) => {
      set(testAtom, newValue);
      return 'something';
    });

    it('should stringify values when stringifyValues is true and formattedOutput is false', () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({
          ...defaultFormatterOptions,
          formattedOutput: false,
          stringifyValues: true,
        }),
      });

      store.get(testAtom);
      store.set(setTestAtom, { fizz: 'buzz' });

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to {"foo":"bar"}`, { value: { foo: 'bar' } }],
        [
          `transaction 2 : called set of ${setTestAtom} with {"fizz":"buzz"} and returned "something"`,
          { args: [{ fizz: 'buzz' }], result: 'something' },
        ],
        [
          `changed value of ${testAtom} from {"foo":"bar"} to {"fizz":"buzz"}`,
          { newValue: { fizz: 'buzz' }, oldValue: { foo: 'bar' } },
        ],
      ]);
    });

    it('should stringify values with colors when stringifyValues is true and formattedOutput is true', () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({
          ...defaultFormatterOptions,
          formattedOutput: true,
          stringifyValues: true,
        }),
      });

      const testAtomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
      const setTestAtomNumber = /atom(\d+)(.*)/.exec(setTestAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(testAtomNumber!))).toBeTruthy();
      expect(Number.isInteger(parseInt(setTestAtomNumber!))).toBeTruthy();

      store.get(testAtom);
      store.set(setTestAtom, { fizz: 'buzz' });

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${testAtomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
        ],
        [
          `%cinitialized value %cof %catom%c${testAtomNumber} %cto %c{"foo":"bar"}`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // {"foo":"bar"}
          { value: { foo: 'bar' } },
        ],
        [
          `%ctransaction %c2 %c: %ccalled set %cof %catom%c${setTestAtomNumber} %cwith %c{"fizz":"buzz"} %cand returned %c"something"`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 2
          'color: #757575; font-weight: normal;', // :
          'color: #E69F00; font-weight: bold;', // called set
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 2
          'color: #757575; font-weight: normal;', // with
          'color: default; font-weight: normal;', // {"fizz":"buzz"}
          'color: #757575; font-weight: normal;', // and returned
          'color: default; font-weight: normal;', // "something"
          { args: [{ fizz: 'buzz' }], result: 'something' },
        ],
        [
          `%cchanged value %cof %catom%c${testAtomNumber} %cfrom %c{"foo":"bar"} %cto %c{"fizz":"buzz"}`,
          'color: #56B4E9; font-weight: bold;', // changed value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // from
          'color: default; font-weight: normal;', // {"foo":"bar"}
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // {"fizz":"buzz"}
          { newValue: { fizz: 'buzz' }, oldValue: { foo: 'bar' } },
        ],
      ]);
    });

    it('should log values as is when stringifyValues is false and formattedOutput is false', () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({
          ...defaultFormatterOptions,
          formattedOutput: false,
          stringifyValues: false,
        }),
      });

      store.get(testAtom);
      store.set(setTestAtom, { fizz: 'buzz' });

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to`, { foo: 'bar' }],
        [
          `transaction 2 : called set of ${setTestAtom} with`,
          { fizz: 'buzz' },
          `and returned something`,
        ],
        [`changed value of ${testAtom} from`, { foo: 'bar' }, `to`, { fizz: 'buzz' }],
      ]);
    });

    it('should log values using string substitution and colors when stringifyValues is false and formattedOutput is true', () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({
          ...defaultFormatterOptions,
          formattedOutput: true,
          stringifyValues: false,
        }),
      });

      const testAtomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
      const setTestAtomNumber = /atom(\d+)(.*)/.exec(setTestAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(testAtomNumber!))).toBeTruthy();
      expect(Number.isInteger(parseInt(setTestAtomNumber!))).toBeTruthy();

      store.get(testAtom);
      store.set(setTestAtom, { fizz: 'buzz' });

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${testAtomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
        ],
        [
          `%cinitialized value %cof %catom%c${testAtomNumber} %cto %c%o`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // {"foo":"bar"}
          { foo: 'bar' },
        ],
        [
          `%ctransaction %c2 %c: %ccalled set %cof %catom%c${setTestAtomNumber} %cwith %c%o %cand returned %c%o`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 2
          'color: #757575; font-weight: normal;', // :
          'color: #E69F00; font-weight: bold;', // called set
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 2
          'color: #757575; font-weight: normal;', // with
          'color: default; font-weight: normal;', // {"fizz":"buzz"}
          { fizz: 'buzz' },
          'color: #757575; font-weight: normal;', // and returned
          'color: default; font-weight: normal;', // "something"
          'something',
        ],
        [
          `%cchanged value %cof %catom%c${testAtomNumber} %cfrom %c%o %cto %c%o`,
          'color: #56B4E9; font-weight: bold;', // changed value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // from
          'color: default; font-weight: normal;', // {"foo":"bar"}
          { foo: 'bar' },
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // {"fizz":"buzz"}
          { fizz: 'buzz' },
        ],
      ]);
    });
  });

  describe('stringify', () => {
    it('should use stringify function when provided', () => {
      const customStringify = (value: unknown) => {
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value, null, 2);
        }
        return String(value);
      };

      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, stringify: customStringify }),
      });

      const testAtom = atom({ foo: 'bar' });
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to {\n  "foo": "bar"\n}`, { value: { foo: 'bar' } }],
      ]);
    });

    it('should catch errors of the custom stringify function', () => {
      const customStringify = () => {
        throw new Error('Custom stringify error');
      };

      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, stringify: customStringify }),
      });

      const testAtom = atom({ foo: 'bar' });
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to [Unknown]`, { value: { foo: 'bar' } }],
      ]);
    });

    it('should truncate values when using custom stringify function', () => {
      const customStringify = String;

      store = createLoggedStore(store, {
        formatter: consoleFormatter({
          ...defaultFormatterOptions,
          stringify: customStringify,
          stringifyLimit: 5,
        }),
      });

      const testAtom = atom('1234567890');
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 12345…`, { value: '1234567890' }],
      ]);
    });

    it("should not crash if stringify doesn't returns a string", () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({
          ...defaultFormatterOptions,
          stringify: () => ({ foo: 'bar' }) as unknown as string,
        }),
      });

      const testAtom = atom(42);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to [Unknown]`, { value: 42 }],
      ]);
    });
  });
});
