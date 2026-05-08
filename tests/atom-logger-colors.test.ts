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

describe('colors', () => {
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

  it('should not log colors if formattedOutput is false', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: false }),
    });

    const testAtom = atom(0);
    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should log colors if formattedOutput is true', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
    });

    const testAtom = atom(0);

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
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

  it('should log atom name without namespaces with color', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
    });

    const testAtom = atom(0);
    testAtom.debugLabel = 'testAtomWithoutNamespaces';

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}%c:%ctestAtomWithoutNamespaces`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #0072B2; font-weight: bold;', // retrieved value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: default; font-weight: normal;', // testAtomWithoutNamespaces
      ],
      [
        `%cinitialized value %cof %catom%c${atomNumber}%c:%ctestAtomWithoutNamespaces %cto %c0`,
        'color: #0072B2; font-weight: bold;', // initialized value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: default; font-weight: normal;', // testAtomWithoutNamespaces
        'color: #757575; font-weight: normal;', // to
        'color: default; font-weight: normal;', // 0
        { value: 0 },
      ],
    ]);
  });

  it('should log atom name namespaces with colors', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
    });

    const testAtom = atom(0);
    testAtom.debugLabel = 'test/atom/with/namespaces';

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}%c:%ctest%c/%catom%c/%cwith%c/namespaces`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #0072B2; font-weight: bold;', // retrieved value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #757575; font-weight: normal;', // test
        'color: default; font-weight: normal;', // /
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // /
        'color: #757575; font-weight: normal;', // with
        'color: default; font-weight: normal;', // /namespaces
      ],
      [
        `%cinitialized value %cof %catom%c${atomNumber}%c:%ctest%c/%catom%c/%cwith%c/namespaces %cto %c0`,
        'color: #0072B2; font-weight: bold;', // initialized value
        'color: #757575; font-weight: normal;', // of
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #757575; font-weight: normal;', // test
        'color: default; font-weight: normal;', // /
        'color: #757575; font-weight: normal;', // atom
        'color: default; font-weight: normal;', // /
        'color: #757575; font-weight: normal;', // with
        'color: default; font-weight: normal;', // /namespaces
        'color: #757575; font-weight: normal;', // to
        'color: default; font-weight: normal;', // 0
        { value: 0 },
      ],
    ]);
  });

  it('should log dark colors with dark colorScheme option', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        formattedOutput: true,
        colorScheme: 'dark',
      }),
    });

    const testAtom = atom(0);

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
        'color: #999999; font-weight: normal;',
        'color: default; font-weight: normal;',
        'color: #999999; font-weight: normal;',
        'color: #009EFA; font-weight: bold;',
        'color: #999999; font-weight: normal;',
        'color: #999999; font-weight: normal;',
        'color: default; font-weight: normal;',
      ],
      [
        `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
        'color: #009EFA; font-weight: bold;',
        'color: #999999; font-weight: normal;',
        'color: #999999; font-weight: normal;',
        'color: default; font-weight: normal;',
        'color: #999999; font-weight: normal;',
        'color: default; font-weight: normal;',
        { value: 0 },
      ],
    ]);
  });

  it('should log light colors with light colorScheme option', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({
        ...defaultFormatterOptions,
        formattedOutput: true,
        colorScheme: 'light',
      }),
    });

    const testAtom = atom(0);

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %cretrieved value %cof %catom%c${atomNumber}`,
        'color: #6E6E6E; font-weight: normal;',
        'color: default; font-weight: normal;',
        'color: #6E6E6E; font-weight: normal;',
        'color: #0072B2; font-weight: bold;',
        'color: #6E6E6E; font-weight: normal;',
        'color: #6E6E6E; font-weight: normal;',
        'color: default; font-weight: normal;',
      ],
      [
        `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
        'color: #0072B2; font-weight: bold;',
        'color: #6E6E6E; font-weight: normal;',
        'color: #6E6E6E; font-weight: normal;',
        'color: default; font-weight: normal;',
        'color: #6E6E6E; font-weight: normal;',
        'color: default; font-weight: normal;',
        { value: 0 },
      ],
    ]);
  });

  it('should log colored stack traces', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
      getOwnerStack() {
        return `at MyComponentParent (http://localhost:5173/src/myComponent.tsx?t=1757750948197:31:21)`;
      },
      getComponentDisplayName() {
        return 'MyComponent';
      },
    });

    const testAtom = atom(0);

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %c[MyComponentParent] %cMyComponent %cretrieved value %cof %catom%c${atomNumber}`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #757575; font-weight: normal;', // [MyComponentParent]
        'color: default; font-weight: normal;', // MyComponent
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

  it('should log colored stack traces with hooks', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
      getOwnerStack() {
        return `at ParentContainer (http://localhost:5173/src/App.tsx?t=1757750948197:31:21)
    at App (http://localhost:5173/src/App.tsx?t=1757750948197:108:21)`;
      },
      getComponentDisplayName() {
        return 'MyComponent';
      },
    });

    const testAtom = atom(0);

    const atomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

    store.get(testAtom);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %c[App.ParentContainer] %cMyComponent %cretrieved value %cof %catom%c${atomNumber}`,
        'color: #757575; font-weight: normal;', // transaction
        'color: default; font-weight: normal;', // 1
        'color: #757575; font-weight: normal;', // :
        'color: #757575; font-weight: normal;', // [App.ParentContainer]
        'color: default; font-weight: normal;', // MyComponent
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
