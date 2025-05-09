import { atom } from 'jotai';
import { type Atom, createStore } from 'jotai/vanilla';
import { loadable } from 'jotai/vanilla/utils';
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

import {
  bindAtomsLoggerToStore,
  isAtomsLoggerBoundToStore,
} from '../src/bind-atoms-logger-to-store.js';
import { ATOMS_LOGGER_SYMBOL } from '../src/consts/atom-logger-symbol.js';
import type { AtomsLoggerOptions, Store } from '../src/types/atoms-logger.js';

let mockDate: MockInstance;

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  vi.stubEnv('TZ', 'UTC');
  mockDate = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(() => '00:00:00');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  mockDate.mockRestore();
});

describe('bindAtomsLoggerToStore', () => {
  let store: ReturnType<typeof createStore>;
  let consoleMock: {
    log: Mock;
    group: Mock;
    groupEnd: Mock;
    groupCollapsed: Mock;
  };
  let defaultOptions: AtomsLoggerOptions;

  beforeEach(() => {
    store = createStore();
    consoleMock = {
      log: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
      groupCollapsed: vi.fn(),
    };
    defaultOptions = {
      logger: consoleMock,
      groupLogs: false,
      plainTextOutput: true,
      showTransactionElapsedTime: false,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('store', () => {
    it('should bind the logger to the store', () => {
      expect(isAtomsLoggerBoundToStore(store)).toBeFalsy();
      bindAtomsLoggerToStore(store, defaultOptions);
      expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
    });

    it('should override store methods', () => {
      const originalGet = store.get;
      const originalSet = store.set;
      const originalSub = store.sub;

      bindAtomsLoggerToStore(store, defaultOptions);

      expect(store.get).not.toBe(originalGet);
      expect(store.set).not.toBe(originalSet);
      expect(store.sub).not.toBe(originalSub);

      expect(store[ATOMS_LOGGER_SYMBOL].prevStoreGet).toBe(originalGet);
      expect(store[ATOMS_LOGGER_SYMBOL].prevStoreSet).toBe(originalSet);
      expect(store[ATOMS_LOGGER_SYMBOL].prevStoreSub).toBe(originalSub);
    });

    it('should call original store methods', () => {
      store.get = vi.fn(store.get) as Store['get'];
      store.set = vi.fn(store.set) as Store['set'];
      store.sub = vi.fn(store.sub) as Store['sub'];

      const originalGet = store.get;
      const originalSet = store.set;
      const originalSub = store.sub;

      bindAtomsLoggerToStore(store, defaultOptions);

      const testAtom = atom(42);

      store.get(testAtom);
      expect(originalGet).toHaveBeenCalledWith(testAtom);

      store.set(testAtom, 43);
      expect(originalSet).toHaveBeenCalledWith(testAtom, 43);

      const listener = vi.fn();
      store.sub(testAtom, listener);
      expect(originalSub).toHaveBeenCalledWith(testAtom, listener);
    });
  });

  describe('debugLabel', () => {
    it('should log atoms without debug labels', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const testAtom = atom(42);

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of atom${atomNumber}`],
        [`initialized value of atom${atomNumber} to 42`, { value: 42 }],
      ]);
    });

    it('should log atoms with debug labels', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const testAtom = atom(42);
      testAtom.debugLabel = 'Test Atom';

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of atom${atomNumber}:Test Atom`],
        [`initialized value of atom${atomNumber}:Test Atom to 42`, { value: 42 }],
      ]);
    });
  });

  describe('options', () => {
    it('should respect custom options', () => {
      const customOptions = {
        enabled: false,
        shouldShowPrivateAtoms: true,
        stringifyLimit: 100,
        logger: consoleMock,
        groupLogs: false,
        collapseEvents: false,
        enableDebugMode: true,
      };

      bindAtomsLoggerToStore(store, customOptions);

      expect(store[ATOMS_LOGGER_SYMBOL].enabled).toBe(false);
      expect(store[ATOMS_LOGGER_SYMBOL].shouldShowPrivateAtoms).toBe(true);
      expect(store[ATOMS_LOGGER_SYMBOL].stringifyLimit).toBe(100);
      expect(store[ATOMS_LOGGER_SYMBOL].logger).toBe(consoleMock);
      expect(store[ATOMS_LOGGER_SYMBOL].groupLogs).toBe(false);
      expect(store[ATOMS_LOGGER_SYMBOL].collapseEvents).toBe(false);
      expect(store[ATOMS_LOGGER_SYMBOL].enableDebugMode).toBe(true);
    });

    describe('enabled', () => {
      it('should log atom interactions when enabled', () => {
        bindAtomsLoggerToStore(store, defaultOptions);

        const testAtom = atom(42);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 42`, { value: 42 }],
        ]);
      });

      it('should not log atom interactions when disabled', () => {
        bindAtomsLoggerToStore(store, { enabled: false, logger: consoleMock });

        const testAtom = atom(42);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log).not.toHaveBeenCalled();
      });
    });

    describe('shouldShowAtom', () => {
      it('should respect shouldShowAtom option', () => {
        const shouldShowAtom = (a: Atom<unknown>) => a === testAtom1;
        bindAtomsLoggerToStore(store, { ...defaultOptions, shouldShowAtom });

        const testAtom1 = atom(1);
        const testAtom2 = atom(2);

        store.get(testAtom1);
        vi.runAllTimers();

        expect(consoleMock.log).toHaveBeenCalled();
        consoleMock.log.mockClear();

        store.get(testAtom2);
        vi.runAllTimers();

        expect(consoleMock.log).not.toHaveBeenCalled();
      });
    });

    describe('shouldShowPrivateAtoms', () => {
      it('should not log private atoms by default', () => {
        bindAtomsLoggerToStore(store, defaultOptions);

        const privateAtom = atom(0);
        privateAtom.debugPrivate = true;

        const publicAtom = atom(1);
        publicAtom.debugLabel = 'Public Atom';

        store.get(privateAtom);
        store.get(publicAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${publicAtom}`],
          [`initialized value of ${publicAtom} to 1`, { value: 1 }],
        ]);
      });

      it('should log private atoms when shouldShowPrivateAtoms is true', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          shouldShowPrivateAtoms: true,
        });

        const privateAtom = atom(0);
        privateAtom.debugPrivate = true;
        privateAtom.debugLabel = 'Private Atom';

        const publicAtom = atom(1);
        publicAtom.debugLabel = 'Public Atom';

        store.get(privateAtom);
        store.get(publicAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${privateAtom}`],
          [`initialized value of ${privateAtom} to 0`, { value: 0 }],

          [`transaction 2 : retrieved value of ${publicAtom}`],
          [`initialized value of ${publicAtom} to 1`, { value: 1 }],
        ]);
      });
    });

    describe('showTransactionNumber', () => {
      it('should not log transaction numbers when showTransactionNumber is disabled', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionNumber: false,
        });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });
    });

    describe('showTransactionElapsedTime', () => {
      it('should log elapsed time when showTransactionElapsedTime is enabled', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionElapsedTime: true,
        });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 - 250.00 ms : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });

      it('should not log elapsed time when showTransactionElapsedTime is disabled', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionElapsedTime: false,
        });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });
    });

    describe('showTransactionLocaleTime', () => {
      it('should log timestamps when showTransactionLocaleTime is enabled', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionLocaleTime: true,
        });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 - 00:00:00 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });

      it('should not log timestamps when showTransactionLocaleTime is disabled', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionLocaleTime: false,
        });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });

      it('should log timestamps and elapsed time when both options are enabled', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionElapsedTime: true,
          showTransactionLocaleTime: true,
        });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 - 00:00:00 - 250.00 ms : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });
    });

    describe('indentSpaces', () => {
      it('should log indentation when `indentSpaces` is set to a value greater than 0', () => {
        bindAtomsLoggerToStore(store, { ...defaultOptions, indentSpaces: 2 });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
          [`  initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });

      it('should not log indentation when `indentSpaces` is set to 0', () => {
        bindAtomsLoggerToStore(store, { ...defaultOptions, indentSpaces: 0 });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });

      it('should log group indentation when `indentSpaces` is set to a value greater than 0', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          indentSpaces: 3,
          groupLogs: true,
        });

        const testAtom = atom(0);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.group.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
        ]);
        expect(consoleMock.groupCollapsed.mock.calls).toEqual([
          [`   initialized value of ${testAtom} to 0`],
        ]);
        expect(consoleMock.log.mock.calls).toEqual([['      value', 0]]);
        expect(consoleMock.groupEnd.mock.calls).toEqual([[], []]);
      });
    });

    describe('stringifyLimit', () => {
      it('should truncate atom values with stringifyLimit', () => {
        bindAtomsLoggerToStore(store, { ...defaultOptions, stringifyLimit: 5 });

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
        bindAtomsLoggerToStore(store, { ...defaultOptions });

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
        bindAtomsLoggerToStore(store, { ...defaultOptions, stringifyLimit: 0 });

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
  });

  describe('promises', () => {
    it('should log promise states', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const promiseAtom = atom(() => {
        return new Promise((resolve) =>
          setTimeout(() => {
            resolve(42);
          }, 0),
        );
      });

      void store.get(promiseAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${promiseAtom}`],
        [`pending initial promise of ${promiseAtom}`],
        [`resolved initial promise of ${promiseAtom} to 42`, { value: 42 }],
      ]);
    });

    it('should log rejected promises', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const myError = new Error('Promise rejected');
      const promiseAtom = atom(() => {
        return new Promise((_, reject) =>
          setTimeout(() => {
            reject(myError);
          }, 0),
        );
      });

      const promise = store.get(promiseAtom);

      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow('Promise rejected');

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${promiseAtom}`],
        [`pending initial promise of ${promiseAtom}`],
        [
          `rejected initial promise of ${promiseAtom} to [Error: Promise rejected]`,
          { error: myError },
        ],
      ]);
    });

    it('should log aborted promises', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const dependencyAtom = atom('first');
      const promiseAtom = atom(async (get, { signal }) => {
        const dependency = get(dependencyAtom);
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(dependency);
          }, 1000);
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Promise aborted'));
          });
        });
      });

      const beforePromise = store.get(promiseAtom);

      await vi.advanceTimersByTimeAsync(250);

      store.set(dependencyAtom, 'second'); // Change the dependency before the promise resolves

      const afterPromise = store.get(promiseAtom);

      await vi.advanceTimersByTimeAsync(1250);

      await expect(beforePromise).rejects.toEqual(new Error('Promise aborted'));
      await expect(afterPromise).resolves.toBe('second');

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${promiseAtom}`],
        [
          `initialized value of ${dependencyAtom} to "first"`,
          { pendingPromises: [`${promiseAtom}`], value: 'first' },
        ],
        [`pending initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],

        [`transaction 2 : set value of ${dependencyAtom} to "second"`, { value: 'second' }],
        [
          `changed value of ${dependencyAtom} from "first" to "second"`,
          {
            newValue: 'second',
            oldValue: 'first',
            pendingPromises: [`${promiseAtom}`],
          },
        ],
        [`aborted initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],
        [`pending initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],

        [`transaction 3 : resolved promise of ${promiseAtom}`],
        [
          `resolved initial promise of ${promiseAtom} to "second"`,
          { dependencies: [`${dependencyAtom}`], value: 'second' },
        ],
      ]);
    });

    it('should log atom promise changes', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const testAtom = atom<unknown>(0);

      store.sub(testAtom, () => {
        // This is a no-op, but we need to call it to trigger the promise state change
      });

      // initial promise resolved
      const promise1 = Promise.resolve(1);
      store.set(testAtom, promise1);
      await vi.advanceTimersByTimeAsync(0);

      // changed promise resolved
      const promise2 = Promise.resolve(2);
      store.set(testAtom, promise2);
      await vi.advanceTimersByTimeAsync(0);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
        [`mounted ${testAtom}`, { value: 0 }],

        [`transaction 2 : set value of ${testAtom} to [Promise]`, { value: promise1 }],
        [`pending promise of ${testAtom} from 0`, { oldValue: 0 }],
        [`resolved promise of ${testAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],

        [`transaction 3 : set value of ${testAtom} to [Promise]`, { value: promise2 }],
        [`pending promise of ${testAtom} from 1`, { oldValue: 1 }],
        [`resolved promise of ${testAtom} from 1 to 2`, { newValue: 2, oldValue: 1 }],
      ]);
    });
  });

  describe('errors', () => {
    it('should log custom errors', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

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
          `rejected initial promise of ${promiseAtom} to [RangeError: Custom error message]`,
          { error: customError },
        ],
      ]);
    });
  });

  describe('changes', () => {
    it('should log atom value changes', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

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
      bindAtomsLoggerToStore(store, defaultOptions);

      const valueTypeAtom = atom<'value' | 'resolve' | 'reject'>('resolve');
      valueTypeAtom.debugPrivate = true;

      let count = 0;
      const promiseAtom = atom<Promise<number>>(async (get) => {
        count += 1;
        const type = get(valueTypeAtom);
        if (type === 'value') {
          return count;
        } else if (type === 'reject') {
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
          `rejected promise of ${promiseAtom} from 2 to [Error: 3]`,
          { oldValue: 2, error: new Error('3') },
        ],

        // promise reject -> promise resolve
        ['transaction 4'],
        [`pending promise of ${promiseAtom} from [Error: 3]`, { oldError: new Error('3') }],
        [
          `resolved promise of ${promiseAtom} from [Error: 3] to 4`,
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
          `rejected promise of ${promiseAtom} from 5 to [Error: 6]`,
          { oldValue: 5, error: new Error('6') },
        ],

        // promise reject -> value
        ['transaction 7'],
        [`pending promise of ${promiseAtom} from [Error: 6]`, { oldError: new Error('6') }],
        [
          `resolved promise of ${promiseAtom} from [Error: 6] to 7`,
          { oldError: new Error('6'), value: 7 },
        ],
      ]);
    });
  });

  describe('dependencies', () => {
    it('should log dependencies', () => {
      bindAtomsLoggerToStore(store, defaultOptions);
      const valueAtom = atom(1);
      const multiplyAtom = atom(2);
      const resultAtom = atom((get) => get(valueAtom) * get(multiplyAtom));
      store.sub(resultAtom, vi.fn());
      store.set(valueAtom, 2);
      vi.runAllTimers();
      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${resultAtom}`],
        [
          `initialized value of ${valueAtom} to 1`,
          { mountedDependents: [`${resultAtom}`], value: 1 },
        ],
        [
          `initialized value of ${multiplyAtom} to 2`,
          { mountedDependents: [`${resultAtom}`], value: 2 },
        ],
        [
          `initialized value of ${resultAtom} to 2`,
          {
            dependencies: [`${valueAtom}`, `${multiplyAtom}`],
            mountedDependencies: [`${valueAtom}`, `${multiplyAtom}`],
            value: 2,
          },
        ],
        [`mounted ${valueAtom}`, { mountedDependents: [`${resultAtom}`], value: 1 }],
        [`mounted ${multiplyAtom}`, { mountedDependents: [`${resultAtom}`], value: 2 }],
        [
          `mounted ${resultAtom}`,
          {
            dependencies: [`${valueAtom}`, `${multiplyAtom}`],
            mountedDependencies: [`${valueAtom}`, `${multiplyAtom}`],
            value: 2,
          },
        ],
        [`transaction 2 : set value of ${valueAtom} to 2`, { value: 2 }],
        [
          `changed value of ${valueAtom} from 1 to 2`,
          { mountedDependents: [`${resultAtom}`], newValue: 2, oldValue: 1 },
        ],
        [
          `changed value of ${resultAtom} from 2 to 4`,
          {
            dependencies: [`${valueAtom}`, `${multiplyAtom}`],
            mountedDependencies: [`${valueAtom}`, `${multiplyAtom}`],
            newValue: 4,
            oldValue: 2,
          },
        ],
      ]);
    });

    it('should not log dependencies if the only dependencies are private', () => {
      bindAtomsLoggerToStore(store, defaultOptions);
      const privateAtom = atom(0);
      privateAtom.debugPrivate = true;
      const publicAtom = atom((get) => get(privateAtom) + 1);
      store.get(publicAtom);
      vi.runAllTimers();
      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${publicAtom}`],
        [`initialized value of ${publicAtom} to 1`, { value: 1 }],
      ]);
    });
  });

  describe('dependents', () => {
    it('should not log dependents when not mounted', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const aAtom = atom(1);
      const bAtom = atom((get) => get(aAtom) * 2);

      store.get(bAtom); // store.get does not mount the atom

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${bAtom}`],
        [`initialized value of ${aAtom} to 1`, { value: 1 }],
        [`initialized value of ${bAtom} to 2`, { dependencies: [`${aAtom}`], value: 2 }],
      ]);
    });

    it('should log dependents when mounted', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const aAtom = atom(1);
      const bAtom = atom((get) => get(aAtom) * 2);

      store.sub(bAtom, vi.fn()); // store.sub mounts the atom

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${bAtom}`],
        [`initialized value of ${aAtom} to 1`, { value: 1, mountedDependents: [`${bAtom}`] }],
        [
          `initialized value of ${bAtom} to 2`,
          {
            value: 2,
            mountedDependencies: [`${aAtom}`],
            dependencies: [`${aAtom}`],
          },
        ],
        [`mounted ${aAtom}`, { value: 1, mountedDependents: [`${bAtom}`] }],
        [
          `mounted ${bAtom}`,
          {
            value: 2,
            dependencies: [`${aAtom}`],
            mountedDependencies: [`${aAtom}`],
          },
        ],
      ]);
    });

    it('should log dependents after dependent is initialized', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const firstAtom = atom('first');
      const secondAtom = atom('second');
      const resultAtom = atom((get) => get(firstAtom) + ' ' + get(secondAtom));

      // secondAtom doesn't have yet dependents yet since resultAtom is not mounted yet
      store.get(secondAtom);

      // secondAtom should have dependents now
      store.sub(resultAtom, vi.fn());

      // change his value to trigger the log
      store.set(secondAtom, '2nd');

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${secondAtom}`],
        [`initialized value of ${secondAtom} to "second"`, { value: 'second' }],

        [`transaction 2 : subscribed to ${resultAtom}`],
        [
          `initialized value of ${firstAtom} to "first"`,
          { mountedDependents: [`${resultAtom}`], value: 'first' },
        ],
        [
          `initialized value of ${resultAtom} to "first second"`,
          {
            dependencies: [`${firstAtom}`, `${secondAtom}`],
            mountedDependencies: [`${firstAtom}`, `${secondAtom}`],
            value: 'first second',
          },
        ],
        [`mounted ${firstAtom}`, { mountedDependents: [`${resultAtom}`], value: 'first' }],
        [`mounted ${secondAtom}`, { mountedDependents: [`${resultAtom}`], value: 'second' }],
        [
          `mounted ${resultAtom}`,
          {
            dependencies: [`${firstAtom}`, `${secondAtom}`],
            mountedDependencies: [`${firstAtom}`, `${secondAtom}`],
            value: 'first second',
          },
        ],

        [`transaction 3 : set value of ${secondAtom} to "2nd"`, { value: '2nd' }],
        [
          `changed value of ${secondAtom} from "second" to "2nd"`,
          {
            mountedDependents: [`${resultAtom}`], // here he is
            newValue: '2nd',
            oldValue: 'second',
          },
        ],
        [
          `changed value of ${resultAtom} from "first second" to "first 2nd"`,
          {
            dependencies: [`${firstAtom}`, `${secondAtom}`],
            mountedDependencies: [`${firstAtom}`, `${secondAtom}`],
            newValue: 'first 2nd',
            oldValue: 'first second',
          },
        ],
      ]);
    });
  });

  describe('transactions', () => {
    it('should log transactions details triggered by public atoms', () => {
      bindAtomsLoggerToStore(store, defaultOptions);
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
      bindAtomsLoggerToStore(store, defaultOptions);
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
  });

  describe('mounting', () => {
    it('should log mounted and unmounted atoms', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

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
  });

  describe('setters', () => {
    it('should log default atom setter', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const simpleAtom = atom(0);
      store.set(simpleAtom, 1);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : set value of ${simpleAtom} to 1`, { value: 1 }],
        [`initialized value of ${simpleAtom} to 1`, { value: 1 }],
      ]);
    });

    it('should log custom atom setter', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

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
          `transaction 4 : called set of ${threeSetAtom} returned "myReturnValue-3"`,
          { result: 'myReturnValue-3' },
        ],
        [`changed value of ${valueAtom} from 2 to 3`, { newValue: 3, oldValue: 2 }],

        [
          `transaction 5 : called set of ${fourSetAtom} with [{"newValue":4},"otherArg"] returned "myOtherReturnValue-4-otherArg"`,
          {
            args: [{ newValue: 4 }, 'otherArg'],
            result: 'myOtherReturnValue-4-otherArg',
          },
        ],
        [`changed value of ${valueAtom} from 3 to 4`, { newValue: 4, oldValue: 3 }],
      ]);
    });

    it('should log default atom setter with previous state function', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

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

  describe('complex graphs', () => {
    it('should log async atoms with dependencies and dependents', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const firstAtom = atom('first');
      const secondAtom = atom('second');
      const thirdAsyncAtom = atom<Promise<string>>(async (get) => {
        const third = get(firstAtom) + ' ' + 'third';
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(third);
          }, 500);
        });
      });

      const resultAtom = atom((get) => {
        const second = get(secondAtom);
        const third = get(loadable(thirdAsyncAtom));
        return `${second} ${third.state === 'hasData' ? third.data : third.state}`;
      });

      store.sub(resultAtom, vi.fn());

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${resultAtom}`],

        [
          // result <-- second
          `initialized value of ${secondAtom} to "second"`,
          { mountedDependents: [`${resultAtom}`], value: 'second' },
        ],
        [
          // result <-- loadable(thirdAsync) <-- thirdAsync <-- first
          `initialized value of ${firstAtom} to "first"`,
          {
            mountedDependents: [`${thirdAsyncAtom}`],
            pendingPromises: [`${thirdAsyncAtom}`],
            value: 'first',
          },
        ],
        [
          // result <-- loadable(thirdAsync) <-- thirdAsync
          `pending initial promise of ${thirdAsyncAtom}`,
          {
            dependencies: [`${firstAtom}`],
            mountedDependencies: [`${firstAtom}`],
          },
        ],
        [
          // result <-- loadable(thirdAsync)
          `initialized value of ${loadable(thirdAsyncAtom)} to {"state":"loading"}`,
          { mountedDependents: [`${resultAtom}`], value: { state: 'loading' } },
        ],
        [
          // result
          `initialized value of ${resultAtom} to "second loading"`,
          {
            dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            mountedDependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            value: 'second loading',
          },
        ],
        [`mounted ${secondAtom}`, { mountedDependents: [`${resultAtom}`], value: 'second' }],
        [
          `mounted ${firstAtom}`,
          {
            mountedDependents: [`${thirdAsyncAtom}`],
            pendingPromises: [`${thirdAsyncAtom}`],
            value: 'first',
          },
        ],
        [
          `mounted ${thirdAsyncAtom}`,
          {
            dependencies: [`${firstAtom}`],
            mountedDependencies: [`${firstAtom}`],
          },
        ],
        [
          `mounted ${loadable(thirdAsyncAtom)}`,
          { mountedDependents: [`${resultAtom}`], value: { state: 'loading' } },
        ],
        [
          `mounted ${resultAtom}`,
          {
            dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            mountedDependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            value: 'second loading',
          },
        ],

        [`transaction 2 : resolved promise of ${thirdAsyncAtom}`],
        [
          // result <-- loadable(thirdAsync) <-- thirdAsync <-- promise resolved
          `resolved initial promise of ${thirdAsyncAtom} to "first third"`,
          {
            dependencies: [`${firstAtom}`],
            mountedDependencies: [`${firstAtom}`],
            value: 'first third',
          },
        ],
        [
          // result <-- loadable(thirdAsync)
          `changed value of ${loadable(thirdAsyncAtom)} from {"state":"loading"} to {"state":"hasData","data":"first third"}`,
          {
            mountedDependents: [`${resultAtom}`],
            newValue: { data: 'first third', state: 'hasData' },
            oldValue: { state: 'loading' },
          },
        ],
        [
          // result
          `changed value of ${resultAtom} from "second loading" to "second first third"`,
          {
            dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            mountedDependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            newValue: 'second first third',
            oldValue: 'second loading',
          },
        ],
      ]);
    });
  });

  describe('colors', () => {
    it('should not log colors if plainTextOutput is true', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        plainTextOutput: true,
      });

      const testAtom = atom(0);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should log colors if plainTextOutput is false', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        plainTextOutput: false,
      });

      const testAtom = atom(0);

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: #0072B2; font-weight: bold;',
          'color: #757575; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
          'color: #0072B2; font-weight: bold;',
          'color: #757575; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          { value: 0 },
        ],
      ]);
    });

    it('should log atom name namespaces with colors', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        plainTextOutput: false,
      });

      const testAtom = atom(0);
      testAtom.debugLabel = 'test/atom/with/namespaces';

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}%c:%ctest%c/%catom%c/%cwith%c/namespaces`,
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: #0072B2; font-weight: bold;',
          'color: #757575; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber}%c:%ctest%c/%catom%c/%cwith%c/namespaces %cto %c0`,
          'color: #0072B2; font-weight: bold;',
          'color: #757575; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #757575; font-weight: normal;',
          'color: default; font-weight: normal;',
          { value: 0 },
        ],
      ]);
    });

    it('should log dark colors with dark colorScheme option', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        plainTextOutput: false,
        colorScheme: 'dark',
      });

      const testAtom = atom(0);

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #999999; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #999999; font-weight: normal;',
          'color: #009EFA; font-weight: bold;',
          'color: #999999; font-weight: normal;',
          'color: #999999; font-weight: normal;',
          'color: default; font-weight: normal;',
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
          'color: #009EFA; font-weight: bold;',
          'color: #999999; font-weight: normal;',
          'color: #999999; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #999999; font-weight: normal;',
          'color: default; font-weight: normal;',
          { value: 0 },
        ],
      ]);
    });

    it('should log light colors with light colorScheme option', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        plainTextOutput: false,
        colorScheme: 'light',
      });

      const testAtom = atom(0);

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #6E6E6E; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #6E6E6E; font-weight: normal;',
          'color: #0072B2; font-weight: bold;',
          'color: #6E6E6E; font-weight: normal;',
          'color: #6E6E6E; font-weight: normal;',
          'color: default; font-weight: normal;',
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
          'color: #0072B2; font-weight: bold;',
          'color: #6E6E6E; font-weight: normal;',
          'color: #6E6E6E; font-weight: normal;',
          'color: default; font-weight: normal;',
          'color: #6E6E6E; font-weight: normal;',
          'color: default; font-weight: normal;',
          { value: 0 },
        ],
      ]);
    });
  });

  describe('groups', () => {
    it('should log groups when groupLogs is true', () => {
      bindAtomsLoggerToStore(store, { ...defaultOptions, groupLogs: true });

      const testAtom = atom(0);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.group.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
      ]);
      expect(consoleMock.groupCollapsed.mock.calls).toEqual([
        [`initialized value of ${testAtom} to 0`],
      ]);
      expect(consoleMock.log.mock.calls).toEqual([['value', 0]]);
      expect(consoleMock.groupEnd.mock.calls).toEqual([[], []]);
    });

    it('should collapse transaction groups if collapseTransactions is true', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        groupLogs: true,
        collapseTransactions: true,
      });

      const testAtom = atom(0);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.group.mock.calls).toEqual([]);
      expect(consoleMock.groupCollapsed.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`],
      ]);
      expect(consoleMock.log.mock.calls).toEqual([['value', 0]]);
      expect(consoleMock.groupEnd.mock.calls).toEqual([[], []]);
    });

    it('should not collapse event groups if collapseEvents is false', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        groupLogs: true,
        collapseEvents: false,
      });

      const testAtom = atom(0);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.group.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`],
      ]);
      expect(consoleMock.groupCollapsed.mock.calls).toEqual([]);
      expect(consoleMock.log.mock.calls).toEqual([['value', 0]]);
      expect(consoleMock.groupEnd.mock.calls).toEqual([[], []]);
    });

    it('should log additional transaction group', () => {
      bindAtomsLoggerToStore(store, { ...defaultOptions, groupLogs: true });

      const testAtom = atom(0);
      store.set(testAtom, 1);

      vi.runAllTimers();

      expect(consoleMock.group.mock.calls).toEqual([
        [`transaction 1 : set value of ${testAtom} to 1`, { value: 1 }],
      ]);
      expect(consoleMock.groupCollapsed.mock.calls).toEqual([
        [`initialized value of ${testAtom} to 1`],
      ]);
      expect(consoleMock.log.mock.calls).toEqual([['value', 1]]);
      expect(consoleMock.groupEnd.mock.calls).toEqual([[], []]);
    });

    it('should log collapsed groups even if logger.group is not defined', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        groupLogs: true,
        logger: {
          log: consoleMock.log,
          group: undefined,
          groupCollapsed: consoleMock.groupCollapsed,
          groupEnd: consoleMock.groupEnd,
        },
        collapseTransactions: true,
        collapseEvents: true,
      });

      const testAtom = atom(0);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.group.mock.calls).toEqual([]);
      expect(consoleMock.groupCollapsed.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`],
      ]);
      expect(consoleMock.log.mock.calls).toEqual([['value', 0]]);
      expect(consoleMock.groupEnd.mock.calls).toEqual([[], []]);
    });

    it('should log groups even if logger.groupCollapsed is not defined', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        groupLogs: true,
        logger: {
          log: consoleMock.log,
          group: consoleMock.group,
          groupCollapsed: undefined,
          groupEnd: consoleMock.groupEnd,
        },
        collapseTransactions: false,
        collapseEvents: false,
      });

      const testAtom = atom(0);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.group.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`],
      ]);
      expect(consoleMock.groupCollapsed.mock.calls).toEqual([]);
      expect(consoleMock.log.mock.calls).toEqual([['value', 0]]);
      expect(consoleMock.groupEnd.mock.calls).toEqual([[], []]);
    });

    it('should not log groups if logger.groupEnd is not defined', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        groupLogs: true,
        logger: {
          log: consoleMock.log,
          group: consoleMock.group,
          groupCollapsed: consoleMock.groupCollapsed,
          groupEnd: undefined,
        },
      });

      const testAtom = atom(0);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.group.mock.calls).toEqual([]);
      expect(consoleMock.groupCollapsed.mock.calls).toEqual([]);
      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
      ]);
      expect(consoleMock.groupEnd.mock.calls).toEqual([]);
    });
  });

  it.todo('should log destroyed atoms'); // Don't really know how to test this since it is based on FinalizationRegistry
});
