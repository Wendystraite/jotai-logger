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
import type { AnyAtom } from '../src/vanilla/types/event.js';

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

describe('options', () => {
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

  describe('shouldShowAtom', () => {
    it('should respect shouldShowAtom option', () => {
      const shouldShowAtom = (a: AnyAtom) => a === testAtom1;
      store = createLoggedStore(store, { ...defaultOptions, shouldShowAtom });

      const testAtom1 = atom(1);
      const testAtom2 = atom(2);

      store.get(testAtom1);
      vi.runAllTimers();

      expect(consoleMock.log).toHaveBeenCalled();
      consoleMock.log.mockClear();

      store.get(testAtom2);
      vi.runAllTimers();

      expect(consoleMock.log).not.toHaveBeenCalled();
    });
  });

  describe('shouldShowPrivateAtoms', () => {
    it('should not log private atoms by default', () => {
      store = createLoggedStore(store, defaultOptions);

      const privateAtom = atom(0);
      privateAtom.debugPrivate = true;

      const publicAtom = atom(1);
      publicAtom.debugLabel = 'Public Atom';

      store.get(privateAtom);
      store.get(publicAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${publicAtom}`],
        [`initialized value of ${publicAtom} to 1`, { value: 1 }],
      ]);
    });

    it('should log private atoms when shouldShowPrivateAtoms is true', () => {
      store = createLoggedStore(store, {
        ...defaultOptions,
        shouldShowPrivateAtoms: true,
      });

      const privateAtom = atom(0);
      privateAtom.debugPrivate = true;
      privateAtom.debugLabel = 'Private Atom';

      const publicAtom = atom(1);
      publicAtom.debugLabel = 'Public Atom';

      store.get(privateAtom);
      store.get(publicAtom);

      vi.runAllTimers();

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${privateAtom}`],
        [`initialized value of ${privateAtom} to 0`, { value: 0 }],

        [`transaction 2 : retrieved value of ${publicAtom}`],
        [`initialized value of ${publicAtom} to 1`, { value: 1 }],
      ]);
    });
  });
});
