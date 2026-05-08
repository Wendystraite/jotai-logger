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

describe('owner stack and component display name', () => {
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

  it('should show owner stack', async () => {
    let stackId = 0;

    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack() {
        return `at MyCounterParent${++stackId} (http://localhost:5173/src/myComponent.tsx?t=1757750948197:31:21)`;
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(stackId).toBe(1);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [MyCounterParent1] retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should show component display name', async () => {
    let displayNameId = 0;

    store = createLoggedStore(store, {
      ...defaultOptions,
      getComponentDisplayName() {
        return `MyCounter${++displayNameId}`;
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(displayNameId).toBe(1);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : MyCounter1 retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should show owner stack and component display name', async () => {
    let stackId = 0;
    let displayNameId = 0;

    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack() {
        return `at MyCounterParent${++stackId} (http://localhost:5173/src/myComponent.tsx?t=1757750948197:31:21)`;
      },
      getComponentDisplayName() {
        return `MyCounter${++displayNameId}`;
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(stackId).toBe(1);
    expect(displayNameId).toBe(1);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [MyCounterParent1] MyCounter1 retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should not show component display name if it is shown at the end of the owner stack components', async () => {
    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack() {
        return `at ParentComponent (http://localhost:5173/src/parent.tsx:30:21)
    at GrandParentComponent (http://localhost:5173/src/grandparent.tsx:40:21)`;
      },
      getComponentDisplayName() {
        return 'ParentComponent';
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [GrandParentComponent.ParentComponent] retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should show component display name if it is not shown at the end of the owner stack components', async () => {
    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack() {
        return `at ParentComponent (http://localhost:5173/src/parent.tsx:30:21)
    at GrandParentComponent (http://localhost:5173/src/grandparent.tsx:40:21)`;
      },
      getComponentDisplayName() {
        return 'GrandParentComponent';
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `transaction 1 : [GrandParentComponent.ParentComponent] GrandParentComponent retrieved value of ${countAtom}`,
      ],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should ignore crashes in getOwnerStack', async () => {
    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack: () => {
        throw new Error('Error in getOwnerStack');
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should ignore crashes in getComponentDisplayName', async () => {
    store = createLoggedStore(store, {
      ...defaultOptions,
      getComponentDisplayName: () => {
        throw new Error('Error in getComponentDisplayName');
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should ignore undefined owner stack traces', async () => {
    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack: () => {
        return undefined;
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should ignore null owner stack traces', async () => {
    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack: () => {
        return null;
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should handle malformed owner stack gracefully', async () => {
    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack() {
        return `malformed stack trace without proper format`;
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should handle empty owner stack', async () => {
    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack() {
        return '';
      },
    });

    const countAtom = atom(0);
    store.get(countAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
    ]);
  });

  it('should not call getOwnerStack if not needed', async () => {
    const getOwnerStackMock = vi.fn(() => {
      return `at MyCounterParent (http://localhost:5173/src/myComponent.tsx?t=1757750948197:31:21)`;
    });

    store = createLoggedStore(store, {
      ...defaultOptions,
      getOwnerStack: getOwnerStackMock,
    });

    const countAtom = atom(0);

    expect(getOwnerStackMock).not.toHaveBeenCalled();

    store.get(countAtom); // 1st call
    store.get(countAtom); // should not call again (value already initialized)
    store.get(countAtom);
    await vi.advanceTimersByTimeAsync(1000);

    expect(getOwnerStackMock).toHaveBeenCalledTimes(1);

    const unSub1 = store.sub(countAtom, vi.fn()); // 2nd call (mounted)
    const unSub2 = store.sub(countAtom, vi.fn());
    await vi.advanceTimersByTimeAsync(1000);

    expect(getOwnerStackMock).toHaveBeenCalledTimes(2);

    store.get(countAtom);
    const unSub3 = store.sub(countAtom, vi.fn());
    unSub1();
    unSub2(); // still mounted
    await vi.advanceTimersByTimeAsync(1000);

    expect(getOwnerStackMock).toHaveBeenCalledTimes(2);

    unSub3(); // 3rd call (unmounted)
    await vi.advanceTimersByTimeAsync(1000);

    expect(getOwnerStackMock).toHaveBeenCalledTimes(3);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : [MyCounterParent] retrieved value of ${countAtom}`],
      [`initialized value of ${countAtom} to 0`, { value: 0 }],
      [`transaction 2 : [MyCounterParent] subscribed to ${countAtom}`],
      [`mounted ${countAtom}`, { value: 0 }],
      [`transaction 3 : [MyCounterParent] unsubscribed from ${countAtom}`],
      [`unmounted ${countAtom}`],
    ]);
  });

  describe('ownerStackLimit', () => {
    const BIG_OWNER_STACK = `at ChildComponent (http://localhost:5173/src/child.tsx:10:21)
    at MiddleComponent (http://localhost:5173/src/middle.tsx:20:21)
    at ParentComponent (http://localhost:5173/src/parent.tsx:30:21)
    at GrandParentComponent (http://localhost:5173/src/grandparent.tsx:40:21)
    at RootComponent (http://localhost:5173/src/root.tsx:50:21)`;

    it('should respect ownerStackLimit default value of 2', async () => {
      store = createLoggedStore(store, {
        ...defaultOptions,
        getOwnerStack() {
          return BIG_OWNER_STACK;
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [MiddleComponent.ChildComponent] retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should show all components when ownerStackLimit is -1', async () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, ownerStackLimit: -1 }),
        getOwnerStack() {
          return BIG_OWNER_STACK;
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `transaction 1 : [RootComponent.GrandParentComponent.ParentComponent.MiddleComponent.ChildComponent] retrieved value of ${countAtom}`,
        ],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should show all components when ownerStackLimit is Infinity', async () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, ownerStackLimit: Infinity }),
        getOwnerStack() {
          return BIG_OWNER_STACK;
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `transaction 1 : [RootComponent.GrandParentComponent.ParentComponent.MiddleComponent.ChildComponent] retrieved value of ${countAtom}`,
        ],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should show no components when ownerStackLimit is 0', async () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, ownerStackLimit: 0 }),
        getOwnerStack() {
          return BIG_OWNER_STACK;
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should show only 1 component when ownerStackLimit is 1', async () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, ownerStackLimit: 1 }),
        getOwnerStack() {
          return BIG_OWNER_STACK;
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [ChildComponent] retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should show limited components when ownerStackLimit is 3', async () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, ownerStackLimit: 3 }),
        getOwnerStack() {
          return BIG_OWNER_STACK;
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `transaction 1 : [ParentComponent.MiddleComponent.ChildComponent] retrieved value of ${countAtom}`,
        ],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should handle single component in owner stack', async () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, ownerStackLimit: 2 }),
        getOwnerStack() {
          return `at ChildComponent (http://localhost:5173/src/child.tsx:10:21)`;
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [ChildComponent] retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should work with ownerStackLimit and component display name', async () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({ ...defaultFormatterOptions, ownerStackLimit: 1 }),
        getOwnerStack() {
          return BIG_OWNER_STACK;
        },
        getComponentDisplayName() {
          return 'CurrentComponent';
        },
      });

      const countAtom = atom(0);
      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [`transaction 1 : [ChildComponent] CurrentComponent retrieved value of ${countAtom}`],
        [`initialized value of ${countAtom} to 0`, { value: 0 }],
      ]);
    });

    it('should work with ownerStackLimit in colored output', async () => {
      store = createLoggedStore(store, {
        formatter: consoleFormatter({
          ...defaultFormatterOptions,
          formattedOutput: true,
          ownerStackLimit: 1,
        }),
        getOwnerStack() {
          return BIG_OWNER_STACK;
        },
        getComponentDisplayName() {
          return 'CurrentComponent';
        },
      });

      const countAtom = atom(0);
      const atomNumber = /atom(\d+)(.*)/.exec(countAtom.toString())?.[1];
      expect(Number.isInteger(parseInt(atomNumber!))).toBeTruthy();

      store.get(countAtom);

      await vi.advanceTimersByTimeAsync(1000);

      expect(consoleMock.log.mock.calls).toEqual([
        [
          `%ctransaction %c1 %c: %c[ChildComponent] %cCurrentComponent %cretrieved value %cof %catom%c${atomNumber}`,
          'color: #757575; font-weight: normal;', // transaction
          'color: default; font-weight: normal;', // 1
          'color: #757575; font-weight: normal;', // :
          'color: #757575; font-weight: normal;', // [ChildComponent]
          'color: default; font-weight: normal;', // CurrentComponent
          'color: #0072B2; font-weight: bold;', // retrieved value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
        ],
        [
          `%cinitialized value %cof %catom%c${atomNumber} %cto %c0`,
          'color: #0072B2; font-weight: bold;', // initialized value
          'color: #757575; font-weight: normal;', // of
          'color: #757575; font-weight: normal;', // atom
          'color: default; font-weight: normal;', // atomNumber
          'color: #757575; font-weight: normal;', // to
          'color: default; font-weight: normal;', // 0
          { value: 0 },
        ],
      ]);
    });
  });
});
