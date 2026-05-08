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

describe('options.showTransactionNumber', () => {
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

  it('should not log transaction numbers when showTransactionNumber is disabled', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, showTransactionNumber: false }),
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
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionNumber: false,
        showTransactionElapsedTime: false,
        showTransactionLocaleTime: false,
      }),
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
