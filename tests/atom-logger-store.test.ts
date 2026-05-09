import { atom } from 'jotai';
import { createStore } from 'jotai/vanilla';
import {
  INTERNAL_buildStoreRev3 as buildStore,
  INTERNAL_getBuildingBlocksRev3 as getBuildingBlocks,
  INTERNAL_initializeStoreHooksRev3 as initializeStoreHooks,
  type INTERNAL_BuildingBlocks as BuildingBlocks,
} from 'jotai/vanilla/internals';
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
import {
  AtomEventTypes,
  type AtomLoggerOptions,
  AtomTransactionTypes,
  createLoggedStore,
} from '../src/index.js';
import { isLoggedStore } from '../src/vanilla/create-logged-store.js';
import type { Store } from '../src/vanilla/types/store.js';

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

describe('store', () => {
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

  it('jotai-devtools should not create a dev store when calling createStore', () => {
    function isDevtoolsStore(store: Store): boolean {
      return 'get_internal_weak_map' in store;
    }

    // Just to be sure that the test file is not running with a devtools store
    expect(isDevtoolsStore(createStore())).toBeFalsy();
  });

  it('should create a logged store', () => {
    expect(isLoggedStore(store)).toBeFalsy();
    store = createLoggedStore(store, defaultOptions);
    expect(isLoggedStore(store)).toBeTruthy();
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
    expect(() => createLoggedStore(fakeStore, defaultOptions)).toThrow(
      'Store must be created by buildStore to read its building blocks',
    );
  });

  it('should return a new store with different get/set/sub methods', () => {
    const parentStore = store;
    const originalGet = store.get;
    const originalSet = store.set;
    const originalSub = store.sub;

    store = createLoggedStore(store, defaultOptions);

    expect(store.get).not.toBe(originalGet);
    expect(store.set).not.toBe(originalSet);
    expect(store.sub).not.toBe(originalSub);

    // Parent store remains unmodified
    expect(parentStore.get).toBe(originalGet);
    expect(parentStore.set).toBe(originalSet);
    expect(parentStore.sub).toBe(originalSub);
  });

  it('should log operations performed through the logged store', () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom(42);

    store.get(testAtom);
    store.set(testAtom, 43);
    const listener = vi.fn();
    store.sub(testAtom, listener);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls.length).toBeGreaterThan(0);
  });

  it('should create an independent logged store', () => {
    expect(isLoggedStore(store)).toBeFalsy();
    store = createLoggedStore(store, defaultOptions);
    expect(isLoggedStore(store)).toBeTruthy();
    expect(consoleMock.log.mock.calls).toEqual([]);
  });

  it('should allow updating options on the logged store state', () => {
    const options: AtomLoggerOptions = {
      ...defaultOptions,
      enabled: true,
    };
    store = createLoggedStore(store, options);

    expect(options.enabled).toBe(true);

    options.enabled = false;

    expect(options.enabled).toBe(false);
  });

  it('should keep the existing formatter when updating options after creation', () => {
    const customFormatter = vi.fn();
    const options: AtomLoggerOptions = {
      formatter: customFormatter,
      enabled: true,
    };
    store = createLoggedStore(store, options);

    const formatterAfterCreation = options.formatter;
    expect(formatterAfterCreation).toBe(customFormatter);

    // Update a core option directly, formatter should remain
    options.enabled = false;

    // Formatter should remain the same instance
    expect(options.formatter).toBe(customFormatter);
    expect(options.enabled).toBe(false);
  });

  it('should throw when given a store without jotai internals', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(() => createLoggedStore(fakeStore)).toThrow(
      'Store must be created by buildStore to read its building blocks',
    );
    consoleErrorSpy.mockRestore();
  });

  it('should return a new store with different get/set/sub methods', () => {
    const parentStore = createStore();
    const loggedStore = createLoggedStore(parentStore);

    expect(loggedStore.get).not.toBe(parentStore.get);
    expect(loggedStore.set).not.toBe(parentStore.set);
    expect(loggedStore.sub).not.toBe(parentStore.sub);
  });

  it('should leave the parent store unmodified', () => {
    const parentStore = createStore();
    const originalGet = parentStore.get;
    const originalSet = parentStore.set;
    const originalSub = parentStore.sub;

    createLoggedStore(parentStore);

    expect(parentStore.get).toBe(originalGet);
    expect(parentStore.set).toBe(originalSet);
    expect(parentStore.sub).toBe(originalSub);
    expect(isLoggedStore(parentStore)).toBeFalsy();
  });

  it('should share internal store hooks with child stores but not with the parent store', () => {
    const parentStore = createStore();
    const loggedStore = createLoggedStore(parentStore);

    const loggedStoreBuildingBlocks = getBuildingBlocks(loggedStore);
    const childStoreStoreHooks = initializeStoreHooks(loggedStoreBuildingBlocks[6]);
    const childStoreBuildingBlocks: BuildingBlocks = [...loggedStoreBuildingBlocks];
    childStoreBuildingBlocks[6] = childStoreStoreHooks;
    const childStore = buildStore(...childStoreBuildingBlocks);

    expect(isLoggedStore(parentStore)).toBeFalsy();
    expect(isLoggedStore(loggedStore)).toBeTruthy();
    expect(isLoggedStore(childStore)).toBeFalsy();

    // The logged store and its child share the same hooks, so operations on both trigger the logger's callbacks.
    expect(getBuildingBlocks(childStore)[6]).toBe(childStoreStoreHooks);
    expect(getBuildingBlocks(loggedStore)[6]).toBe(childStoreStoreHooks);

    // The parent store keeps its own separate hooks so its operations never trigger logger callbacks.
    expect(getBuildingBlocks(parentStore)[6]).not.toBe(childStoreStoreHooks);
  });

  it('should not log transactions performed through the parent store', () => {
    const transactions: unknown[] = [];
    const formatter = vi.fn((transaction) => transactions.push(transaction));

    const parentStore = createStore();
    createLoggedStore(parentStore, { formatter, synchronous: true });

    const testAtom = atom(0);
    parentStore.set(testAtom, 1);

    expect(transactions).toEqual([]);
  });

  it('should not log transactions performed through a sibling logged store', () => {
    const transactions1: unknown[] = [];
    const formatter1 = vi.fn((transaction) => transactions1.push(transaction));
    const transactions2: unknown[] = [];
    const formatter2 = vi.fn((transaction) => transactions2.push(transaction));

    const parentStore = createStore();
    const loggedStore1 = createLoggedStore(parentStore, {
      formatter: formatter1,
      synchronous: true,
    });
    createLoggedStore(parentStore, {
      formatter: formatter2,
      synchronous: true,
    });

    const testAtom = atom(0);
    loggedStore1.set(testAtom, 1);

    expect(transactions1).toEqual([
      expect.objectContaining({
        type: AtomTransactionTypes.storeSet,
        atom: testAtom,
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: testAtom,
            value: 1,
          },
        ],
      }),
    ]);

    expect(transactions2).toEqual([]);
  });

  it('should log transactions performed through a child store', () => {
    const transactions: unknown[] = [];
    const formatter = vi.fn((transaction) => transactions.push(transaction));

    const parentStore = createStore();
    const loggedStore = createLoggedStore(parentStore, { formatter, synchronous: true });
    const childStore = buildStore(...getBuildingBlocks(loggedStore));

    const testAtom = atom(0);
    childStore.set(testAtom, 1);

    expect(transactions.length).toBe(1);
    expect(transactions).toEqual([
      expect.objectContaining({
        type: AtomTransactionTypes.storeSet,
        atom: testAtom,
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: testAtom,
            value: 1,
          },
        ],
      }),
    ]);
  });

  it('should log transactions performed through logged store but not through its parent logged store', () => {
    const parentTransactions1: unknown[] = [];
    const parentFormatter = vi.fn((transaction) => parentTransactions1.push(transaction));
    const childTransactions: unknown[] = [];
    const childFormatter = vi.fn((transaction) => childTransactions.push(transaction));

    const parentStore = createStore();
    const parentLoggedStore = createLoggedStore(parentStore, {
      formatter: parentFormatter,
      synchronous: true,
    });
    const childLoggedStore = createLoggedStore(parentLoggedStore, {
      formatter: childFormatter,
      synchronous: true,
    });

    const testAtom = atom(0);
    childLoggedStore.set(testAtom, 1);

    expect(parentTransactions1).toEqual([]);
    expect(childTransactions).toEqual([
      expect.objectContaining({
        type: AtomTransactionTypes.storeSet,
        atom: testAtom,
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: testAtom,
            value: 1,
          },
        ],
      }),
    ]);
  });

  it('should log transactions performed through a logged store but not through its child logged store', () => {
    const parentTransactions: unknown[] = [];
    const parentFormatter = vi.fn((transaction) => parentTransactions.push(transaction));
    const childTransactions: unknown[] = [];
    const childFormatter = vi.fn((transaction) => childTransactions.push(transaction));

    const parentStore = createStore();
    const parentLoggedStore = createLoggedStore(parentStore, {
      formatter: parentFormatter,
      synchronous: true,
    });
    createLoggedStore(parentLoggedStore, {
      formatter: childFormatter,
      synchronous: true,
    });

    const testAtom = atom(0);
    parentLoggedStore.set(testAtom, 1);

    expect(parentTransactions).toEqual([
      expect.objectContaining({
        type: AtomTransactionTypes.storeSet,
        atom: testAtom,
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: testAtom,
            value: 1,
          },
        ],
      }),
    ]);
    expect(childTransactions).toEqual([]);
  });
});
