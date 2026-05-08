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

describe('options.indentSpaces', () => {
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

  it('should respect custom options', () => {
    const options: AtomLoggerOptions = {
      enabled: false,
      shouldShowPrivateAtoms: true,
    };

    store = createLoggedStore(store, options);

    // Only core options are stored in logger state
    expect(options.enabled).toBe(false);
    expect(options.shouldShowPrivateAtoms).toBe(true);
  });

  it('should log indentation when `indentSpaces` is set to a value greater than 0', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, indentSpaces: 2 }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`  initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should not log indentation when `indentSpaces` is set to 0', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, indentSpaces: 0 }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should log group indentation when `indentSpaces` is set to a value greater than 0', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        indentSpaces: 3,
        groupTransactions: true,
        groupEvents: true,
      }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.group.mock.calls).toEqual([
      // 0 spaces
      [`transaction 1 : retrieved value of ${testAtom}`],
      // 3 spaces
      [`   initialized value of ${testAtom} to 0`],
    ]);
    expect(consoleMock.groupCollapsed.mock.calls).toEqual([]);
    expect(consoleMock.log.mock.calls).toEqual([
      // 6 spaces
      ['      value', 0],
    ]);
    expect(consoleMock.groupEnd.mock.calls).toEqual([[], []]);
  });

  it('should log sub-log indentation when `indentSpaces` is set and there are sub-logs', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, indentSpaces: 2 }),
    });

    const aAtom = atom(1);
    const bAtom = atom((get) => get(aAtom) * 2);
    store.get(bAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${bAtom}`],
      [`  initialized value of ${aAtom} to 1`, { value: 1 }],
      [`  initialized value of ${bAtom} to 2`, { dependencies: [`${aAtom}`], value: 2 }],
    ]);
  });
});
