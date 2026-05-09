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

describe('debugLabel', () => {
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

  it('should log atoms without debug labels', () => {
    store = createLoggedStore(store, defaultOptions);

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
    store = createLoggedStore(store, defaultOptions);

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
    store = createLoggedStore(store, defaultOptions);

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
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
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
