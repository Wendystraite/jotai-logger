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
import { createLoggedStore } from '../src/index.js';

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

describe('options.showTransactionEventsCount', () => {
  let store: ReturnType<typeof createStore>;
  let consoleMock: {
    log: Mock;
    group: Mock;
    groupEnd: Mock;
    groupCollapsed: Mock;
  };
  let defaultFormatterOptions: ConsoleFormatterOptions;

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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show the number of events when showTransactionEventsCount is enabled', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionEventsCount: true,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 1 event : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should not show the number of events when showTransactionEventsCount is disabled', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionEventsCount: false,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should show the correct number of events for multiple events in a transaction', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionEventsCount: true,
      }),
    });

    const atom1 = atom(0);
    const atom2 = atom(0);
    const derivedAtom = atom((get) => get(atom1) + get(atom2));

    store.get(derivedAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 3 events : retrieved value of ${derivedAtom}`],
      [`initialized value of ${atom1} to 0`, { value: 0 }],
      [`initialized value of ${atom2} to 0`, { value: 0 }],
      [
        `initialized value of ${derivedAtom} to 0`,
        { value: 0, dependencies: [`${atom1}`, `${atom2}`] },
      ],
    ]);
  });

  it('should show singular form for one event', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionEventsCount: true,
      }),
    });

    const testAtom = atom(42);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 1 event : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 42`, { value: 42 }],
    ]);
  });

  it('should show events count with colors when formattedOutput is enabled', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionEventsCount: true,
        formattedOutput: true,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c- %c1 event %c: %cretrieved value %cof %catom%c${atomNumber}`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // -
        'color: #757575; font-weight: normal;', // 1 event
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
