// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { atom, createStore } from 'jotai';
import type { Atom } from 'jotai';
import { useAtomsDevtools } from 'jotai-devtools';
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
import { bindAtomsLoggerToStore, useAtomsLogger } from '../src/index.js';
import type { AtomsLoggerOptions, StoreWithAtomsLogger } from '../src/types/atoms-logger.js';
import { isDevtoolsStore } from '../src/utils/get-internal-building-blocks.js';

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

describe('useAtomsLogger', () => {
  it('jotai-devtools should create a dev store when calling createStore', () => {
    expect(isDevtoolsStore(createStore())).toBeTruthy();
  });

  it('should bind the logger to the store created by jotai-devtools', () => {
    const store = createStore();
    expect(isAtomsLoggerBoundToStore(store)).toBeFalsy();
    expect(isDevtoolsStore(store)).toBeTruthy();
    renderHook(() => {
      useAtomsDevtools('devtools', { store });
      useAtomsLogger({ store });
    });
    expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
    expect(isDevtoolsStore(store)).toBeTruthy();
    expect((store as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL]).toEqual(
      expect.objectContaining({
        prevDevtoolsMountedAtomsAdd: expect.any(Function) as Set<Atom<unknown>>['add'],
        prevDevtoolsMountedAtomsDelete: expect.any(Function) as Set<Atom<unknown>>['delete'],
      }),
    );
  });
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

  it('should bind the logger to the store created by jotai-devtools', () => {
    expect(isAtomsLoggerBoundToStore(store)).toBeFalsy();
    expect(isDevtoolsStore(store)).toBeTruthy();
    expect(bindAtomsLoggerToStore(store)).toBe(true);
    expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
    expect(isDevtoolsStore(store)).toBeTruthy();
    expect((store as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL]).toEqual(
      expect.objectContaining({
        prevDevtoolsMountedAtomsAdd: expect.any(Function) as Set<Atom<unknown>>['add'],
        prevDevtoolsMountedAtomsDelete: expect.any(Function) as Set<Atom<unknown>>['delete'],
      }),
    );
  });

  it('should log mounted and unmounted atoms with a devtool store', () => {
    expect(isDevtoolsStore(store)).toBeTruthy();
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

  it('should log dependents when mounted with a devtool store', () => {
    expect(isDevtoolsStore(store)).toBeTruthy();
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
});
