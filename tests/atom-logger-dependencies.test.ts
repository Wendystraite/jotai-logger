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
import { getLoggedStoreState } from '../src/vanilla/create-logged-store.js';

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

describe('dependencies', () => {
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

  it('should log dependencies', () => {
    store = createLoggedStore(store, defaultOptions);
    const valueAtom = atom(1);
    const multiplyAtom = atom(2);
    const resultAtom = atom((get) => get(valueAtom) * get(multiplyAtom));
    store.sub(resultAtom, vi.fn());
    store.set(valueAtom, 2);
    vi.runAllTimers();
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${resultAtom}`],
      [`initialized value of ${valueAtom} to 1`, { value: 1 }],
      [`initialized value of ${multiplyAtom} to 2`, { value: 2 }],
      [
        `initialized value of ${resultAtom} to 2`,
        { dependencies: [`${valueAtom}`, `${multiplyAtom}`], value: 2 },
      ],
      [`mounted ${valueAtom}`, { value: 1 }],
      [`mounted ${multiplyAtom}`, { value: 2 }],
      [`mounted ${resultAtom}`, { dependencies: [`${valueAtom}`, `${multiplyAtom}`], value: 2 }],
      [`transaction 2 : set value of ${valueAtom} to 2`, { value: 2 }],
      [
        `changed value of ${valueAtom} from 1 to 2`,
        { dependents: [`${resultAtom}`], newValue: 2, oldValue: 1 },
      ],
      [
        `changed value of ${resultAtom} from 2 to 4`,
        { dependencies: [`${valueAtom}`, `${multiplyAtom}`], newValue: 4, oldValue: 2 },
      ],
    ]);
  });

  it('should not log dependencies if the only dependencies are private', () => {
    store = createLoggedStore(store, defaultOptions);
    const privateAtom = atom(0);
    privateAtom.debugPrivate = true;
    const publicAtom = atom((get) => get(privateAtom) + 1);
    store.get(publicAtom);
    vi.runAllTimers();
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : retrieved value of ${publicAtom}`],
      [`initialized value of ${publicAtom} to 1`, { value: 1 }],
    ]);
  });

  it('should log when an atom dependencies have changed', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    const toggleAtom = atom(false);
    const testAtom = atom((get) => {
      if (!get(toggleAtom)) {
        return get(aAtom);
      } else {
        return get(bAtom);
      }
    });

    store.sub(testAtom, vi.fn());
    store.set(toggleAtom, (prev) => !prev);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${toggleAtom} to false`, { value: false }],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [
        `initialized value of ${testAtom} to 1`,
        { dependencies: [`${toggleAtom}`, `${aAtom}`], value: 1 },
      ],
      [`mounted ${toggleAtom}`, { value: false }],
      [`mounted ${aAtom}`, { value: 1 }],
      [
        `mounted ${testAtom}`,
        {
          dependencies: [`${toggleAtom}`, `${aAtom}`],
          value: 1,
        },
      ],

      [`transaction 2 : set value of ${toggleAtom}`],
      [
        `changed value of ${toggleAtom} from false to true`,
        { dependents: [`${testAtom}`], newValue: true, oldValue: false },
      ],
      [`initialized value of ${bAtom} to 2`, { value: 2 }],
      [
        `changed dependencies of ${testAtom}`,
        {
          oldDependencies: [`${toggleAtom}`, `${aAtom}`],
          newDependencies: [`${toggleAtom}`, `${bAtom}`],
        },
      ],
      [
        `changed value of ${testAtom} from 1 to 2`,
        {
          dependencies: [`${toggleAtom}`, `${bAtom}`],
          newValue: 2,
          oldValue: 1,
        },
      ],
      [`mounted ${bAtom}`, { value: 2 }],
      [`unmounted ${aAtom}`],
    ]);
  });

  it('should not track atom dependencies of private atoms', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    bAtom.debugPrivate = true;
    const cAtom = atom((get) => {
      get(aAtom);
      get(bAtom);
    });
    cAtom.debugPrivate = true;

    store.sub(cAtom, vi.fn());

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [`mounted ${aAtom}`, { value: 1 }],
    ]);

    const loggedStoreState = getLoggedStoreState(store)!;
    expect(loggedStoreState.dependenciesMap.has(aAtom)).toBeTruthy();
    expect(loggedStoreState.dependenciesMap.has(bAtom)).toBeFalsy();
    expect(loggedStoreState.dependenciesMap.has(cAtom)).toBeFalsy();
    expect(loggedStoreState.prevTransactionDependenciesMap.has(aAtom)).toBeTruthy();
    expect(loggedStoreState.prevTransactionDependenciesMap.has(bAtom)).toBeFalsy();
    expect(loggedStoreState.prevTransactionDependenciesMap.has(cAtom)).toBeFalsy();
  });

  it('should update value-event dependencies when a dependency is removed and a value change already exists in the transaction', () => {
    // Covers add-event-to-transaction.ts:102 — the else-if (existingEvent.dependencies !== undefined) branch
    // when a removedDependency event is processed and a non-dependenciesChanged event with
    // dependencies also exists in the current transaction
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    // testAtom depends on aAtom and optionally bAtom, and its value changes when toggle changes
    const testAtom = atom((get) => {
      const toggle = get(toggleAtom);
      if (!toggle) {
        return get(aAtom) + get(bAtom);
      }
      return get(aAtom);
    });

    store.sub(testAtom, vi.fn());
    store.set(aAtom, 10); // triggers value change event for testAtom with current deps
    store.set(toggleAtom, true); // triggers dep removal

    vi.runAllTimers();

    // The value-change events for testAtom should reflect the final dependency set
    expect(consoleMock.log.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([expect.stringContaining(`changed dependencies of ${testAtom}`)]),
      ]),
    );
  });

  it('should add a dependenciesChanged event when a dep is first removed (no prior dependenciesChanged in transaction)', () => {
    // Covers add-event-to-transaction.ts:95-97 (currentTransaction=null / no prior dep event)
    // and the pure-deletion case where no hasExistingDepsChangedEvent
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const testAtom = atom((get) => {
      if (!get(toggleAtom)) {
        get(aAtom);
        get(bAtom);
      } else {
        get(aAtom);
      }
      return null;
    });

    store.sub(testAtom, vi.fn());
    store.set(toggleAtom, true); // removes bAtom dep in its own transaction

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([expect.stringContaining(`changed dependencies of ${testAtom}`)]),
      ]),
    );
  });

  it('should log when an atom dependencies are removed', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const testAtom = atom((get) => {
      if (!get(toggleAtom)) {
        get(aAtom);
        get(bAtom);
        return;
      }
    });

    store.sub(testAtom, vi.fn());
    store.set(toggleAtom, (prev) => !prev);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [`initialized value of ${bAtom} to 2`, { value: 2 }],
      [
        `initialized value of ${testAtom} to undefined`,
        { dependencies: [`${aAtom}`, `${bAtom}`], value: undefined },
      ],
      [`mounted ${aAtom}`, { value: 1 }],
      [`mounted ${bAtom}`, { value: 2 }],
      [`mounted ${testAtom}`, { dependencies: [`${aAtom}`, `${bAtom}`], value: undefined }],

      [`transaction 2`],
      [
        `changed dependencies of ${testAtom}`,
        { oldDependencies: [`${aAtom}`, `${bAtom}`], newDependencies: [] },
      ],
      [`unmounted ${aAtom}`],
      [`unmounted ${bAtom}`],
    ]);
  });

  it('should log when an atom dependencies are added', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const testAtom = atom((get) => {
      if (!get(toggleAtom)) {
        return;
      } else {
        get(aAtom);
        get(bAtom);
      }
    });

    store.sub(testAtom, vi.fn());
    store.set(toggleAtom, (prev) => !prev);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${testAtom} to undefined`, { value: undefined }],
      [`mounted ${testAtom}`, { value: undefined }],

      [`transaction 2`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [
        `changed dependencies of ${testAtom}`,
        { oldDependencies: [], newDependencies: [`${aAtom}`, `${bAtom}`] },
      ],
      [`initialized value of ${bAtom} to 2`, { value: 2 }],
      [`mounted ${aAtom}`, { value: 1 }],
      [`mounted ${bAtom}`, { value: 2 }],
    ]);
  });

  it('should not log atom dependencies changes if the new dependencies are private', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    bAtom.debugPrivate = true;
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const testAtom = atom((get) => {
      if (!get(toggleAtom)) {
        get(aAtom);
      } else {
        get(aAtom);
        get(bAtom); // bAtom is added but is private
      }
    });

    store.sub(testAtom, vi.fn());
    store.set(toggleAtom, (prev) => !prev);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [
        `initialized value of ${testAtom} to undefined`,
        { dependencies: [`${aAtom}`], value: undefined },
      ],
      [`mounted ${aAtom}`, { value: 1 }],
      [`mounted ${testAtom}`, { dependencies: [`${aAtom}`], value: undefined }],
    ]);
  });

  it('should not log when a private atom dependency is removed', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const privateAtom = atom(2);
    privateAtom.debugPrivate = true;
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const testAtom = atom((get) => {
      if (!get(toggleAtom)) {
        get(aAtom);
        get(privateAtom); // private dep that will be removed
      } else {
        get(aAtom); // only aAtom remains
      }
    });

    store.sub(testAtom, vi.fn());
    store.set(toggleAtom, (prev) => !prev);

    vi.runAllTimers();

    // Visible deps stay the same ([aAtom]) – only the private dep was removed → no dep change logged
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [
        `initialized value of ${testAtom} to undefined`,
        { dependencies: [`${aAtom}`], value: undefined },
      ],
      [`mounted ${aAtom}`, { value: 1 }],
      [`mounted ${testAtom}`, { dependencies: [`${aAtom}`], value: undefined }],
    ]);
  });

  it('should log atom dependencies without duplicated atoms', () => {
    store = createLoggedStore(store, defaultOptions);

    const aAtom = atom(1);
    const bAtom = atom(2);
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const testAtom = atom((get) => {
      if (!get(toggleAtom)) {
        get(aAtom);
        get(aAtom);
      } else {
        get(aAtom);
        get(aAtom);
        get(bAtom);
        get(bAtom);
        get(bAtom);
      }
    });

    store.sub(testAtom, vi.fn());
    store.set(toggleAtom, (prev) => !prev);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${testAtom}`],
      [`initialized value of ${aAtom} to 1`, { value: 1 }],
      [
        `initialized value of ${testAtom} to undefined`,
        { dependencies: [`${aAtom}`], value: undefined },
      ],
      [`mounted ${aAtom}`, { value: 1 }],
      [`mounted ${testAtom}`, { dependencies: [`${aAtom}`], value: undefined }],

      [`transaction 2`],
      [`initialized value of ${bAtom} to 2`, { value: 2 }],
      [
        `changed dependencies of ${testAtom}`,
        { oldDependencies: [`${aAtom}`], newDependencies: [`${aAtom}`, `${bAtom}`] },
      ],
      [`mounted ${bAtom}`, { value: 2 }],
    ]);
  });

  it('should log atom dependencies changed in colors', () => {
    store = createLoggedStore(store, {
      formatter: consoleFormatter({ ...defaultFormatterOptions, formattedOutput: true }),
    });

    const aAtom = atom(1);
    const bAtom = atom(2);
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const testAtom = atom((get) => {
      if (!get(toggleAtom)) {
        get(aAtom);
      } else {
        get(bAtom);
      }
    });

    const testAtomNumber = /atom(\d+)(.*)/.exec(testAtom.toString())?.[1];
    const aAtomNumber = /atom(\d+)(.*)/.exec(aAtom.toString())?.[1];
    const bAtomNumber = /atom(\d+)(.*)/.exec(bAtom.toString())?.[1];

    expect(Number.isInteger(parseInt(testAtomNumber!))).toBeTruthy();
    expect(Number.isInteger(parseInt(aAtomNumber!))).toBeTruthy();
    expect(Number.isInteger(parseInt(bAtomNumber!))).toBeTruthy();

    store.sub(testAtom, vi.fn());
    store.set(toggleAtom, (prev) => !prev);

    vi.runAllTimers();

    expect(consoleMock.log.mock.calls).toEqual([
      [
        `%ctransaction %c1 %c: %csubscribed %cto %catom%c${testAtomNumber}`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 1
        `color: #757575; font-weight: normal;`, // :
        `color: #009E73; font-weight: bold;`, // subscribed
        `color: #757575; font-weight: normal;`, // to
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 4
      ],
      [
        `%cinitialized value %cof %catom%c${aAtomNumber} %cto %c1`,
        `color: #0072B2; font-weight: bold;`, // initialized value
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // 1
        { value: 1 },
      ],
      [
        `%cinitialized value %cof %catom%c${testAtomNumber} %cto %cundefined`,
        `color: #0072B2; font-weight: bold;`, // initialized value
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 4
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // undefined
        { dependencies: [`atom${aAtomNumber}`], value: undefined },
      ],
      [
        `%cmounted %catom%c${aAtomNumber}`,
        `color: #009E73; font-weight: bold;`, // mounted
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
        { value: 1 },
      ],
      [
        `%cmounted %catom%c${testAtomNumber}`,
        `color: #009E73; font-weight: bold;`, // mounted
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 4
        { dependencies: [`atom${aAtomNumber}`], value: undefined },
      ],
      [
        `%ctransaction %c2`,
        `color: #757575; font-weight: normal;`, // transaction
        `color: default; font-weight: normal;`, // 2
      ],
      [
        `%cinitialized value %cof %catom%c${bAtomNumber} %cto %c2`,
        `color: #0072B2; font-weight: bold;`, // initialized value
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 2
        `color: #757575; font-weight: normal;`, // to
        `color: default; font-weight: normal;`, // 2
        { value: 2 },
      ],
      [
        `%cchanged dependencies %cof %catom%c${testAtomNumber}`,
        `color: #E69F00; font-weight: bold;`, // changed dependencies
        `color: #757575; font-weight: normal;`, // of
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 4
        { newDependencies: [`atom${bAtomNumber}`], oldDependencies: [`atom${aAtomNumber}`] },
      ],
      [
        `%cmounted %catom%c${bAtomNumber}`,
        `color: #009E73; font-weight: bold;`, // mounted
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 2
        { value: 2 },
      ],
      [
        `%cunmounted %catom%c${aAtomNumber}`,
        `color: #D55E00; font-weight: bold;`, // unmounted
        `color: #757575; font-weight: normal;`, // atom
        `color: default; font-weight: normal;`, // 1
      ],
    ]);
  });

  it('should correctly track two dependencies that have the same name', () => {
    // Regression test: with Set<AtomId>, two atoms sharing the same debugLabel would be
    // deduplicated to one entry. With Set<AnyAtom>, both atoms are tracked independently.
    store = createLoggedStore(store, defaultOptions);

    const dep1 = atom(1);
    dep1.debugLabel = 'shared';
    const dep2 = atom(2);
    dep2.debugLabel = 'shared'; // same toString() as dep1

    const resultAtom = atom((get) => get(dep1) + get(dep2));

    store.sub(resultAtom, vi.fn());
    vi.runAllTimers();

    // Both deps must appear in the dependencies list, even though they have the same name.
    // With the old Set<AtomId> implementation only one 'shared' would appear.
    expect(consoleMock.log.mock.calls).toEqual([
      [`transaction 1 : subscribed to ${resultAtom}`],
      [`initialized value of ${dep1} to 1`, { value: 1 }],
      [`initialized value of ${dep2} to 2`, { value: 2 }],
      [
        `initialized value of ${resultAtom} to 3`,
        { dependencies: [`${dep1}`, `${dep2}`], value: 3 },
      ],
      [`mounted ${dep1}`, { value: 1 }],
      [`mounted ${dep2}`, { value: 2 }],
      [`mounted ${resultAtom}`, { dependencies: [`${dep1}`, `${dep2}`], value: 3 }],
    ]);
  });
});
