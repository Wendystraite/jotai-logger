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

describe('dependents', () => {
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

  it('should not log dependents when not mounted', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom((get) => get(aAtom) * 2);

    store.get(bAtom); // store.get does not mount the atom

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${bAtom}`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [`initialized value of ${bAtom} to 2`, { dependencies: [`${aAtom}`], value: 2 }],
    ]);
  });

  it('should log dependents when mounted', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom((get) => get(aAtom) * 2);

    store.sub(bAtom, vi.fn()); // store.sub mounts the atom

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${bAtom}`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [`initialized value of ${bAtom} to 2`, { value: 2, dependencies: [`${aAtom}`] }],
      [`mounted ${aAtom}`, { value: 1 }],
      [`mounted ${bAtom}`, { value: 2, dependencies: [`${aAtom}`] }],
    ]);
  });

  it('should log dependents after dependent is initialized', () => {
    store = createLoggedStore(store, defaultOptions);

    const firstAtom = atom('first');
    const secondAtom = atom('second');
    const resultAtom = atom((get) => get(firstAtom) + ' ' + get(secondAtom));

    // secondAtom doesn't have yet dependents yet since resultAtom is not mounted yet
    store.get(secondAtom);

    // secondAtom should have dependents now
    store.sub(resultAtom, vi.fn());

    // change his value to trigger the log
    store.set(secondAtom, '2nd');

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${secondAtom}`],
      [`initialized value of ${secondAtom} to "second"`, { value: 'second' }],

      [`transaction 2 : subscribed to ${resultAtom}`],
      [`initialized value of ${firstAtom} to "first"`, { value: 'first' }],
      [
        `initialized value of ${resultAtom} to "first second"`,
        {
          dependencies: [`${firstAtom}`, `${secondAtom}`],
          value: 'first second',
        },
      ],
      [`mounted ${firstAtom}`, { value: 'first' }],
      [`mounted ${secondAtom}`, { value: 'second' }],
      [
        `mounted ${resultAtom}`,
        { dependencies: [`${firstAtom}`, `${secondAtom}`], value: 'first second' },
      ],

      [`transaction 3 : set value of ${secondAtom} to "2nd"`, { value: '2nd' }],
      [
        `changed value of ${secondAtom} from "second" to "2nd"`,
        {
          dependents: [`${resultAtom}`], // here he is
          newValue: '2nd',
          oldValue: 'second',
        },
      ],
      [
        `changed value of ${resultAtom} from "first second" to "first 2nd"`,
        {
          dependencies: [`${firstAtom}`, `${secondAtom}`],
          newValue: 'first 2nd',
          oldValue: 'first second',
        },
      ],
    ]);
  });
});
