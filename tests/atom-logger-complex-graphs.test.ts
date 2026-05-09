import { atom } from 'jotai';
import { loadable } from 'jotai-loadable';
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

describe('complex graphs', () => {
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

  it('should log async atoms with dependencies and dependents', async () => {
    store = createLoggedStore(store, defaultOptions);

    const firstAtom = atom('first');
    const secondAtom = atom('second');
    const thirdAsyncAtom = atom<Promise<string>>(async (get) => {
      const third = get(firstAtom) + ' ' + 'third';
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(third);
        }, 500);
      });
    });

    // loadable uses unwrap internally and since loadable doesn't expose it, we use a regex to match it
    const unwrappedThirdAsyncAtomDebugLabelRegex = new RegExp(`atom\\d+`);

    const resultAtom = atom((get) => {
      const second = get(secondAtom);
      const third = get(loadable(thirdAsyncAtom));
      return `${second} ${third.state === 'hasData' ? third.data : third.state}`;
    });

    store.sub(resultAtom, vi.fn());

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${resultAtom}`],

      // result <-- second
      [
        `initialized value of ${secondAtom} to "second"`,
        {
          value: 'second',
          dependents: [`${resultAtom}`],
        },
      ],
      // result <-- loadable(thirdAsync) <-- thirdAsync <-- first
      [
        `initialized value of ${firstAtom} to "first"`,
        {
          value: 'first',
          dependents: [`${thirdAsyncAtom}`],
          pendingPromises: [`${thirdAsyncAtom}`],
        },
      ],
      // result <-- loadable(thirdAsync) <-- thirdAsync
      [
        `pending initial promise of ${thirdAsyncAtom}`,
        {
          dependencies: [`${firstAtom}`],
        },
      ],
      // result <-- loadable(thirdAsync)
      [
        expect.stringMatching(
          new RegExp(
            `initialized value of ${unwrappedThirdAsyncAtomDebugLabelRegex.source} to {"state":"loading"}`,
          ),
        ),
        {
          value: { state: 'loading' },
          dependents: [`${loadable(thirdAsyncAtom)}`],
        },
      ],
      [
        `initialized value of ${loadable(thirdAsyncAtom)} to {"state":"loading"}`,
        {
          value: { state: 'loading' },
          dependencies: [expect.stringMatching(unwrappedThirdAsyncAtomDebugLabelRegex)],
          dependents: [`${resultAtom}`],
        },
      ],
      // result
      [
        `initialized value of ${resultAtom} to "second loading"`,
        {
          value: 'second loading',
          dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
        },
      ],
      [
        `mounted ${secondAtom}`,
        {
          value: 'second',
          dependents: [`${resultAtom}`],
        },
      ],
      [
        `mounted ${firstAtom}`,
        {
          value: 'first',
          dependents: [`${thirdAsyncAtom}`],
          pendingPromises: [`${thirdAsyncAtom}`],
        },
      ],
      [
        `mounted ${thirdAsyncAtom}`,
        {
          dependencies: [`${firstAtom}`],
        },
      ],
      [
        expect.stringMatching(
          new RegExp(`mounted ${unwrappedThirdAsyncAtomDebugLabelRegex.source}`),
        ),
        {
          value: { state: 'loading' },
          dependents: [`${loadable(thirdAsyncAtom)}`],
        },
      ],
      [
        `mounted ${loadable(thirdAsyncAtom)}`,
        {
          value: { state: 'loading' },
          dependencies: [expect.stringMatching(unwrappedThirdAsyncAtomDebugLabelRegex)],
          dependents: [`${resultAtom}`],
        },
      ],
      [
        `mounted ${resultAtom}`,
        {
          value: 'second loading',
          dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
        },
      ],

      [`transaction 2 : resolved promise of ${thirdAsyncAtom}`],
      // result <-- loadable(thirdAsync) <-- thirdAsync <-- promise resolved
      [
        `resolved initial promise of ${thirdAsyncAtom} to "first third"`,
        {
          value: 'first third',
          dependencies: [`${firstAtom}`],
        },
      ],
      ['transaction 3'],
      [
        expect.stringMatching(
          new RegExp(
            `changed value of ${unwrappedThirdAsyncAtomDebugLabelRegex.source} from {"state":"loading"} to "first third"`,
          ),
        ),
        {
          newValue: 'first third',
          oldValue: { state: 'loading' },
          dependents: [`${loadable(thirdAsyncAtom)}`],
        },
      ],
      // result <-- loadable(thirdAsync)
      [
        `changed value of ${loadable(thirdAsyncAtom)} from {"state":"loading"} to {"state":"hasData","data":"first third"}`,
        {
          newValue: { data: 'first third', state: 'hasData' },
          oldValue: { state: 'loading' },
          dependencies: [expect.stringMatching(unwrappedThirdAsyncAtomDebugLabelRegex)],
          dependents: [`${resultAtom}`],
        },
      ],
      // result
      [
        `changed value of ${resultAtom} from "second loading" to "second first third"`,
        {
          newValue: 'second first third',
          oldValue: 'second loading',
          dependencies: [`${secondAtom}`, `${loadable(thirdAsyncAtom)}`],
        },
      ],
    ]);
  });
});
