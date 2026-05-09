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

describe('options.domain', () => {
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

  it('should not log domain when empty', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, domain: '' }),
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
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, domain: 'test-domain' }),
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
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        formattedOutput: true,
        domain: 'test-domain',
      }),
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
