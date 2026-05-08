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
});
