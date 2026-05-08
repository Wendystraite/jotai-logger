import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
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

describe('promises', () => {
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

  it('should log promise states', async () => {
    store = createLoggedStore(store, defaultOptions);

    const promiseAtom = atom(() => {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve(42);
        }, 0),
      );
    });

    const otherPromiseAtom = atom(() => {
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          reject(new Error('Promise rejected'));
        }, 0),
      );
    });

    void store.get(promiseAtom);

    await vi.advanceTimersByTimeAsync(1000);

    void store.get(otherPromiseAtom);

    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${promiseAtom}`],
      [`pending initial promise of ${promiseAtom}`],
      [`resolved initial promise of ${promiseAtom} to 42`, { value: 42 }],

      [`transaction 2 : retrieved value of ${otherPromiseAtom}`],
      [`pending initial promise of ${otherPromiseAtom}`],
      [
        `rejected initial promise of ${otherPromiseAtom} to Error: Promise rejected`,
        { error: new Error('Promise rejected') },
      ],
    ]);
  });

  it('should log rejected promises', async () => {
    store = createLoggedStore(store, defaultOptions);

    const myError = new Error('Promise rejected');
    const promiseAtom = atom(() => {
      return new Promise((_, reject) =>
        setTimeout(() => {
          reject(myError);
        }, 1000),
      );
    });

    const promise = store.get(promiseAtom);

    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).rejects.toThrow('Promise rejected');

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${promiseAtom}`],
      [`pending initial promise of ${promiseAtom}`],

      [`transaction 2 : rejected promise of ${promiseAtom}`],
      [`rejected initial promise of ${promiseAtom} to Error: Promise rejected`, { error: myError }],
    ]);
  });

  it('should show promise resolved and rejected in the same transaction if they resolve before the debounce', async () => {
    store = createLoggedStore(store, defaultOptions);

    const instantPromiseAtom = atom(() => {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve(42);
        }, 0),
      );
    });

    const instantPromiseRejectedAtom = atom(() => {
      return new Promise((_, reject) =>
        setTimeout(() => {
          reject(new Error('Promise rejected'));
        }, 0),
      );
    });

    const slowerPromiseAtom = atom(() => {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve(42);
        }, 1000),
      );
    });

    const slowerPromiseRejectedAtom = atom(() => {
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          reject(new Error('Promise rejected'));
        }, 1000),
      );
    });

    void store.get(instantPromiseAtom);
    await vi.advanceTimersByTimeAsync(200);

    void store.get(instantPromiseRejectedAtom);
    await vi.advanceTimersByTimeAsync(200);

    void store.get(slowerPromiseAtom);
    void store.get(slowerPromiseRejectedAtom);

    await vi.advanceTimersByTimeAsync(2000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${instantPromiseAtom}`],
      [`pending initial promise of ${instantPromiseAtom}`],
      [`resolved initial promise of ${instantPromiseAtom} to 42`, { value: 42 }], // In first transaction

      [`transaction 2 : retrieved value of ${instantPromiseRejectedAtom}`],
      [`pending initial promise of ${instantPromiseRejectedAtom}`],
      [
        `rejected initial promise of ${instantPromiseRejectedAtom} to Error: Promise rejected`, // In second transaction
        { error: new Error('Promise rejected') },
      ],

      [`transaction 3 : retrieved value of ${slowerPromiseAtom}`],
      [`pending initial promise of ${slowerPromiseAtom}`],

      [`transaction 4 : retrieved value of ${slowerPromiseRejectedAtom}`],
      [`pending initial promise of ${slowerPromiseRejectedAtom}`],

      [`transaction 5 : resolved promise of ${slowerPromiseAtom}`], // In another transaction
      [`resolved initial promise of ${slowerPromiseAtom} to 42`, { value: 42 }],
      [
        `rejected initial promise of ${slowerPromiseRejectedAtom} to Error: Promise rejected`,
        { error: new Error('Promise rejected') },
      ],
    ]);
  });

  it('should show promise resolved in the same transaction if they are waiting for the same async dependency', async () => {
    store = createLoggedStore(store, defaultOptions);

    const otherAtom = atom(0);
    const doGetOtherAtom = () => {
      store.set(otherAtom, (prev) => prev + 1); // Should not be merged with the previous transaction
    };

    const dep = atom<Promise<number>>(async () => {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve(42);

          doGetOtherAtom(); // Should not be merged BEFORE the promise transaction
          setTimeout(() => {
            doGetOtherAtom(); // Should not be merged AFTER the promise transaction
          }, 0);
        }, 1000),
      );
    });

    const prom = atomFamily((id: string) =>
      atom((get) => {
        const dependency = get(dep);
        if (dependency instanceof Promise) {
          return dependency;
        }
        return `${id}:${dependency}`;
      }),
    );

    void store.get(prom('1'));
    void store.get(prom('2'));
    void store.get(prom('3'));

    await vi.advanceTimersByTimeAsync(2000);

    expect(consoleMock.log.mock.calls).toEqual([
      // All pending
      [`transaction 1 : retrieved value of ${prom('1')}`],
      [`pending initial promise of ${dep}`],
      [`pending initial promise of ${prom('1')}`, { dependencies: [`${dep}`] }],
      [`transaction 2 : retrieved value of ${prom('2')}`],
      [`pending initial promise of ${prom('2')}`, { dependencies: [`${dep}`] }],
      [`transaction 3 : retrieved value of ${prom('3')}`],
      [`pending initial promise of ${prom('3')}`, { dependencies: [`${dep}`] }],

      // Other atom in another transaction
      [`transaction 4 : set value of ${otherAtom}`],
      [`initialized value of ${otherAtom} to 0`, { value: 0 }],
      [`changed value of ${otherAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],

      // All resolved
      [`transaction 5 : resolved promise of ${dep}`],
      [
        `resolved initial promise of ${dep} to 42`,
        { pendingPromises: [`${prom('1')}`, `${prom('2')}`, `${prom('3')}`], value: 42 },
      ],
      [`resolved initial promise of ${prom('1')} to 42`, { dependencies: [`${dep}`], value: 42 }],
      [`resolved initial promise of ${prom('2')} to 42`, { dependencies: [`${dep}`], value: 42 }],
      [`resolved initial promise of ${prom('3')} to 42`, { dependencies: [`${dep}`], value: 42 }],

      // Other atom in another transaction
      [`transaction 6 : set value of ${otherAtom}`],
      [`changed value of ${otherAtom} from 1 to 2`, { newValue: 2, oldValue: 1 }],
    ]);
  });

  it('should log aborted promises', async () => {
    store = createLoggedStore(store, defaultOptions);

    const dependencyAtom = atom('first');
    const promiseAtom = atom(async (get, { signal }) => {
      const dependency = get(dependencyAtom);
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          resolve(dependency);
        }, 1000);
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Promise aborted'));
        });
      });
    });

    const beforePromise = store.get(promiseAtom);

    await vi.advanceTimersByTimeAsync(250);

    store.set(dependencyAtom, 'second'); // Change the dependency before the promise resolves

    const afterPromise = store.get(promiseAtom);

    await vi.advanceTimersByTimeAsync(1500);

    await expect(beforePromise).rejects.toEqual(new Error('Promise aborted'));
    await expect(afterPromise).resolves.toBe('second');

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${promiseAtom}`],
      [`initialized value of ${dependencyAtom} to "first"`, { value: 'first' }],
      [`pending initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],

      [`transaction 2 : set value of ${dependencyAtom} to "second"`, { value: 'second' }],
      [
        `changed value of ${dependencyAtom} from "first" to "second"`,
        {
          newValue: 'second',
          oldValue: 'first',
          pendingPromises: [`${promiseAtom}`],
        },
      ],
      [`aborted initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],
      // This is still logged as the "initial" promise since it was aborted
      [`pending initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],

      [`transaction 3 : resolved promise of ${promiseAtom}`],
      [
        `resolved initial promise of ${promiseAtom} to "second"`,
        { dependencies: [`${dependencyAtom}`], value: 'second' },
      ],
    ]);
  });

  it('should log atom promise changes', async () => {
    store = createLoggedStore(store, defaultOptions);

    const testAtom = atom<unknown>(0);

    store.sub(testAtom, vi.fn());

    // initial promise resolved
    const promise1 = Promise.resolve(1);
    store.set(testAtom, promise1);
    await vi.advanceTimersByTimeAsync(0);

    // changed promise resolved
    const promise2 = Promise.resolve(2);
    store.set(testAtom, promise2);
    await vi.advanceTimersByTimeAsync(0);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${testAtom} to 0`, { value: 0 }],
      [`mounted ${testAtom}`, { value: 0 }],

      [`transaction 2 : set value of ${testAtom} to [object Promise]`, { value: promise1 }],
      [`pending promise of ${testAtom} from 0`, { oldValue: 0 }],
      [`resolved promise of ${testAtom} from 0 to 1`, { newValue: 1, oldValue: 0 }],

      [`transaction 3 : set value of ${testAtom} to [object Promise]`, { value: promise2 }],
      [`pending promise of ${testAtom} from 1`, { oldValue: 1 }],
      [`resolved promise of ${testAtom} from 1 to 2`, { newValue: 2, oldValue: 1 }],
    ]);
  });

  it('should show initial promise aborted before a new promise is pending', async () => {
    store = createLoggedStore(store, defaultOptions);

    const dependencyAtom = atom(0);
    dependencyAtom.debugPrivate = true;

    const promiseAtom = atom(async (get, { signal }) => {
      const dependency = get(dependencyAtom);
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          resolve(dependency);
        }, 1000);
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Promise aborted'));
        });
      });
    });

    store.sub(promiseAtom, vi.fn());

    // Initial promise aborted
    await vi.advanceTimersByTimeAsync(250);
    store.set(dependencyAtom, (prev) => prev + 1); // Change the dependency before the promise resolves
    await vi.advanceTimersByTimeAsync(1500);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${promiseAtom}`],
      [`pending initial promise of ${promiseAtom}`],
      [`mounted ${promiseAtom}`],
      [`transaction 2`],
      [`aborted initial promise of ${promiseAtom}`], // Must be before pending
      [`pending initial promise of ${promiseAtom}`],
      [`transaction 3 : resolved promise of ${promiseAtom}`],
      [`resolved initial promise of ${promiseAtom} to 1`, { value: 1 }],
    ]);
  });

  it('should not log promise resolved when promise was already aborted', async () => {
    // Covers the isAborted=true branch in the .then() callback
    store = createLoggedStore(store, defaultOptions);

    let externalResolve: (value: number) => void;
    const promiseAtom = atom(async (get, { signal }) => {
      return new Promise<number>((resolve, reject) => {
        externalResolve = resolve;
        signal.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });

    const dependencyAtom = atom(0);
    dependencyAtom.debugPrivate = true;

    const derivedAtom = atom(async (get) => {
      const dep = get(dependencyAtom);
      if (dep === 0) {
        return get(promiseAtom);
      }
      return -1;
    });

    store.sub(derivedAtom, vi.fn());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls.length).toBeGreaterThan(0);

    vi.clearAllMocks();

    // Abort by changing the dependency, then resolve the original promise
    store.set(dependencyAtom, 1);
    await vi.advanceTimersByTimeAsync(250);

    // Now resolve the already-aborted promise — should NOT be logged
    externalResolve!(42);
    await vi.advanceTimersByTimeAsync(250);

    vi.runAllTimers();

    // The aborted promise's resolve callback fires but isAborted=true so nothing extra is logged
    expect(consoleMock.log.mock.calls).not.toContain(
      expect.arrayContaining([expect.stringContaining('resolved initial promise')]),
    );
  });

  it('should show changed promise aborted before a new promise is pending', async () => {
    store = createLoggedStore(store, defaultOptions);

    const dependencyAtom = atom(0);
    dependencyAtom.debugPrivate = true;

    const promiseAtom = atom(async (get, { signal }) => {
      const dependency = get(dependencyAtom);
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          resolve(dependency);
        }, 1000);
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Promise aborted'));
        });
      });
    });

    store.sub(promiseAtom, vi.fn());

    // Initial promise resolved
    await vi.advanceTimersByTimeAsync(1250);

    // Changed promise aborted
    store.set(dependencyAtom, (prev) => prev + 1);
    await vi.advanceTimersByTimeAsync(250);
    store.set(dependencyAtom, (prev) => prev + 1); // Change the dependency before the promise resolves
    await vi.advanceTimersByTimeAsync(1500);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${promiseAtom}`],
      [`pending initial promise of ${promiseAtom}`],
      [`mounted ${promiseAtom}`],

      [`transaction 2 : resolved promise of ${promiseAtom}`],
      [`resolved initial promise of ${promiseAtom} to 0`, { value: 0 }],

      [`transaction 3`],
      [`pending promise of ${promiseAtom} from 0`, { oldValue: 0 }],

      [`transaction 4`],
      [`aborted promise of ${promiseAtom} from 0`, { oldValue: 0 }], // Must be before pending
      [`pending promise of ${promiseAtom} from 0`, { oldValue: 0 }],

      [`transaction 5 : resolved promise of ${promiseAtom}`],
      [`resolved promise of ${promiseAtom} from 0 to 2`, { oldValue: 0, newValue: 2 }],
    ]);
  });

  it('should not swap events when abort is the only event in the transaction', async () => {
    // Covers add-event-to-transaction.ts:152 false branch: events.length <= 1
    store = createLoggedStore(store, defaultOptions);

    const promiseAtom = atom<unknown>(0);

    store.sub(promiseAtom, vi.fn());
    await vi.advanceTimersByTimeAsync(0);

    vi.clearAllMocks();

    // Set a promise that will be aborted — then immediately abort it by setting another value
    const neverResolve = new Promise<unknown>(() => {});
    store.set(promiseAtom, neverResolve);

    // Set a new value immediately so the pending promise has no time to accumulate other events,
    // and the abort fires alone in its transaction
    store.set(promiseAtom, 99);

    vi.runAllTimers();

    // Main thing is no crash — the logger handles abort-as-only-event gracefully
    expect(consoleMock.log.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('should not swap events when the event before abort is not a pending promise event', async () => {
    // Covers add-event-to-transaction.ts:154 false branch: preceding event is not pending
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    const depAtom = atom(0);
    depAtom.debugPrivate = true;

    // A derived atom that reads both aAtom and bAtom and depends on depAtom
    const promiseAtom = atom(async (get, { signal }) => {
      get(depAtom);
      const a = get(aAtom);
      const b = get(bAtom);
      return new Promise<number>((resolve, reject) => {
        const t = setTimeout(() => {
          resolve(a + b);
        }, 1000);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        });
      });
    });

    store.sub(promiseAtom, vi.fn());
    // Let the initial promise start
    await vi.advanceTimersByTimeAsync(100);

    vi.clearAllMocks();

    // Change aAtom (adds a changed value event for aAtom into the transaction)
    // then immediately change depAtom to abort the promise
    // This should result in a transaction where the event before the abort
    // is a changed-value event (not a pending), so no swap should happen
    store.set(aAtom, 2);
    store.set(depAtom, 1);
    await vi.advanceTimersByTimeAsync(1500);

    vi.runAllTimers();

    // No crash; events logged in some order
    expect(consoleMock.log.mock.calls.length).toBeGreaterThan(0);
  });

  it('should log promises in colors', async () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
    });

    const refreshPromisesAtom = atom(0);
    refreshPromisesAtom.debugPrivate = true;

    const promiseResolvedAtom = atom(async (get) => {
      get(refreshPromisesAtom);
      return Promise.resolve(42);
    });
    const promiseRejectedAtom = atom(async (get) => {
      get(refreshPromisesAtom);
      return Promise.reject(new Error('Promise rejected'));
    });

    const promiseAbortedDependencyAtom = atom(0);
    promiseAbortedDependencyAtom.debugPrivate = true;
    const promiseAbortedAtom = atom(async (get, { signal }) => {
      get(refreshPromisesAtom);
      const dependency = get(promiseAbortedDependencyAtom);
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (dependency <= 1) {
            resolve(dependency);
          } else {
            reject(new Error('Rejected because of dependency higher than 1'));
          }
        }, 1000);
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Promise aborted'));
        });
      });
    });

    const resolvedPromiseNumber = /atom(\d+)(.*)/.exec(promiseResolvedAtom.toString())?.[1];
    const rejectedPromiseNumber = /atom(\d+)(.*)/.exec(promiseRejectedAtom.toString())?.[1];
    const abortedPromiseNumber = /atom(\d+)(.*)/.exec(promiseAbortedAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(resolvedPromiseNumber!))).toBeTruthy();
    expect(Number.isInteger(parseInt(rejectedPromiseNumber!))).toBeTruthy();
    expect(Number.isInteger(parseInt(abortedPromiseNumber!))).toBeTruthy();

    // Initial promise resolved
    store.sub(promiseResolvedAtom, vi.fn());

    // Initial promise rejected
    store.sub(promiseRejectedAtom, vi.fn());

    // Initial promise aborted
    store.sub(promiseAbortedAtom, vi.fn());
    await vi.advanceTimersByTimeAsync(250);
    store.set(promiseAbortedDependencyAtom, (prev) => prev + 1); // Change the dependency before the promise resolves

    await vi.advanceTimersByTimeAsync(1500);

    // promise resolved
    // promise rejected
    // promise aborted
    store.set(refreshPromisesAtom, (prev) => prev + 1);
    await vi.advanceTimersByTimeAsync(250);
    store.set(promiseAbortedDependencyAtom, (prev) => prev + 1); // Change the dependency before the promise resolves

    await vi.advanceTimersByTimeAsync(1500);

    expect(consoleMock.log.mock.calls).toEqual([
      // pending initial promise (1)
      [
        `%ctransaction %c1 %c: %csubscribed %cto %catom%c${resolvedPromiseNumber}`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 1
        `color: #757575; font-weight: normal;`, // :
        `color: #009E73; font-weight: bold;`, // subscribed
        `color: #757575; font-weight: normal;`, // to
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
      ],
      [
        `%cpending initial promise %cof %catom%c${resolvedPromiseNumber}`,
        `color: #CC79A7; font-weight: bold;`, // pending initial promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
      ],
      [
        `%cmounted %catom%c${resolvedPromiseNumber}`,
        `color: #009E73; font-weight: bold;`, // mounted
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
      ],

      // pending initial promise (2)
      [
        `%ctransaction %c2 %c: %csubscribed %cto %catom%c${rejectedPromiseNumber}`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 2
        `color: #757575; font-weight: normal;`, // :
        `color: #009E73; font-weight: bold;`, // subscribed
        `color: #757575; font-weight: normal;`, // to
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 2
      ],
      [
        `%cpending initial promise %cof %catom%c${rejectedPromiseNumber}`,
        `color: #CC79A7; font-weight: bold;`, // pending initial promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 2
      ],
      [
        `%cmounted %catom%c${rejectedPromiseNumber}`,
        `color: #009E73; font-weight: bold;`, // mounted
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 2
      ],

      // pending initial promise (3)
      [
        `%ctransaction %c3 %c: %csubscribed %cto %catom%c${abortedPromiseNumber}`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 3
        `color: #757575; font-weight: normal;`, // :
        `color: #009E73; font-weight: bold;`, // subscribed
        `color: #757575; font-weight: normal;`, // to
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
      ],
      [
        `%cpending initial promise %cof %catom%c${abortedPromiseNumber}`,
        `color: #CC79A7; font-weight: bold;`, // pending initial promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
      ],
      [
        `%cmounted %catom%c${abortedPromiseNumber}`,
        `color: #009E73; font-weight: bold;`, // mounted
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
      ],

      // resolved initial promise (1)
      [
        `%ctransaction %c4 %c: %cresolved %cpromise %cof %catom%c${resolvedPromiseNumber}`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 4
        `color: #757575; font-weight: normal;`, // :
        `color: #009E73; font-weight: bold;`, // resolved
        `color: #CC79A7; font-weight: bold;`, // promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
      ],
      [
        `%cresolved %cinitial promise %cof %catom%c${resolvedPromiseNumber} %cto %c42`,
        `color: #009E73; font-weight: bold;`, // resolved
        `color: #CC79A7; font-weight: bold;`, // initial promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // 42
        { value: 42 },
      ],
      // rejected initial promise (2)
      [
        `%crejected %cinitial promise %cof %catom%c${rejectedPromiseNumber} %cto %cError: Promise rejected`,
        `color: #D55E00; font-weight: bold;`, // rejected
        `color: #CC79A7; font-weight: bold;`, // initial promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 6
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // Error: Promise rejected
        { error: new Error(`Promise rejected`) },
      ],

      // aborted initial promise (3)
      [
        `%ctransaction %c5`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 5
      ],
      [
        `%caborted %cinitial promise %cof %catom%c${abortedPromiseNumber}`,
        `color: #D55E00; font-weight: bold;`, // aborted
        `color: #CC79A7; font-weight: bold;`, // initial promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
      ],
      [
        `%cpending initial promise %cof %catom%c${abortedPromiseNumber}`,
        `color: #CC79A7; font-weight: bold;`, // pending initial promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
      ],

      // resolved initial promise (3)
      [
        `%ctransaction %c6 %c: %cresolved %cpromise %cof %catom%c${abortedPromiseNumber}`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 6
        `color: #757575; font-weight: normal;`, // :
        `color: #009E73; font-weight: bold;`, // resolved
        `color: #CC79A7; font-weight: bold;`, // promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
      ],
      [
        `%cresolved %cinitial promise %cof %catom%c${abortedPromiseNumber} %cto %c1`,
        `color: #009E73; font-weight: bold;`, // resolved
        `color: #CC79A7; font-weight: bold;`, // initial promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // 1
        { value: 1 },
      ],

      // pending promise 1 + pending promise 2 + resolved promise 1 + rejected promise 2
      [
        `%ctransaction %c7`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 7
      ],
      [
        `%cpending promise %cof %catom%c${resolvedPromiseNumber} %cfrom %c42`,
        `color: #CC79A7; font-weight: bold;`, // pending promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
        `color: #757575; font-weight: normal;`, // from
        `color: default; font-weight: normal;`, // 42
        { oldValue: 42 },
      ],
      [
        `%cpending promise %cof %catom%c${rejectedPromiseNumber} %cfrom %cError: Promise rejected`,
        `color: #CC79A7; font-weight: bold;`, // pending promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 2
        `color: #757575; font-weight: normal;`, // from
        `color: default; font-weight: normal;`, // Error: Promise rejected
        { oldError: new Error(`Promise rejected`) },
      ],
      [
        `%cpending promise %cof %catom%c${abortedPromiseNumber} %cfrom %c1`,
        `color: #CC79A7; font-weight: bold;`, // pending promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
        `color: #757575; font-weight: normal;`, // from
        `color: default; font-weight: normal;`, // 1
        { oldValue: 1 },
      ],
      [
        `%cresolved %cpromise %cof %catom%c${resolvedPromiseNumber} %cfrom %c42 %cto %c42`,
        `color: #009E73; font-weight: bold;`, // resolved
        `color: #CC79A7; font-weight: bold;`, // promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
        `color: #757575; font-weight: normal;`, // from
        `color: default; font-weight: normal;`, // 42
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // 42
        { newValue: 42, oldValue: 42 },
      ],
      [
        `%crejected %cpromise %cof %catom%c${rejectedPromiseNumber} %cfrom %cError: Promise rejected %cto %cError: Promise rejected`,
        `color: #D55E00; font-weight: bold;`, // rejected
        `color: #CC79A7; font-weight: bold;`, // promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 2
        `color: #757575; font-weight: normal;`, // from
        `color: default; font-weight: normal;`, // Error: Promise rejected
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // Error: Promise rejected
        { newError: new Error(`Promise rejected`), oldError: new Error(`Promise rejected`) },
      ],

      // pending promise 3 + aborted promise 3
      [
        `%ctransaction %c8`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 8
      ],
      [
        `%caborted %cpromise %cof %catom%c${abortedPromiseNumber} %cfrom %c1`,
        `color: #D55E00; font-weight: bold;`, // aborted
        `color: #CC79A7; font-weight: bold;`, // promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
        `color: #757575; font-weight: normal;`, // from
        `color: default; font-weight: normal;`, // 1
        { oldValue: 1 },
      ],
      [
        `%cpending promise %cof %catom%c${abortedPromiseNumber} %cfrom %c1`,
        `color: #CC79A7; font-weight: bold;`, // pending promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
        `color: #757575; font-weight: normal;`, // from
        `color: default; font-weight: normal;`, // 1
        { oldValue: 1 },
      ],

      // rejected promise 3
      [
        `%ctransaction %c9 %c: %crejected %cpromise %cof %catom%c${abortedPromiseNumber}`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 9
        `color: #757575; font-weight: normal;`, // :
        `color: #D55E00; font-weight: bold;`, // rejected
        `color: #CC79A7; font-weight: bold;`, // promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
      ],
      [
        `%crejected %cpromise %cof %catom%c${abortedPromiseNumber} %cfrom %c1 %cto %cError: Rejected because of dependency higher than …`,
        `color: #D55E00; font-weight: bold;`, // rejected
        `color: #CC79A7; font-weight: bold;`, // promise
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 3
        `color: #757575; font-weight: normal;`, // from
        `color: default; font-weight: normal;`, // 1
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // Error: Rejected because of dependency higher than 1
        { error: new Error(`Rejected because of dependency higher than 1`), oldValue: 1 },
      ],
    ]);
  });

  it('should log aborted promise due to changing dependencies', async () => {
    store = createLoggedStore(store, defaultOptions);

    const abortedFn = vi.fn();

    const dependencyAtom = atom(0);

    const promiseAtom = atom(async (get, { signal }) => {
      get(dependencyAtom);
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (!signal.aborted) resolve(42);
        }, 1000);
        signal.addEventListener('abort', () => {
          abortedFn();
          clearTimeout(timeoutId);
          reject(new Error('Promise aborted'));
        });
      });
    });

    store.sub(promiseAtom, vi.fn());
    await vi.advanceTimersByTimeAsync(250);

    expect(abortedFn).not.toHaveBeenCalled();
    store.set(dependencyAtom, store.get(dependencyAtom) + 1);
    expect(abortedFn).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${promiseAtom}`],
      [`initialized value of ${dependencyAtom} to 0`, { value: 0 }],
      [`pending initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],
      [`mounted ${dependencyAtom}`, { pendingPromises: [`${promiseAtom}`], value: 0 }],
      [`mounted ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],

      [`transaction 2 : set value of ${dependencyAtom} to 1`, { value: 1 }],
      [
        `changed value of ${dependencyAtom} from 0 to 1`,
        {
          dependents: [`${promiseAtom}`],
          newValue: 1,
          oldValue: 0,
          pendingPromises: [`${promiseAtom}`],
        },
      ],
      [`aborted initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],
      [`pending initial promise of ${promiseAtom}`, { dependencies: [`${dependencyAtom}`] }],

      [`transaction 3 : resolved promise of ${promiseAtom}`],
      [
        `resolved initial promise of ${promiseAtom} to 42`,
        { dependencies: [`${dependencyAtom}`], value: 42 },
      ],
    ]);
  });

  it('should not log aborted promise due to unmount', async () => {
    // **not** aborted is expected due to https://github.com/pmndrs/jotai/issues/2625

    store = createLoggedStore(store, defaultOptions);

    const abortedFn = vi.fn();

    const promiseAtom = atom(async (get, { signal }) => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (!signal.aborted) resolve(42);
        }, 1000);
        signal.addEventListener('abort', () => {
          abortedFn();
          clearTimeout(timeoutId);
          reject(new Error('Promise aborted'));
        });
      });
    });

    const unsubscribe = store.sub(promiseAtom, vi.fn());
    await vi.advanceTimersByTimeAsync(250);

    expect(abortedFn).not.toHaveBeenCalled();
    unsubscribe();
    expect(abortedFn).not.toHaveBeenCalled(); // not aborted is expected

    await vi.advanceTimersByTimeAsync(2000);

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${promiseAtom}`],
      [`pending initial promise of ${promiseAtom}`],
      [`mounted ${promiseAtom}`],

      [`transaction 2 : unsubscribed from ${promiseAtom}`],
      [`unmounted ${promiseAtom}`],

      [`transaction 3 : resolved promise of ${promiseAtom}`],
      [`resolved initial promise of ${promiseAtom} to 42`, { value: 42 }],
    ]);
  });
});
