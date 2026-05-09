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

describe('options.autoAlignTransactions', () => {
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

  it('should automatically align transaction components when autoAlignTransactions is enabled', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionNumber: true,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: true,
        autoAlignTransactions: true,
      }),
    });

    // transaction 1 - 1 event - 1.00 ms
    const atom1 = atom(() => {
      vi.advanceTimersByTime(1);
      return 0;
    });
    store.get(atom1);
    vi.runAllTimers();

    // transaction 2 - 2 events - 123.00 ms
    const atom2 = atom(() => {
      vi.advanceTimersByTime(123);
      return 0;
    });
    const atom3 = atom((get) => get(atom2));
    store.get(atom3);
    vi.runAllTimers();

    // transaction 3 - 12 events - 10.00 ms
    const atom4 = atom(() => {
      vi.advanceTimersByTime(10);
      return 0;
    });
    const atoms = Array.from({ length: 10 }, () => atom(0));
    const atom5 = atom((get) => atoms.reduce((sum, a) => sum + get(a), get(atom4)));
    store.get(atom5);
    vi.runAllTimers();

    // transaction 4 - 1 event - 11.11 ms
    const atom6 = atom(() => {
      vi.advanceTimersByTime(11.11);
      return 0;
    });
    store.get(atom6);
    vi.runAllTimers();

    // transaction 5 - 2 events - 1.00 ms
    const atom7 = atom(() => {
      vi.advanceTimersByTime(1);
      return 0;
    });
    const atom8 = atom((get) => get(atom7));
    store.get(atom8);
    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 1 event  - 1.00 ms : retrieved value of ${atom1}`],
      //                       ^-- "s" padding
      [`initialized value of ${atom1} to 0`, { value: 0 }],

      [`transaction 2 - 2 events - 123.00 ms : retrieved value of ${atom3}`],
      [`initialized value of ${atom2} to 0`, { value: 0 }],
      [`initialized value of ${atom3} to 0`, { value: 0, dependencies: [`${atom2}`] }],

      //                                 v-- align
      [`transaction 3 - 12 events - 10.00  ms : retrieved value of ${atom5}`],
      [`initialized value of ${atom4} to 0`, { value: 0 }],
      ...atoms.map((a) => [`initialized value of ${a} to 0`, { value: 0 }]),
      [
        `initialized value of ${atom5} to 0`,
        {
          value: 0,
          dependencies: [`${atom4}`, ...atoms.map((a) => `${a}`)],
        },
      ],

      //                 v---- align ----v
      [`transaction 4 - 1  event  - 11.11  ms : retrieved value of ${atom6}`],
      //                        ^-- "s" padding
      [`initialized value of ${atom6} to 0`, { value: 0 }],

      //                 v---- align ---v
      [`transaction 5 - 2  events - 1.00   ms : retrieved value of ${atom8}`],
      [`initialized value of ${atom7} to 0`, { value: 0 }],
      [`initialized value of ${atom8} to 0`, { value: 0, dependencies: [`${atom7}`] }],
    ]);
  });

  it('should align left events count when autoAlignTransactions is true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionNumber: false,
        showTransactionEventsCount: true,
        autoAlignTransactions: true,
      }),
    });

    // 1 event
    const atom1 = atom(0);
    store.get(atom1);
    vi.runAllTimers();

    // 2 events
    const atom2 = atom(0);
    const atom3 = atom((get) => get(atom2));
    store.get(atom3);
    vi.runAllTimers();

    // 11 events
    const atoms = Array.from({ length: 10 }, () => atom(0));
    const atom4 = atom((get) => atoms.reduce((sum, a) => sum + get(a), 0));
    store.get(atom4);
    vi.runAllTimers();

    // 1 event
    const atom5 = atom(0);
    store.get(atom5);
    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`1 event  : retrieved value of ${atom1}`],
      //       ^-- "s" padding
      [`initialized value of ${atom1} to 0`, { value: 0 }],

      [`2 events : retrieved value of ${atom3}`],
      [`initialized value of ${atom2} to 0`, { value: 0 }],
      [`initialized value of ${atom3} to 0`, { value: 0, dependencies: [`${atom2}`] }],

      [`11 events : retrieved value of ${atom4}`],
      ...atoms.map((a) => [`initialized value of ${a} to 0`, { value: 0 }]),
      [`initialized value of ${atom4} to 0`, { value: 0, dependencies: atoms.map((a) => `${a}`) }],
      // v-- align
      [`1  event  : retrieved value of ${atom5}`],
      //        ^-- "s" padding
      [`initialized value of ${atom5} to 0`, { value: 0 }],
    ]);
  });

  it('should align left elapsed time when autoAlignTransactions is true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionNumber: false,
        showTransactionEventsCount: false,
        showTransactionLocaleTime: false,
        showTransactionElapsedTime: true,
        autoAlignTransactions: true,
      }),
    });

    // Short elapsed time
    const atom1 = atom(() => {
      vi.advanceTimersByTime(5.5);
      return 0;
    });
    store.get(atom1);
    vi.runAllTimers();

    // Longer elapsed time
    const atom2 = atom(() => {
      vi.advanceTimersByTime(123.45);
      return 0;
    });
    store.get(atom2);
    vi.runAllTimers();

    // Short elapsed time again
    const atom3 = atom(() => {
      vi.advanceTimersByTime(7.89);
      return 0;
    });
    store.get(atom3);
    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`5.50 ms : retrieved value of ${atom1}`],
      [`initialized value of ${atom1} to 0`, { value: 0 }],

      [`123.45 ms : retrieved value of ${atom2}`],
      [`initialized value of ${atom2} to 0`, { value: 0 }],
      //    v-- align
      [`7.89   ms : retrieved value of ${atom3}`],
      [`initialized value of ${atom3} to 0`, { value: 0 }],
    ]);
  });

  it('should log zero elapsed time when autoAlignTransactions is true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionElapsedTime: true,
        autoAlignTransactions: true,
      }),
    });

    const atom1 = atom(() => {
      vi.advanceTimersByTime(1234);
      return 0;
    });
    store.get(atom1);
    vi.runAllTimers();

    const atom2 = atom(0);
    store.get(atom2);
    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 1234.00 ms : retrieved value of ${atom1}`],
      [`initialized value of ${atom1} to 0`, { value: 0 }],

      //                v-- still present to align with previous transaction
      [`transaction 2 - 0.00    ms : retrieved value of ${atom2}`],
      [`initialized value of ${atom2} to 0`, { value: 0 }],
    ]);
  });

  it('should not apply alignment when autoAlignTransactions is disabled', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        showTransactionEventsCount: true,
        showTransactionElapsedTime: true,
        autoAlignTransactions: false,
      }),
    });

    // 12 events
    const atom1 = atom(() => {
      vi.advanceTimersByTime(1234);
      return 0;
    });
    const atoms = Array.from({ length: 11 }, () => atom(0));
    const atom2 = atom((get) => atoms.reduce((sum, a) => sum + get(a), get(atom1)));
    store.get(atom2);
    vi.runAllTimers();

    // 1 event
    const atom3 = atom(() => {
      vi.advanceTimersByTime(1);
      return 0;
    });
    store.get(atom3);
    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 - 13 events - 1234.00 ms : retrieved value of ${atom2}`],
      [`initialized value of ${atom1} to 0`, { value: 0 }],
      ...atoms.map((a) => [`initialized value of ${a} to 0`, { value: 0 }]),
      [
        `initialized value of ${atom2} to 0`,
        { value: 0, dependencies: [`${atom1}`, ...atoms.map((a) => `${a}`)] },
      ],

      [`transaction 2 - 1 event - 1.00 ms : retrieved value of ${atom3}`],
      [`initialized value of ${atom3} to 0`, { value: 0 }],
    ]);
  });
});
