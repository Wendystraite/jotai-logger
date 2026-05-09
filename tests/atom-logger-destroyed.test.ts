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
import type { AtomId } from '../src/vanilla/types/event.js';

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

describe('destroyed', () => {
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

  let finalizationRegistryRegisterMock: Mock;
  let finalizationRegistryUnregisterMock: Mock;
  let registeredCallback: ((heldValue: AtomId) => void) | null;

  beforeEach(() => {
    finalizationRegistryRegisterMock = vi.fn();
    finalizationRegistryUnregisterMock = vi.fn();
    registeredCallback = null;
    vi.spyOn(globalThis, 'FinalizationRegistry').mockImplementation(
      function (callback): FinalizationRegistry<AtomId> {
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
    store = createLoggedStore(store, defaultOptions);

    expect(finalizationRegistryRegisterMock).not.toHaveBeenCalled();

    const testAtom = atom(42);
    store.get(testAtom);

    expect(finalizationRegistryRegisterMock).toHaveBeenCalled();
    expect(finalizationRegistryRegisterMock.mock.calls).toEqual([[testAtom, testAtom.toString()]]);
  });

  it('should log when an atom is garbage collected', () => {
    store = createLoggedStore(store, defaultOptions);

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
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
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
    store = createLoggedStore(store, { ...defaultOptions, enabled: false });

    expect(registeredCallback).not.toBeNull();

    const testAtom = atom(42);
    store.get(testAtom);

    vi.runAllTimers();

    registeredCallback!(testAtom.toString());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([]);
  });

  it('should not log when an atom is garbage collected if the store just got disabled', () => {
    store = createLoggedStore(store, { ...defaultOptions, enabled: true });

    expect(registeredCallback).not.toBeNull();

    const testAtom = atom(42);
    store.get(testAtom);

    vi.runAllTimers();

    store = createLoggedStore(store, { ...defaultOptions, enabled: false });

    registeredCallback!(testAtom.toString());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
    ]);
  });
});
