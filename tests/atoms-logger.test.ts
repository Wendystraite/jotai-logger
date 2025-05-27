import { atom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { createStore } from 'jotai/vanilla';
import { INTERNAL_buildStoreRev1, INTERNAL_getBuildingBlocksRev1 } from 'jotai/vanilla/internals';
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

import { isAtomsLoggerBoundToStore } from '../src/bind-atoms-logger-to-store.js';
import { ATOMS_LOGGER_SYMBOL } from '../src/consts/atom-logger-symbol.js';
import { type AtomsLoggerOptions, bindAtomsLoggerToStore } from '../src/index.js';
import type { AnyAtom, AtomId, Store, StoreWithAtomsLogger } from '../src/types/atoms-logger.js';
import { isDevtoolsStore } from '../src/utils/get-internal-building-blocks.js';

let mockDate: MockInstance;

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  vi.stubEnv('TZ', 'UTC');
  mockDate = vi
    .spyOn(Date.prototype, 'toLocaleTimeString')
    .mockImplementation(function toLocaleTimeStringMock(this: Date) {
      return this.toISOString();
    });
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
      formattedOutput: false,
      showTransactionElapsedTime: false,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('store', () => {
    it('jotai-devtools should not create a dev store when calling createStore', () => {
      // Just to be sure that the test file is not running with a devtools store
      expect(isDevtoolsStore(createStore())).toBeFalsy();
    });

    it('should bind the logger to the store', () => {
      expect(isAtomsLoggerBoundToStore(store)).toBeFalsy();
      expect(bindAtomsLoggerToStore(store, defaultOptions)).toBe(true);
      expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
      expect(consoleMock.log.mock.calls).toEqual([]);
    });

    it('should not bind the logger to the store if the store does not contain jotai internal building blocks', () => {
      const fakeStore: Store = {
        get() {
          throw new Error('Function not implemented.');
        },
        set() {
          throw new Error('Function not implemented.');
        },
        sub() {
          throw new Error('Function not implemented.');
        },
      };
      expect(bindAtomsLoggerToStore(fakeStore, defaultOptions)).toBe(false);
      expect(consoleMock.log.mock.calls).toEqual([
        [
          'Fail to bind atoms logger to',
          fakeStore,
          ':',
          new Error('internal jotai building blocks not found'),
        ],
      ]);
    });

    it('should bind the logger to a store with a custom symbol for internal building blocks', () => {
      const customSymbol = Symbol();
      const store = INTERNAL_buildStoreRev1();
      const buildingBlocks = INTERNAL_getBuildingBlocksRev1(store);
      const customStore = { ...store, [customSymbol]: buildingBlocks };

      // INTERNAL_getBuildingBlocksRev1 should not work with the custom symbol
      expect(INTERNAL_getBuildingBlocksRev1(store)).toBeDefined();
      expect(INTERNAL_getBuildingBlocksRev1(customStore)).toEqual(undefined);

      // But bindAtomsLoggerToStore should work
      expect(bindAtomsLoggerToStore(customStore, defaultOptions)).toBe(true);
    });

    it("should still work if the bound store doesn't have its internal building blocks", () => {
      const customSymbol = Symbol();
      const store = INTERNAL_buildStoreRev1();
      const buildingBlocks = INTERNAL_getBuildingBlocksRev1(store);
      const customStore = { ...store, [customSymbol]: buildingBlocks };

      // INTERNAL_getBuildingBlocksRev1 should not work with the custom symbol
      expect(INTERNAL_getBuildingBlocksRev1(store)).toBeDefined();
      expect(INTERNAL_getBuildingBlocksRev1(customStore)).toEqual(undefined);

      // But bindAtomsLoggerToStore should work
      expect(bindAtomsLoggerToStore(customStore, defaultOptions)).toBe(true);

      // Removes the building blocks from the store
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (customStore as Partial<typeof customStore>)[customSymbol];

      // Should still work
      const testAtom = atom(42);
      store.get(testAtom);
      store.set(testAtom, 43);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1`],
        [`initialized value of ${testAtom} to 42`, { value: 42 }],
        [`changed value of ${testAtom} from 42 to 43`, { newValue: 43, oldValue: 42 }],
      ]);
    });

    it('should override store methods', () => {
      const originalGet = store.get;
      const originalSet = store.set;
      const originalSub = store.sub;

      if (!bindAtomsLoggerToStore(store, defaultOptions)) {
        expect.fail('store should be bound to logger');
      }

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

    it('should not bind the logger to the store if it is already bound', () => {
      expect(isAtomsLoggerBoundToStore(store)).toBeFalsy();
      expect(bindAtomsLoggerToStore(store, defaultOptions)).toBe(true);
      expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
      expect(bindAtomsLoggerToStore(store, defaultOptions)).toBe(true);
      expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
      expect(consoleMock.log.mock.calls).toEqual([]);
    });

    it('should change store options when binding multiple times', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        enabled: true,
        domain: 'hello',
      });

      expect((store as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL]).toEqual(
        expect.objectContaining({ ...defaultOptions, enabled: true, domain: 'hello' }),
      );

      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        enabled: false,
      });

      expect((store as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL]).toEqual(
        expect.objectContaining({ ...defaultOptions, enabled: false, domain: undefined }),
      );
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

    it('should log atoms with a custom toString method', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const testAtom = atom(42);
      testAtom.toString = () => 'Custom Atom';

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of Custom Atom`],
        [`initialized value of Custom Atom to 42`, { value: 42 }],
      ]);
    });

    it('should log atoms with a custom toString method in colors', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
      });

      const testAtom = atom(42);
      testAtom.toString = () => 'Custom Atom';

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %cCustom Atom`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: default; font-weight: normal;', // Custom Atom
        ],
        [
          `%cinitialized value %cof %cCustom Atom %cto %c42`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: default; font-weight: normal;', // Custom Atom
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // 42
          { value: 42 },
        ],
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
      };

      if (!bindAtomsLoggerToStore(store, customOptions)) {
        expect.fail('store should be bound to logger');
      }

      expect(store[ATOMS_LOGGER_SYMBOL].enabled).toBe(false);
      expect(store[ATOMS_LOGGER_SYMBOL].shouldShowPrivateAtoms).toBe(true);
      expect(store[ATOMS_LOGGER_SYMBOL].stringifyLimit).toBe(100);
      expect(store[ATOMS_LOGGER_SYMBOL].logger).toBe(consoleMock);
      expect(store[ATOMS_LOGGER_SYMBOL].groupLogs).toBe(false);
      expect(store[ATOMS_LOGGER_SYMBOL].collapseEvents).toBe(false);
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

      it('should not log atom interactions anymore after disabling', () => {
        bindAtomsLoggerToStore(store, { ...defaultOptions, enabled: true });

        const testAtom = atom(42);

        store.get(testAtom);
        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 42`, { value: 42 }],
        ]);

        vi.clearAllMocks();

        bindAtomsLoggerToStore(store, { ...defaultOptions, enabled: false });

        store.get(testAtom);
        store.set(testAtom, 43);
        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([]);
      });
    });

    describe('shouldShowAtom', () => {
      it('should respect shouldShowAtom option', () => {
        const shouldShowAtom = (a: AnyAtom) => a === testAtom1;
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

      it('should not log transaction when showTransactionNumber, showTransactionElapsedTime and showTransactionLocaleTime are disabled', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionNumber: false,
          showTransactionElapsedTime: false,
          showTransactionLocaleTime: false,
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

      it('should not log elapsed time if endTimestamp is equal to startTimestamp', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionElapsedTime: true,
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
          [`transaction 1 - 1970-01-01T00:00:00.000Z : retrieved value of ${testAtom}`],
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

        const testAtom = atom(() => {
          vi.advanceTimersByTime(234); // Fake the delay of the transaction
          return 0;
        });
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 - 1970-01-01T00:00:00.000Z - 234.00 ms : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
      });

      it('should log timestamps and elapsed time with colors', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          showTransactionElapsedTime: true,
          showTransactionLocaleTime: true,
          formattedOutput: true,
        });

        const testAtom = atom(() => {
          vi.advanceTimersByTime(456); // Fake the delay of the transaction
          return 0;
        });
        store.get(testAtom);

        const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
        expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [
            `%ctransaction %c1 %c- %c1970-01-01T00:00:00.000Z %c- %c456.00 ms %c: %cretrieved value %cof %catom%c${atomNumber}`,
            'color: #757575; font-weight: normal;', // transaction
            'color: default; font-weight: normal;', // 1
            'color: #757575; font-weight: normal;', // -
            'color: #757575; font-weight: normal;', // 1970-01-01T00:00:00.000Z
            'color: #757575; font-weight: normal;', // -
            'color: #757575; font-weight: normal;', // 456.00 ms
            'color: #757575; font-weight: normal;', // :
            'color: #0072B2; font-weight: bold;', // retrieved value
            'color: #757575; font-weight: normal;', // of
            'color: #757575; font-weight: normal;', // atom
            'color: default; font-weight: normal;', // 1
          ],
          [
            `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
            'color: #0072B2; font-weight: bold;', // initialized value
            'color: #757575; font-weight: normal;', // of
            'color: #757575; font-weight: normal;', // atom
            'color: default; font-weight: normal;', // 1
            'color: #757575; font-weight: normal;', // to
            'color: default; font-weight: normal;', // 0
            { value: 0 },
          ],
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

    describe('stringifyValues', () => {
      const testAtom = atom({ foo: 'bar' } as unknown);
      const setTestAtom = atom(null, (get, set, newValue: unknown) => {
        set(testAtom, newValue);
        return 'something';
      });

      it('should stringify values when stringifyValues is true and formattedOutput is false', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          formattedOutput: false,
          stringifyValues: true,
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
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          formattedOutput: true,
          stringifyValues: true,
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
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          formattedOutput: false,
          stringifyValues: false,
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
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          formattedOutput: true,
          stringifyValues: false,
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

        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          stringify: customStringify,
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

        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          stringify: customStringify,
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

        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          stringify: customStringify,
          stringifyLimit: 5,
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
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          stringify: () => ({ foo: 'bar' }) as unknown as string,
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

    describe('domain', () => {
      it('should not log domain when empty', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          domain: '',
        });

        const testAtom = atom(42);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 42`, { value: 42 }],
        ]);
      });

      it('should log domain when set', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          domain: 'test-domain',
        });

        const testAtom = atom(42);
        store.get(testAtom);

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [`test-domain - transaction 1 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 42`, { value: 42 }],
        ]);
      });

      it('should log domain with colors when set', () => {
        bindAtomsLoggerToStore(store, {
          ...defaultOptions,
          formattedOutput: true,
          domain: 'test-domain',
        });

        const testAtom = atom(42);
        store.get(testAtom);

        const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
        expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

        vi.runAllTimers();

        expect(consoleMock.log.mock.calls).toEqual([
          [
            `%ctest-domain %c- %ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
            'color: #757575; font-weight: normal;', // test-domain
            'color: #757575; font-weight: normal;', // -
            'color: #757575; font-weight: normal;', // transaction
            'color: default; font-weight: normal;', // 1
            'color: #757575; font-weight: normal;', // :
            'color: #0072B2; font-weight: bold;', // retrieved value
            'color: #757575; font-weight: normal;', // of
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

      const otherPromiseAtom = atom(() => {
        return new Promise((resolve, reject) =>
          setTimeout(() => {
            reject(new Error('Promise rejected'));
          }, 0),
        );
      });

      void store.get(promiseAtom);

      await vi.advanceTimersByTimeAsync(1000);

      void store.get(otherPromiseAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${promiseAtom}`],
        [`pending initial promise of ${promiseAtom}`],
        [`resolved initial promise of ${promiseAtom} to 42`, { value: 42 }],

        [`transaction 2 : retrieved value of ${otherPromiseAtom}`],
        [`pending initial promise of ${otherPromiseAtom}`],
        [
          `rejected initial promise of ${otherPromiseAtom} to Error: Promise rejected`,
          { error: new Error('Promise rejected') },
        ],
      ]);
    });

    it('should log rejected promises', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const myError = new Error('Promise rejected');
      const promiseAtom = atom(() => {
        return new Promise((_, reject) =>
          setTimeout(() => {
            reject(myError);
          }, 1000),
        );
      });

      const promise = store.get(promiseAtom);

      await vi.advanceTimersByTimeAsync(2000);

      await expect(promise).rejects.toThrow('Promise rejected');

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${promiseAtom}`],
        [`pending initial promise of ${promiseAtom}`],

        [`transaction 2 : rejected promise of ${promiseAtom}`],
        [
          `rejected initial promise of ${promiseAtom} to Error: Promise rejected`,
          { error: myError },
        ],
      ]);
    });

    it('should show promise resolved and rejected in the same transaction if they resolve before the debounce', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const instantPromiseAtom = atom(() => {
        return new Promise((resolve) =>
          setTimeout(() => {
            resolve(42);
          }, 0),
        );
      });

      const instantPromiseRejectedAtom = atom(() => {
        return new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error('Promise rejected'));
          }, 0),
        );
      });

      const slowerPromiseAtom = atom(() => {
        return new Promise((resolve) =>
          setTimeout(() => {
            resolve(42);
          }, 1000),
        );
      });

      const slowerPromiseRejectedAtom = atom(() => {
        return new Promise((resolve, reject) =>
          setTimeout(() => {
            reject(new Error('Promise rejected'));
          }, 1000),
        );
      });

      void store.get(instantPromiseAtom);
      await vi.advanceTimersByTimeAsync(200);

      void store.get(instantPromiseRejectedAtom);
      await vi.advanceTimersByTimeAsync(200);

      void store.get(slowerPromiseAtom);
      void store.get(slowerPromiseRejectedAtom);

      await vi.advanceTimersByTimeAsync(2000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${instantPromiseAtom}`],
        [`pending initial promise of ${instantPromiseAtom}`],
        [`resolved initial promise of ${instantPromiseAtom} to 42`, { value: 42 }], // In first transaction

        [`transaction 2 : retrieved value of ${instantPromiseRejectedAtom}`],
        [`pending initial promise of ${instantPromiseRejectedAtom}`],
        [
          `rejected initial promise of ${instantPromiseRejectedAtom} to Error: Promise rejected`, // In second transaction
          { error: new Error('Promise rejected') },
        ],

        [`transaction 3 : retrieved value of ${slowerPromiseAtom}`],
        [`pending initial promise of ${slowerPromiseAtom}`],

        [`transaction 4 : retrieved value of ${slowerPromiseRejectedAtom}`],
        [`pending initial promise of ${slowerPromiseRejectedAtom}`],

        [`transaction 5 : resolved promise of ${slowerPromiseAtom}`], // In another transaction
        [`resolved initial promise of ${slowerPromiseAtom} to 42`, { value: 42 }],
        [
          `rejected initial promise of ${slowerPromiseRejectedAtom} to Error: Promise rejected`,
          { error: new Error('Promise rejected') },
        ],
      ]);
    });

    it('should show promise resolved in the same transaction if they are waiting for the same async dependency', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const otherAtom = atom(0);
      const doGetOtherAtom = () => {
        store.set(otherAtom, (prev) => prev + 1); // Should not be merged with the previous transaction
      };

      const dep = atom<Promise<number>>(async () => {
        return new Promise((resolve) =>
          setTimeout(() => {
            resolve(42);

            doGetOtherAtom(); // Should not be merged BEFORE the promise transaction
            setTimeout(() => {
              doGetOtherAtom(); // Should not be merged AFTER the promise transaction
            }, 0);
          }, 1000),
        );
      });

      const prom = atomFamily((id: string) =>
        atom((get) => {
          const dependency = get(dep);
          if (dependency instanceof Promise) {
            return dependency;
          }
          return `${id}:${dependency}`;
        }),
      );

      void store.get(prom('1'));
      void store.get(prom('2'));
      void store.get(prom('3'));

      await vi.advanceTimersByTimeAsync(2000);

      expect(consoleMock.log.mock.calls).toEqual([
        // All pending
        [`transaction 1 : retrieved value of ${prom('1')}`],
        [`pending initial promise of ${dep}`],
        [`pending initial promise of ${prom('1')}`, { dependencies: [`${dep}`] }],
        [`transaction 2 : retrieved value of ${prom('2')}`],
        [`pending initial promise of ${prom('2')}`, { dependencies: [`${dep}`] }],
        [`transaction 3 : retrieved value of ${prom('3')}`],
        [`pending initial promise of ${prom('3')}`, { dependencies: [`${dep}`] }],

        // Other atom in another transaction
        [`transaction 4 : set value of ${otherAtom}`],
        [`initialized value of ${otherAtom} to 0`, { value: 0 }],
        [`changed value of ${otherAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],

        // All resolved
        [`transaction 5 : resolved promise of ${dep}`],
        [
          `resolved initial promise of ${dep} to 42`,
          { pendingPromises: [`${prom('1')}`, `${prom('2')}`, `${prom('3')}`], value: 42 },
        ],
        [`resolved initial promise of ${prom('1')} to 42`, { dependencies: [`${dep}`], value: 42 }],
        [`resolved initial promise of ${prom('2')} to 42`, { dependencies: [`${dep}`], value: 42 }],
        [`resolved initial promise of ${prom('3')} to 42`, { dependencies: [`${dep}`], value: 42 }],

        // Other atom in another transaction
        [`transaction 6 : set value of ${otherAtom}`],
        [`changed value of ${otherAtom} from 1 to 2`, { newValue: 2, oldValue: 1 }],
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

      await vi.advanceTimersByTimeAsync(1500);

      await expect(beforePromise).rejects.toEqual(new Error('Promise aborted'));
      await expect(afterPromise).resolves.toBe('second');

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${promiseAtom}`],
        [`initialized value of ${dependencyAtom} to "first"`, { value: 'first' }],
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
        // This is still logged as the "initial" promise since it was aborted
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

      store.sub(testAtom, vi.fn());

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

        [`transaction 2 : set value of ${testAtom} to [object Promise]`, { value: promise1 }],
        [`pending promise of ${testAtom} from 0`, { oldValue: 0 }],
        [`resolved promise of ${testAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],

        [`transaction 3 : set value of ${testAtom} to [object Promise]`, { value: promise2 }],
        [`pending promise of ${testAtom} from 1`, { oldValue: 1 }],
        [`resolved promise of ${testAtom} from 1 to 2`, { newValue: 2, oldValue: 1 }],
      ]);
    });

    it('should show initial promise aborted before a new promise is pending', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const dependencyAtom = atom(0);
      dependencyAtom.debugPrivate = true;

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

      store.sub(promiseAtom, vi.fn());

      // Initial promise aborted
      await vi.advanceTimersByTimeAsync(250);
      store.set(dependencyAtom, (prev) => prev + 1); // Change the dependency before the promise resolves
      await vi.advanceTimersByTimeAsync(1500);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${promiseAtom}`],
        [`pending initial promise of ${promiseAtom}`],
        [`mounted ${promiseAtom}`],
        [`transaction 2`],
        [`aborted initial promise of ${promiseAtom}`], // Must be before pending
        [`pending initial promise of ${promiseAtom}`],
        [`transaction 3 : resolved promise of ${promiseAtom}`],
        [`resolved initial promise of ${promiseAtom} to 1`, { value: 1 }],
      ]);
    });

    it('should show changed promise aborted before a new promise is pending', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const dependencyAtom = atom(0);
      dependencyAtom.debugPrivate = true;

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

      store.sub(promiseAtom, vi.fn());

      // Initial promise resolved
      await vi.advanceTimersByTimeAsync(1250);

      // Changed promise aborted
      store.set(dependencyAtom, (prev) => prev + 1);
      await vi.advanceTimersByTimeAsync(250);
      store.set(dependencyAtom, (prev) => prev + 1); // Change the dependency before the promise resolves
      await vi.advanceTimersByTimeAsync(1500);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${promiseAtom}`],
        [`pending initial promise of ${promiseAtom}`],
        [`mounted ${promiseAtom}`],

        [`transaction 2 : resolved promise of ${promiseAtom}`],
        [`resolved initial promise of ${promiseAtom} to 0`, { value: 0 }],

        [`transaction 3`],
        [`pending promise of ${promiseAtom} from 0`, { oldValue: 0 }],

        [`transaction 4`],
        [`aborted promise of ${promiseAtom} from 0`, { oldValue: 0 }], // Must be before pending
        [`pending promise of ${promiseAtom} from 0`, { oldValue: 0 }],

        [`transaction 5 : resolved promise of ${promiseAtom}`],
        [`resolved promise of ${promiseAtom} from 0 to 2`, { oldValue: 0, newValue: 2 }],
      ]);
    });

    it('should log promises in colors', async () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
      });

      const refreshPromisesAtom = atom(0);
      refreshPromisesAtom.debugPrivate = true;

      const promiseResolvedAtom = atom(async (get) => {
        get(refreshPromisesAtom);
        return Promise.resolve(42);
      });
      const promiseRejectedAtom = atom(async (get) => {
        get(refreshPromisesAtom);
        return Promise.reject(new Error('Promise rejected'));
      });

      const promiseAbortedDependencyAtom = atom(0);
      promiseAbortedDependencyAtom.debugPrivate = true;
      const promiseAbortedAtom = atom(async (get, { signal }) => {
        get(refreshPromisesAtom);
        const dependency = get(promiseAbortedDependencyAtom);
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (dependency <= 1) {
              resolve(dependency);
            } else {
              reject(new Error('Rejected because of dependency higher than 1'));
            }
          }, 1000);
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Promise aborted'));
          });
        });
      });

      const resolvedPromiseNumber = /atom(\d+)(.*)/.exec(promiseResolvedAtom.toString())?.[1];
      const rejectedPromiseNumber = /atom(\d+)(.*)/.exec(promiseRejectedAtom.toString())?.[1];
      const abortedPromiseNumber = /atom(\d+)(.*)/.exec(promiseAbortedAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(resolvedPromiseNumber!))).toBeTruthy();
      expect(Number.isInteger(parseInt(rejectedPromiseNumber!))).toBeTruthy();
      expect(Number.isInteger(parseInt(abortedPromiseNumber!))).toBeTruthy();

      // Initial promise resolved
      store.sub(promiseResolvedAtom, vi.fn());

      // Initial promise rejected
      store.sub(promiseRejectedAtom, vi.fn());

      // Initial promise aborted
      store.sub(promiseAbortedAtom, vi.fn());
      await vi.advanceTimersByTimeAsync(250);
      store.set(promiseAbortedDependencyAtom, (prev) => prev + 1); // Change the dependency before the promise resolves

      await vi.advanceTimersByTimeAsync(1500);

      // promise resolved
      // promise rejected
      // promise aborted
      store.set(refreshPromisesAtom, (prev) => prev + 1);
      await vi.advanceTimersByTimeAsync(250);
      store.set(promiseAbortedDependencyAtom, (prev) => prev + 1); // Change the dependency before the promise resolves

      await vi.advanceTimersByTimeAsync(1500);

      expect(consoleMock.log.mock.calls).toEqual([
        // pending initial promise (1)
        [
          `%ctransaction %c1 %c: %csubscribed %cto %catom%c${resolvedPromiseNumber}`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 1
          `color: #757575; font-weight: normal;`, // :
          `color: #009E73; font-weight: bold;`, // subscribed
          `color: #757575; font-weight: normal;`, // to
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
        ],
        [
          `%cpending initial promise %cof %catom%c${resolvedPromiseNumber}`,
          `color: #CC79A7; font-weight: bold;`, // pending initial promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
        ],
        [
          `%cmounted %catom%c${resolvedPromiseNumber}`,
          `color: #009E73; font-weight: bold;`, // mounted
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
        ],

        // pending initial promise (2)
        [
          `%ctransaction %c2 %c: %csubscribed %cto %catom%c${rejectedPromiseNumber}`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 2
          `color: #757575; font-weight: normal;`, // :
          `color: #009E73; font-weight: bold;`, // subscribed
          `color: #757575; font-weight: normal;`, // to
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 2
        ],
        [
          `%cpending initial promise %cof %catom%c${rejectedPromiseNumber}`,
          `color: #CC79A7; font-weight: bold;`, // pending initial promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 2
        ],
        [
          `%cmounted %catom%c${rejectedPromiseNumber}`,
          `color: #009E73; font-weight: bold;`, // mounted
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 2
        ],

        // pending initial promise (3)
        [
          `%ctransaction %c3 %c: %csubscribed %cto %catom%c${abortedPromiseNumber}`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 3
          `color: #757575; font-weight: normal;`, // :
          `color: #009E73; font-weight: bold;`, // subscribed
          `color: #757575; font-weight: normal;`, // to
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
        ],
        [
          `%cpending initial promise %cof %catom%c${abortedPromiseNumber}`,
          `color: #CC79A7; font-weight: bold;`, // pending initial promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
        ],
        [
          `%cmounted %catom%c${abortedPromiseNumber}`,
          `color: #009E73; font-weight: bold;`, // mounted
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
        ],

        // resolved initial promise (1)
        [
          `%ctransaction %c4 %c: %cresolved %cpromise %cof %catom%c${resolvedPromiseNumber}`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 4
          `color: #757575; font-weight: normal;`, // :
          `color: #009E73; font-weight: bold;`, // resolved
          `color: #CC79A7; font-weight: bold;`, // promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
        ],
        [
          `%cresolved %cinitial promise %cof %catom%c${resolvedPromiseNumber} %cto %c42`,
          `color: #009E73; font-weight: bold;`, // resolved
          `color: #CC79A7; font-weight: bold;`, // initial promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // 42
          { value: 42 },
        ],
        // rejected initial promise (2)
        [
          `%crejected %cinitial promise %cof %catom%c${rejectedPromiseNumber} %cto %cError: Promise rejected`,
          `color: #D55E00; font-weight: bold;`, // rejected
          `color: #CC79A7; font-weight: bold;`, // initial promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 6
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // Error: Promise rejected
          { error: new Error(`Promise rejected`) },
        ],

        // aborted initial promise (3)
        [
          `%ctransaction %c5`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 5
        ],
        [
          `%caborted %cinitial promise %cof %catom%c${abortedPromiseNumber}`,
          `color: #D55E00; font-weight: bold;`, // aborted
          `color: #CC79A7; font-weight: bold;`, // initial promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
        ],
        [
          `%cpending initial promise %cof %catom%c${abortedPromiseNumber}`,
          `color: #CC79A7; font-weight: bold;`, // pending initial promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
        ],

        // resolved initial promise (3)
        [
          `%ctransaction %c6 %c: %cresolved %cpromise %cof %catom%c${abortedPromiseNumber}`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 6
          `color: #757575; font-weight: normal;`, // :
          `color: #009E73; font-weight: bold;`, // resolved
          `color: #CC79A7; font-weight: bold;`, // promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
        ],
        [
          `%cresolved %cinitial promise %cof %catom%c${abortedPromiseNumber} %cto %c1`,
          `color: #009E73; font-weight: bold;`, // resolved
          `color: #CC79A7; font-weight: bold;`, // initial promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // 1
          { value: 1 },
        ],

        // pending promise 1 + pending promise 2 + resolved promise 1 + rejected promise 2
        [
          `%ctransaction %c7`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 7
        ],
        [
          `%cpending promise %cof %catom%c${resolvedPromiseNumber} %cfrom %c42`,
          `color: #CC79A7; font-weight: bold;`, // pending promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
          `color: #757575; font-weight: normal;`, // from
          `color: default; font-weight: normal;`, // 42
          { oldValue: 42 },
        ],
        [
          `%cpending promise %cof %catom%c${rejectedPromiseNumber} %cfrom %cError: Promise rejected`,
          `color: #CC79A7; font-weight: bold;`, // pending promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 2
          `color: #757575; font-weight: normal;`, // from
          `color: default; font-weight: normal;`, // Error: Promise rejected
          { oldError: new Error(`Promise rejected`) },
        ],
        [
          `%cpending promise %cof %catom%c${abortedPromiseNumber} %cfrom %c1`,
          `color: #CC79A7; font-weight: bold;`, // pending promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
          `color: #757575; font-weight: normal;`, // from
          `color: default; font-weight: normal;`, // 1
          { oldValue: 1 },
        ],
        [
          `%cresolved %cpromise %cof %catom%c${resolvedPromiseNumber} %cfrom %c42 %cto %c42`,
          `color: #009E73; font-weight: bold;`, // resolved
          `color: #CC79A7; font-weight: bold;`, // promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
          `color: #757575; font-weight: normal;`, // from
          `color: default; font-weight: normal;`, // 42
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // 42
          { newValue: 42, oldValue: 42 },
        ],
        [
          `%crejected %cpromise %cof %catom%c${rejectedPromiseNumber} %cfrom %cError: Promise rejected %cto %cError: Promise rejected`,
          `color: #D55E00; font-weight: bold;`, // rejected
          `color: #CC79A7; font-weight: bold;`, // promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 2
          `color: #757575; font-weight: normal;`, // from
          `color: default; font-weight: normal;`, // Error: Promise rejected
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // Error: Promise rejected
          { newError: new Error(`Promise rejected`), oldError: new Error(`Promise rejected`) },
        ],

        // pending promise 3 + aborted promise 3
        [
          `%ctransaction %c8`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 8
        ],
        [
          `%caborted %cpromise %cof %catom%c${abortedPromiseNumber} %cfrom %c1`,
          `color: #D55E00; font-weight: bold;`, // aborted
          `color: #CC79A7; font-weight: bold;`, // promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
          `color: #757575; font-weight: normal;`, // from
          `color: default; font-weight: normal;`, // 1
          { oldValue: 1 },
        ],
        [
          `%cpending promise %cof %catom%c${abortedPromiseNumber} %cfrom %c1`,
          `color: #CC79A7; font-weight: bold;`, // pending promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
          `color: #757575; font-weight: normal;`, // from
          `color: default; font-weight: normal;`, // 1
          { oldValue: 1 },
        ],

        // rejected promise 3
        [
          `%ctransaction %c9 %c: %crejected %cpromise %cof %catom%c${abortedPromiseNumber}`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 9
          `color: #757575; font-weight: normal;`, // :
          `color: #D55E00; font-weight: bold;`, // rejected
          `color: #CC79A7; font-weight: bold;`, // promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
        ],
        [
          `%crejected %cpromise %cof %catom%c${abortedPromiseNumber} %cfrom %c1 %cto %cError: Rejected because of dependency higher than …`,
          `color: #D55E00; font-weight: bold;`, // rejected
          `color: #CC79A7; font-weight: bold;`, // promise
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 3
          `color: #757575; font-weight: normal;`, // from
          `color: default; font-weight: normal;`, // 1
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // Error: Rejected because of dependency higher than 1
          { error: new Error(`Rejected because of dependency higher than 1`), oldValue: 1 },
        ],
      ]);
    });

    it('should log aborted promise due to changing dependencies', async () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const abortedFn = vi.fn();

      const dependencyAtom = atom(0);

      const promiseAtom = atom(async (get, { signal }) => {
        get(dependencyAtom);
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (!signal.aborted) resolve(42);
          }, 1000);
          signal.addEventListener('abort', () => {
            abortedFn();
            clearTimeout(timeoutId);
            reject(new Error('Promise aborted'));
          });
        });
      });

      store.sub(promiseAtom, vi.fn());
      await vi.advanceTimersByTimeAsync(250);

      expect(abortedFn).not.toHaveBeenCalled();
      store.set(dependencyAtom, store.get(dependencyAtom) + 1);
      expect(abortedFn).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${promiseAtom}`],
        [`initialized value of ${dependencyAtom} to 0`, { value: 0 }],
        [`pending initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],
        [`mounted ${dependencyAtom}`, { pendingPromises: [`${promiseAtom}`], value: 0 }],
        [`mounted ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],

        [`transaction 2 : set value of ${dependencyAtom} to 1`, { value: 1 }],
        [
          `changed value of ${dependencyAtom} from 0 to 1`,
          {
            dependents: [`${promiseAtom}`],
            newValue: 1,
            oldValue: 0,
            pendingPromises: [`${promiseAtom}`],
          },
        ],
        [`aborted initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],
        [`pending initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],

        [`transaction 3 : resolved promise of ${promiseAtom}`],
        [
          `resolved initial promise of ${promiseAtom} to 42`,
          { dependencies: [`${dependencyAtom}`], value: 42 },
        ],
      ]);
    });

    it('should not log aborted promise due to unmount', async () => {
      // **not** aborted is expected due to https://github.com/pmndrs/jotai/issues/2625

      bindAtomsLoggerToStore(store, defaultOptions);

      const abortedFn = vi.fn();

      const promiseAtom = atom(async (get, { signal }) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (!signal.aborted) resolve(42);
          }, 1000);
          signal.addEventListener('abort', () => {
            abortedFn();
            clearTimeout(timeoutId);
            reject(new Error('Promise aborted'));
          });
        });
      });

      const unsubscribe = store.sub(promiseAtom, vi.fn());
      await vi.advanceTimersByTimeAsync(250);

      expect(abortedFn).not.toHaveBeenCalled();
      unsubscribe();
      expect(abortedFn).not.toHaveBeenCalled(); // not aborted is expected

      await vi.advanceTimersByTimeAsync(2000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${promiseAtom}`],
        [`pending initial promise of ${promiseAtom}`],
        [`mounted ${promiseAtom}`],

        [`transaction 2 : unsubscribed from ${promiseAtom}`],
        [`unmounted ${promiseAtom}`],

        [`transaction 3 : resolved promise of ${promiseAtom}`],
        [`resolved initial promise of ${promiseAtom} to 42`, { value: 42 }],
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
          `rejected initial promise of ${promiseAtom} to RangeError: Custom error message`,
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
      bindAtomsLoggerToStore(store, defaultOptions);

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
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: false,
        stringifyValues: false,
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
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
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
      bindAtomsLoggerToStore(store, defaultOptions);

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
        [`initialized value of ${valueAtom} to 1`, { value: 1 }],
        [`initialized value of ${multiplyAtom} to 2`, { value: 2 }],
        [
          `initialized value of ${resultAtom} to 2`,
          { dependencies: [`${valueAtom}`, `${multiplyAtom}`], value: 2 },
        ],
        [`mounted ${valueAtom}`, { value: 1 }],
        [`mounted ${multiplyAtom}`, { value: 2 }],
        [`mounted ${resultAtom}`, { dependencies: [`${valueAtom}`, `${multiplyAtom}`], value: 2 }],
        [`transaction 2 : set value of ${valueAtom} to 2`, { value: 2 }],
        [
          `changed value of ${valueAtom} from 1 to 2`,
          { dependents: [`${resultAtom}`], newValue: 2, oldValue: 1 },
        ],
        [
          `changed value of ${resultAtom} from 2 to 4`,
          { dependencies: [`${valueAtom}`, `${multiplyAtom}`], newValue: 4, oldValue: 2 },
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

    it('should log when an atom dependencies have changed', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const aAtom = atom(1);
      const bAtom = atom(2);
      const toggleAtom = atom(false);
      const testAtom = atom((get) => {
        if (!get(toggleAtom)) {
          return get(aAtom);
        } else {
          return get(bAtom);
        }
      });

      store.sub(testAtom, vi.fn());
      store.set(toggleAtom, (prev) => !prev);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${testAtom}`],
        [`initialized value of ${toggleAtom} to false`, { value: false }],
        [`initialized value of ${aAtom} to 1`, { value: 1 }],
        [
          `initialized value of ${testAtom} to 1`,
          { dependencies: [`${toggleAtom}`, `${aAtom}`], value: 1 },
        ],
        [`mounted ${toggleAtom}`, { value: false }],
        [`mounted ${aAtom}`, { value: 1 }],
        [
          `mounted ${testAtom}`,
          {
            dependencies: [`${toggleAtom}`, `${aAtom}`],
            value: 1,
          },
        ],

        [`transaction 2 : set value of ${toggleAtom}`],
        [
          `changed value of ${toggleAtom} from false to true`,
          { dependents: [`${testAtom}`], newValue: true, oldValue: false },
        ],
        [`initialized value of ${bAtom} to 2`, { value: 2 }],
        [
          `changed dependencies of ${testAtom}`,
          {
            oldDependencies: [`${toggleAtom}`, `${aAtom}`],
            newDependencies: [`${toggleAtom}`, `${bAtom}`],
          },
        ],
        [
          `changed value of ${testAtom} from 1 to 2`,
          {
            dependencies: [`${toggleAtom}`, `${bAtom}`],
            newValue: 2,
            oldValue: 1,
          },
        ],
        [`mounted ${bAtom}`, { value: 2 }],
        [`unmounted ${aAtom}`],
      ]);
    });

    it('should not track atom dependencies of private atoms', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const aAtom = atom(1);
      const bAtom = atom(2);
      bAtom.debugPrivate = true;
      const cAtom = atom((get) => {
        get(aAtom);
        get(bAtom);
      });
      cAtom.debugPrivate = true;

      store.sub(cAtom, vi.fn());

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1`],
        [`initialized value of ${aAtom} to 1`, { value: 1 }],
        [`mounted ${aAtom}`, { value: 1 }],
      ]);

      const storeData = (store as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL];
      expect(storeData.dependenciesMap.has(aAtom)).toBeTruthy();
      expect(storeData.dependenciesMap.has(bAtom)).toBeFalsy();
      expect(storeData.dependenciesMap.has(cAtom)).toBeFalsy();
      expect(storeData.prevTransactionDependenciesMap.has(aAtom)).toBeTruthy();
      expect(storeData.prevTransactionDependenciesMap.has(bAtom)).toBeFalsy();
      expect(storeData.prevTransactionDependenciesMap.has(cAtom)).toBeFalsy();
    });

    it('should log when an atom dependencies are removed', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const aAtom = atom(1);
      const bAtom = atom(2);
      const toggleAtom = atom(false);
      toggleAtom.debugPrivate = true;
      const testAtom = atom((get) => {
        if (!get(toggleAtom)) {
          get(aAtom);
          get(bAtom);
          return;
        }
      });

      store.sub(testAtom, vi.fn());
      store.set(toggleAtom, (prev) => !prev);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${testAtom}`],
        [`initialized value of ${aAtom} to 1`, { value: 1 }],
        [`initialized value of ${bAtom} to 2`, { value: 2 }],
        [
          `initialized value of ${testAtom} to undefined`,
          { dependencies: [`${aAtom}`, `${bAtom}`], value: undefined },
        ],
        [`mounted ${aAtom}`, { value: 1 }],
        [`mounted ${bAtom}`, { value: 2 }],
        [`mounted ${testAtom}`, { dependencies: [`${aAtom}`, `${bAtom}`], value: undefined }],

        [`transaction 2`],
        [
          `changed dependencies of ${testAtom}`,
          { oldDependencies: [`${aAtom}`, `${bAtom}`], newDependencies: [] },
        ],
        [`unmounted ${aAtom}`],
        [`unmounted ${bAtom}`],
      ]);
    });

    it('should log when an atom dependencies are added', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const aAtom = atom(1);
      const bAtom = atom(2);
      const toggleAtom = atom(false);
      toggleAtom.debugPrivate = true;
      const testAtom = atom((get) => {
        if (!get(toggleAtom)) {
          return;
        } else {
          get(aAtom);
          get(bAtom);
        }
      });

      store.sub(testAtom, vi.fn());
      store.set(toggleAtom, (prev) => !prev);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${testAtom}`],
        [`initialized value of ${testAtom} to undefined`, { value: undefined }],
        [`mounted ${testAtom}`, { value: undefined }],

        [`transaction 2`],
        [`initialized value of ${aAtom} to 1`, { value: 1 }],
        [`initialized value of ${bAtom} to 2`, { value: 2 }],
        [
          `changed dependencies of ${testAtom}`,
          { oldDependencies: [], newDependencies: [`${aAtom}`, `${bAtom}`] },
        ],
        [`mounted ${aAtom}`, { value: 1 }],
        [`mounted ${bAtom}`, { value: 2 }],
      ]);
    });

    it('should not log atom dependencies changes if the new dependencies are private', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const aAtom = atom(1);
      const bAtom = atom(2);
      bAtom.debugPrivate = true;
      const toggleAtom = atom(false);
      toggleAtom.debugPrivate = true;
      const testAtom = atom((get) => {
        if (!get(toggleAtom)) {
          get(aAtom);
        } else {
          get(aAtom);
          get(bAtom); // bAtom is added but is private
        }
      });

      store.sub(testAtom, vi.fn());
      store.set(toggleAtom, (prev) => !prev);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${testAtom}`],
        [`initialized value of ${aAtom} to 1`, { value: 1 }],
        [
          `initialized value of ${testAtom} to undefined`,
          { dependencies: [`${aAtom}`], value: undefined },
        ],
        [`mounted ${aAtom}`, { value: 1 }],
        [`mounted ${testAtom}`, { dependencies: [`${aAtom}`], value: undefined }],
      ]);
    });

    it('should log atom dependencies without duplicated atoms', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      const aAtom = atom(1);
      const bAtom = atom(2);
      const toggleAtom = atom(false);
      toggleAtom.debugPrivate = true;
      const testAtom = atom((get) => {
        if (!get(toggleAtom)) {
          get(aAtom);
          get(aAtom);
        } else {
          get(aAtom);
          get(aAtom);
          get(bAtom);
          get(bAtom);
          get(bAtom);
        }
      });

      store.sub(testAtom, vi.fn());
      store.set(toggleAtom, (prev) => !prev);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : subscribed to ${testAtom}`],
        [`initialized value of ${aAtom} to 1`, { value: 1 }],
        [
          `initialized value of ${testAtom} to undefined`,
          { dependencies: [`${aAtom}`], value: undefined },
        ],
        [`mounted ${aAtom}`, { value: 1 }],
        [`mounted ${testAtom}`, { dependencies: [`${aAtom}`], value: undefined }],

        [`transaction 2`],
        [`initialized value of ${bAtom} to 2`, { value: 2 }],
        [
          `changed dependencies of ${testAtom}`,
          { oldDependencies: [`${aAtom}`], newDependencies: [`${aAtom}`, `${bAtom}`] },
        ],
        [`mounted ${bAtom}`, { value: 2 }],
      ]);
    });

    it('should log atom dependencies changed in colors', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
      });

      const aAtom = atom(1);
      const bAtom = atom(2);
      const toggleAtom = atom(false);
      toggleAtom.debugPrivate = true;
      const testAtom = atom((get) => {
        if (!get(toggleAtom)) {
          get(aAtom);
        } else {
          get(bAtom);
        }
      });

      const testAtomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
      const aAtomNumber = /atom(\d+)(.*)/.exec(aAtom.toString())?.[1];
      const bAtomNumber = /atom(\d+)(.*)/.exec(bAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(testAtomNumber!))).toBeTruthy();
      expect(Number.isInteger(parseInt(aAtomNumber!))).toBeTruthy();
      expect(Number.isInteger(parseInt(bAtomNumber!))).toBeTruthy();

      store.sub(testAtom, vi.fn());
      store.set(toggleAtom, (prev) => !prev);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %csubscribed %cto %catom%c${testAtomNumber}`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 1
          `color: #757575; font-weight: normal;`, // :
          `color: #009E73; font-weight: bold;`, // subscribed
          `color: #757575; font-weight: normal;`, // to
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 4
        ],
        [
          `%cinitialized value %cof %catom%c${aAtomNumber} %cto %c1`,
          `color: #0072B2; font-weight: bold;`, // initialized value
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // 1
          { value: 1 },
        ],
        [
          `%cinitialized value %cof %catom%c${testAtomNumber} %cto %cundefined`,
          `color: #0072B2; font-weight: bold;`, // initialized value
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 4
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // undefined
          { dependencies: [`atom${aAtomNumber}`], value: undefined },
        ],
        [
          `%cmounted %catom%c${aAtomNumber}`,
          `color: #009E73; font-weight: bold;`, // mounted
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
          { value: 1 },
        ],
        [
          `%cmounted %catom%c${testAtomNumber}`,
          `color: #009E73; font-weight: bold;`, // mounted
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 4
          { dependencies: [`atom${aAtomNumber}`], value: undefined },
        ],
        [
          `%ctransaction %c2`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 2
        ],
        [
          `%cinitialized value %cof %catom%c${bAtomNumber} %cto %c2`,
          `color: #0072B2; font-weight: bold;`, // initialized value
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 2
          `color: #757575; font-weight: normal;`, // to
          `color: default; font-weight: normal;`, // 2
          { value: 2 },
        ],
        [
          `%cchanged dependencies %cof %catom%c${testAtomNumber}`,
          `color: #E69F00; font-weight: bold;`, // changed dependencies
          `color: #757575; font-weight: normal;`, // of
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 4
          { newDependencies: [`atom${bAtomNumber}`], oldDependencies: [`atom${aAtomNumber}`] },
        ],
        [
          `%cmounted %catom%c${bAtomNumber}`,
          `color: #009E73; font-weight: bold;`, // mounted
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 2
          { value: 2 },
        ],
        [
          `%cunmounted %catom%c${aAtomNumber}`,
          `color: #D55E00; font-weight: bold;`, // unmounted
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
        ],
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
        [`initialized value of ${aAtom} to 1`, { value: 1 }],
        [`initialized value of ${bAtom} to 2`, { value: 2, dependencies: [`${aAtom}`] }],
        [`mounted ${aAtom}`, { value: 1 }],
        [`mounted ${bAtom}`, { value: 2, dependencies: [`${aAtom}`] }],
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
        [`initialized value of ${firstAtom} to "first"`, { value: 'first' }],
        [
          `initialized value of ${resultAtom} to "first second"`,
          {
            dependencies: [`${firstAtom}`, `${secondAtom}`],
            value: 'first second',
          },
        ],
        [`mounted ${firstAtom}`, { value: 'first' }],
        [`mounted ${secondAtom}`, { value: 'second' }],
        [
          `mounted ${resultAtom}`,
          { dependencies: [`${firstAtom}`, `${secondAtom}`], value: 'first second' },
        ],

        [`transaction 3 : set value of ${secondAtom} to "2nd"`, { value: '2nd' }],
        [
          `changed value of ${secondAtom} from "second" to "2nd"`,
          {
            dependents: [`${resultAtom}`], // here he is
            newValue: '2nd',
            oldValue: 'second',
          },
        ],
        [
          `changed value of ${resultAtom} from "first second" to "first 2nd"`,
          {
            dependencies: [`${firstAtom}`, `${secondAtom}`],
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

    it('should not log transactions with only private atoms', () => {
      bindAtomsLoggerToStore(store, { ...defaultOptions, shouldShowPrivateAtoms: false });
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
      bindAtomsLoggerToStore(store, defaultOptions);
      const testSetAtom = atom(null, () => {
        // No events
      });
      store.set(testSetAtom);
      vi.runAllTimers();
      expect(consoleMock.log.mock.calls).toEqual([]);
    });

    it('should log changes made outside of transactions inside an unknown transaction', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

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
      bindAtomsLoggerToStore(store, defaultOptions);

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
      let originalRequestIdleCallback: typeof globalThis.requestIdleCallback;

      beforeEach(() => {
        originalRequestIdleCallback = globalThis.requestIdleCallback;
      });

      afterEach(() => {
        globalThis.requestIdleCallback = originalRequestIdleCallback;
        vi.clearAllMocks();
      });

      it('should schedule and log transactions one by one using requestIdleCallback', () => {
        const transactionCallbacks: (() => void)[] = [];
        const requestIdleCallbackMockFn = vi.fn((cb: IdleRequestCallback) => {
          transactionCallbacks.push(() => {
            cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
          });
          return 1;
        });
        globalThis.requestIdleCallback = requestIdleCallbackMockFn;

        bindAtomsLoggerToStore(store, defaultOptions);

        const testAtom = atom(0);

        expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
        expect(consoleMock.log.mock.calls).toEqual([]);

        // Run all transactions
        store.get(testAtom);
        store.set(testAtom, 1);
        store.set(testAtom, 2);
        vi.runAllTimers();

        expect(requestIdleCallbackMockFn).toHaveBeenCalledOnce(); // First transaction scheduled
        expect(consoleMock.log.mock.calls).toEqual([]);
        requestIdleCallbackMockFn.mockClear();

        transactionCallbacks.shift()!(); // Run the first transaction
        vi.runAllTimers();

        expect(requestIdleCallbackMockFn).toHaveBeenCalledOnce(); // Second transaction scheduled
        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 1 : retrieved value of ${testAtom}`],
          [`initialized value of ${testAtom} to 0`, { value: 0 }],
        ]);
        requestIdleCallbackMockFn.mockClear();
        consoleMock.log.mockClear();

        transactionCallbacks.shift()!(); // Run the second transaction
        vi.runAllTimers();

        expect(requestIdleCallbackMockFn).toHaveBeenCalledOnce(); // Third transaction scheduled
        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 2 : set value of ${testAtom} to 1`, { value: 1 }],
          [`changed value of ${testAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],
        ]);
        requestIdleCallbackMockFn.mockClear();
        consoleMock.log.mockClear();

        transactionCallbacks.shift()!(); // Run the third transaction
        vi.runAllTimers();

        expect(requestIdleCallbackMockFn).not.toHaveBeenCalled(); // No more transactions scheduled
        expect(consoleMock.log.mock.calls).toEqual([
          [`transaction 3 : set value of ${testAtom} to 2`, { value: 2 }],
          [`changed value of ${testAtom} from 1 to 2`, { newValue: 2, oldValue: 1 }],
        ]);
      });
    });

    it('should merge nested direct store calls', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

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

    it('should log mounted and unmounted atoms in colors', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
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
      bindAtomsLoggerToStore(store, defaultOptions);

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
      bindAtomsLoggerToStore(store, defaultOptions);

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

    it('should log default atom setter in colors', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
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

        // result <-- second
        [`initialized value of ${secondAtom} to "second"`, { value: 'second' }],
        // result <-- loadable(thirdAsync) <-- thirdAsync <-- first
        [`initialized value of ${firstAtom} to "first"`, { value: 'first' }],
        // result <-- loadable(thirdAsync) <-- thirdAsync
        [`pending initial promise of ${thirdAsyncAtom}`, { dependencies: [`${firstAtom}`] }],
        // result <-- loadable(thirdAsync)
        [
          `initialized value of ${loadable(thirdAsyncAtom)} to {"state":"loading"}`,
          { value: { state: 'loading' } },
        ],
        // result
        [
          `initialized value of ${resultAtom} to "second loading"`,
          {
            dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            value: 'second loading',
          },
        ],
        [`mounted ${secondAtom}`, { value: 'second' }],
        [`mounted ${firstAtom}`, { pendingPromises: [`${thirdAsyncAtom}`], value: 'first' }],
        [`mounted ${thirdAsyncAtom}`, { dependencies: [`${firstAtom}`] }],
        [`mounted ${loadable(thirdAsyncAtom)}`, { value: { state: 'loading' } }],
        [
          `mounted ${resultAtom}`,
          {
            dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            value: 'second loading',
          },
        ],

        [`transaction 2 : resolved promise of ${thirdAsyncAtom}`],
        // result <-- loadable(thirdAsync) <-- thirdAsync <-- promise resolved
        [
          `resolved initial promise of ${thirdAsyncAtom} to "first third"`,
          { dependencies: [`${firstAtom}`], value: 'first third' },
        ],
        // result <-- loadable(thirdAsync)
        [
          `changed value of ${loadable(thirdAsyncAtom)} from {"state":"loading"} to {"state":"hasData","data":"first third"}`,
          {
            dependents: [`${resultAtom}`],
            newValue: { data: 'first third', state: 'hasData' },
            oldValue: { state: 'loading' },
          },
        ],
        // result
        [
          `changed value of ${resultAtom} from "second loading" to "second first third"`,
          {
            dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
            newValue: 'second first third',
            oldValue: 'second loading',
          },
        ],
      ]);
    });
  });

  describe('colors', () => {
    it('should not log colors if formattedOutput is false', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: false,
      });

      const testAtom = atom(0);
      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should log colors if formattedOutput is true', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
      });

      const testAtom = atom(0);

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // 0
          { value: 0 },
        ],
      ]);
    });

    it('should log atom name without namespaces with color', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
      });

      const testAtom = atom(0);
      testAtom.debugLabel = 'testAtomWithoutNamespaces';

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}%c:%ctestAtomWithoutNamespaces`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: default; font-weight: normal;', // testAtomWithoutNamespaces
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber}%c:%ctestAtomWithoutNamespaces %cto %c0`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: default; font-weight: normal;', // testAtomWithoutNamespaces
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // 0
          { value: 0 },
        ],
      ]);
    });

    it('should log atom name namespaces with colors', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
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
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #757575; font-weight: normal;', // test
          'color: default; font-weight: normal;', // /
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // /
          'color: #757575; font-weight: normal;', // with
          'color: default; font-weight: normal;', // /namespaces
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber}%c:%ctest%c/%catom%c/%cwith%c/namespaces %cto %c0`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #757575; font-weight: normal;', // test
          'color: default; font-weight: normal;', // /
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // /
          'color: #757575; font-weight: normal;', // with
          'color: default; font-weight: normal;', // /namespaces
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // 0
          { value: 0 },
        ],
      ]);
    });

    it('should log dark colors with dark colorScheme option', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
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
        formattedOutput: true,
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

    it('should log colored stack traces', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
        getStackTrace() {
          return [
            {
              functionName: 'useAtomValue',
              fileName: 'atoms.ts',
            },
            {
              functionName: 'MyComponent',
              fileName: 'myComponent.tsx',
            },
          ];
        },
      });

      const testAtom = atom(0);

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %c[myComponent] %cMyComponent %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #757575; font-weight: normal;', // [myComponent]
          'color: default; font-weight: normal;', // MyComponent
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // 0
          { value: 0 },
        ],
      ]);
    });

    it('should log colored stack traces with hooks', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
        getStackTrace() {
          return [
            {
              functionName: 'useAtomValue',
              fileName: 'atoms.ts',
            },
            {
              functionName: 'useMyOtherHook',
              fileName: 'myOtherHook.tsx',
            },
            {
              functionName: 'useMyHook',
              fileName: 'myHook.ts',
            },
            {
              functionName: 'MyComponent',
              fileName: 'myComponent.tsx',
            },
          ];
        },
      });

      const testAtom = atom(0);

      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(testAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %c[myComponent] %cMyComponent%c.useMyHook.useMyOtherHook %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #757575; font-weight: normal;', // [myComponent]
          'color: default; font-weight: normal;', // MyComponent
          'color: #757575; font-weight: normal;', // .useMyHook.useMyOtherHook
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // 0
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

    it('should not log collapsed transaction groups if logger.groupCollapsed is not defined', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        groupLogs: true,
        logger: {
          log: consoleMock.log,
          group: consoleMock.group,
          groupCollapsed: undefined,
          groupEnd: consoleMock.groupEnd,
        },
        collapseTransactions: true,
        collapseEvents: true,
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

    it('should not log event group if logger.group is not defined', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        groupLogs: true,
        logger: {
          log: consoleMock.log,
          group: undefined,
          groupCollapsed: consoleMock.groupCollapsed,
          groupEnd: consoleMock.groupEnd,
        },
        collapseTransactions: false,
        collapseEvents: false,
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

  describe('destroyed atoms', () => {
    let finalizationRegistryRegisterMock: Mock;
    let finalizationRegistryUnregisterMock: Mock;
    let registeredCallback: ((heldValue: AtomId) => void) | null;

    beforeEach(() => {
      finalizationRegistryRegisterMock = vi.fn();
      finalizationRegistryUnregisterMock = vi.fn();
      registeredCallback = null;
      vi.spyOn(global, 'FinalizationRegistry').mockImplementation(
        (callback): FinalizationRegistry<AtomId> => {
          registeredCallback = callback;
          return {
            register: finalizationRegistryRegisterMock,
            unregister: finalizationRegistryUnregisterMock,
            [Symbol.toStringTag]: 'FinalizationRegistry',
          };
        },
      );
    });

    it('should register atoms with FinalizationRegistry for garbage collection tracking', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      expect(finalizationRegistryRegisterMock).not.toHaveBeenCalled();

      const testAtom = atom(42);
      store.get(testAtom);

      expect(finalizationRegistryRegisterMock).toHaveBeenCalled();
      expect(finalizationRegistryRegisterMock.mock.calls).toEqual([
        [testAtom, testAtom.toString()],
      ]);
    });

    it('should log when an atom is garbage collected', () => {
      bindAtomsLoggerToStore(store, defaultOptions);

      expect(registeredCallback).not.toBeNull();

      const testAtom = atom(42);
      store.get(testAtom);

      vi.runAllTimers();

      registeredCallback!(testAtom.toString());

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 42`, { value: 42 }],

        [`transaction 2`],
        [`destroyed ${testAtom}`],
      ]);
    });

    it('should log when an atom is garbage collected with colors', () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        formattedOutput: true,
      });

      expect(registeredCallback).not.toBeNull();

      const testAtom = atom(42);
      const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      registeredCallback!(testAtom.toString());

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1`,
          `color: #757575; font-weight: normal;`, // transaction
          `color: default; font-weight: normal;`, // 1
        ],
        [
          `%cdestroyed %catom%c${atomNumber}`,
          `color: #D55E00; font-weight: bold;`, // destroyed
          `color: #757575; font-weight: normal;`, // atom
          `color: default; font-weight: normal;`, // 1
        ],
      ]);
    });

    it('should not log when an atom is garbage collected if the store is disabled', () => {
      bindAtomsLoggerToStore(store, { ...defaultOptions, enabled: false });

      expect(registeredCallback).not.toBeNull();

      const testAtom = atom(42);
      store.get(testAtom);

      vi.runAllTimers();

      registeredCallback!(testAtom.toString());

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([]);
    });

    it('should not log when an atom is garbage collected if the store just got disabled', () => {
      bindAtomsLoggerToStore(store, { ...defaultOptions, enabled: true });

      expect(registeredCallback).not.toBeNull();

      const testAtom = atom(42);
      store.get(testAtom);

      vi.runAllTimers();

      bindAtomsLoggerToStore(store, { ...defaultOptions, enabled: false });

      registeredCallback!(testAtom.toString());

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${testAtom}`],
        [`initialized value of ${testAtom} to 42`, { value: 42 }],
      ]);
    });
  });

  describe('stack traces', () => {
    it('should handle synchronous getStackTrace', async () => {
      let stackId = 0;

      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        getStackTrace: () => {
          const currentStackId = ++stackId;
          return [
            {
              functionName: 'useAtomValue',
              fileName: 'atoms.ts',
            },
            {
              functionName: `MyCounter${currentStackId}`,
              fileName: 'myComponent.ts',
            },
          ];
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(stackId).toBe(1);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [myComponent] MyCounter1 retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should handle asynchronous getStackTrace', async () => {
      let stackId = 0;

      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        getStackTrace: () => {
          const currentStackId = ++stackId;
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve([
                {
                  functionName: 'useAtomValue',
                  fileName: 'atoms.ts',
                },
                {
                  functionName: `MyCounter${currentStackId}`,
                  fileName: 'myComponent.ts',
                },
              ]);
            }, 100);
          });
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(stackId).toBe(1);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [myComponent] MyCounter1 retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should not log a stack trace before the previous one is settled', async () => {
      let stackId = 0;

      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        getStackTrace: () => {
          const currentStackId = ++stackId;
          if (currentStackId === 1) {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve([
                  {
                    functionName: 'useAtomValue',
                    fileName: 'atoms.ts',
                  },
                  {
                    functionName: `MyCounter${currentStackId}`,
                    fileName: 'myComponent.ts',
                  },
                ]);
              }, 5000); // Simulate a long delay for the first stack trace
            });
          } else {
            return [
              {
                functionName: 'useAtomValue',
                fileName: 'atoms.ts',
              },
              {
                functionName: `MyCounter${currentStackId}`,
                fileName: 'myComponent.ts',
              },
            ];
          }
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);
      store.set(countAtom, 1);

      await vi.advanceTimersByTimeAsync(500);

      expect(stackId).toBe(2); // The two stack traces are pending

      await vi.advanceTimersByTimeAsync(4000);
      expect(consoleMock.log.mock.calls).toEqual([]); // The first stack trace is still pending

      await vi.advanceTimersByTimeAsync(6000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [myComponent] MyCounter1 retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],

        [`transaction 2 : [myComponent] MyCounter2 set value of ${countAtom} to 1`, { value: 1 }],
        [`changed value of ${countAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],
      ]);
    });

    it('should ignore crashes in getStackTrace', async () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        getStackTrace: () => {
          throw new Error('Error in getStackTrace');
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should ignore rejected promises in getStackTrace', async () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        getStackTrace: () => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Error in getStackTrace'));
            }, 100);
          });
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should ignore instantly rejected promises in getStackTrace', async () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        getStackTrace: () => {
          return Promise.reject(new Error('Error in getStackTrace'));
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should ignore undefined stack traces', async () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        getStackTrace: () => {
          return undefined;
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should ignore promise undefined stack traces', async () => {
      bindAtomsLoggerToStore(store, {
        ...defaultOptions,
        getStackTrace: () => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(undefined);
            }, 100);
          });
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });
  });
});
