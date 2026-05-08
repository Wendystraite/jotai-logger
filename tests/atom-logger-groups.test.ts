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

describe('groups', () => {
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

  it('should group transactions if groupTransactions is true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, groupTransactions: true }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
    ]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([]);
    expect(consoleMock.log.mock.calls).toEqual([
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[]]);
  });

  it('should collapse transaction groups if collapseTransactions is true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupTransactions: true,
        collapseTransactions: true,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
    ]);
    expect(consoleMock.log.mock.calls).toEqual([
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[]]);
  });

  it('should group events if groupEvents is true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, groupEvents: true }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([[`initialized value of ${testAtom} to 0`]]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([]);
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      ['value', 0],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[]]);
  });

  it('should collapse event groups if collapseEvents is true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupEvents: true,
        collapseEvents: true,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([
      [`initialized value of ${testAtom} to 0`],
    ]);
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      ['value', 0],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[]]);
  });

  it('should group transactions and events if both groupTransactions and groupEvents are true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupTransactions: true,
        groupEvents: true,
      }),
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

  it('should group collapsed events and transactions if both collapseTransactions and collapseEvents are true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupTransactions: true,
        groupEvents: true,
        collapseTransactions: true,
        collapseEvents: true,
      }),
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

  it('should log collapsed transaction groups even if logger.group is not defined', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupTransactions: true,
        collapseTransactions: true,
        logger: {
          log: consoleMock.log,
          group: undefined,
          groupCollapsed: consoleMock.groupCollapsed,
          groupEnd: consoleMock.groupEnd,
        },
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
    ]);
    expect(consoleMock.log.mock.calls).toEqual([
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[]]);
  });

  it('should log event groups even if logger.group is not defined', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupEvents: true,
        collapseEvents: true,
        logger: {
          log: consoleMock.log,
          group: undefined,
          groupCollapsed: consoleMock.groupCollapsed,
          groupEnd: consoleMock.groupEnd,
        },
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([
      [`initialized value of ${testAtom} to 0`],
    ]);
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      ['value', 0],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[]]);
  });

  it('should log transaction groups even if logger.groupCollapsed is not defined', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupTransactions: true,
        collapseTransactions: false,
        logger: {
          log: consoleMock.log,
          group: consoleMock.group,
          groupCollapsed: undefined,
          groupEnd: consoleMock.groupEnd,
        },
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
    ]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([]);
    expect(consoleMock.log.mock.calls).toEqual([
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[]]);
  });

  it('should log event groups even if logger.groupCollapsed is not defined', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupEvents: true,
        collapseEvents: false,
        logger: {
          log: consoleMock.log,
          group: consoleMock.group,
          groupCollapsed: undefined,
          groupEnd: consoleMock.groupEnd,
        },
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([[`initialized value of ${testAtom} to 0`]]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([]);
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      ['value', 0],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[]]);
  });

  it('should not log transaction and event groups if logger.groupEnd is not defined', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        groupTransactions: true,
        groupEvents: true,
        logger: {
          log: consoleMock.log,
          group: consoleMock.group,
          groupCollapsed: consoleMock.groupCollapsed,
          groupEnd: undefined,
        },
      }),
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
