import { atom } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLoggedStore, type AtomLoggerOptions } from '../src/index.js';
import { AtomEventTypes } from '../src/vanilla/types/event.js';
import type { AtomLoggerFormatter } from '../src/vanilla/types/formatter.js';
import type { AtomTransaction } from '../src/vanilla/types/transaction.js';

describe('custom formatter', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
    store = createStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should call the custom formatter with each completed transaction', () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    store = createLoggedStore(store, { formatter: customFormatter, synchronous: true });

    const testAtom = atom(42);
    store.get(testAtom);
    store.set(testAtom, 43);

    vi.runAllTimers();

    expect(transactions).toHaveLength(2);
    expect(transactions).toEqual([
      {
        type: 2,
        transactionNumber: 1,
        atom: testAtom,
        events: [
          {
            atom: testAtom,
            type: 1,
            value: 42,
          },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      {
        type: 3,
        transactionNumber: 2,
        atom: testAtom,
        args: [43],
        events: [
          {
            type: 6,
            atom: testAtom,
            newValue: 43,
            oldValue: 42,
          },
        ],
        result: undefined,
        startTimestamp: 0,
        endTimestamp: 0,
      },
    ]);
  });

  it('should not set empty dependencies on dependenciesChanged events', () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const depAtom = atom(1);
    // testAtom has no deps when toggleAtom is false, gains depAtom when true
    const testAtom = atom((get) => {
      if (get(toggleAtom)) get(depAtom);
    });

    store = createLoggedStore(store, { formatter: customFormatter, synchronous: true });

    store.sub(testAtom, vi.fn()); // mount with no deps
    vi.runAllTimers();
    transactions.length = 0; // only care about dep-change transactions below

    // Add depAtom as a dependency
    store.set(toggleAtom, true);
    vi.runAllTimers();

    const addDepEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.type === AtomEventTypes.dependenciesChanged)!;
    expect(addDepEvent).toBeDefined();
    expect(addDepEvent).toHaveProperty('addedDependencies'); // depAtom was added
    expect(addDepEvent).toHaveProperty('dependencies'); // now depends on depAtom
    expect(addDepEvent).not.toHaveProperty('oldDependencies'); // was empty — absent
    expect(addDepEvent).not.toHaveProperty('removedDependencies'); // none removed — absent

    transactions.length = 0;

    // Remove depAtom as a dependency
    store.set(toggleAtom, false);
    vi.runAllTimers();

    const removeDepEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.type === AtomEventTypes.dependenciesChanged)!;
    expect(removeDepEvent).toBeDefined();
    expect(removeDepEvent).toHaveProperty('removedDependencies'); // depAtom was removed
    expect(removeDepEvent).toHaveProperty('oldDependencies'); // had depAtom before
    expect(removeDepEvent).not.toHaveProperty('addedDependencies'); // none added — absent
    expect(removeDepEvent).not.toHaveProperty('dependencies'); // now empty — absent
  });

  it('should not set dependents on events when atom has no dependents', () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    store = createLoggedStore(store, { formatter: customFormatter, synchronous: true });

    const aAtom = atom(42);
    const bAtom = atom((get) => get(aAtom) * 2);

    // Absent: store.get does not mount atoms
    store.get(aAtom);
    vi.runAllTimers();

    const initEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.atom === aAtom && e.type === AtomEventTypes.initialized)!;
    expect(initEvent).not.toHaveProperty('dependents');
    transactions.length = 0;

    // Present: sub bAtom mounts both
    store.sub(bAtom, vi.fn());
    transactions.length = 0;
    store.set(aAtom, 43);
    vi.runAllTimers();

    const changedEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.atom === aAtom && e.type === AtomEventTypes.changed)!;
    expect(changedEvent).toHaveProperty('dependents');
    expect(changedEvent.dependents).toEqual(new Set([bAtom]));
  });

  it('should not set pendingPromises on events when atom has no pending promises', () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    store = createLoggedStore(store, { formatter: customFormatter, synchronous: true });

    // Absent: plain sync atom has no pending promise dependents
    const syncAtom = atom(42);
    store.get(syncAtom);
    vi.runAllTimers();

    const syncEvent = transactions.flatMap((tx) => tx.events).find((e) => e.atom === syncAtom)!;
    expect(syncEvent).not.toHaveProperty('pendingPromises');
    transactions.length = 0;

    // Present: async promiseAtom depends on dependencyAtom and stays pending
    const dependencyAtom = atom(0);
    const promiseAtom = atom(async (get) => {
      get(dependencyAtom);
      await new Promise<never>(() => {}); // never resolves during this test
    });
    store.sub(promiseAtom, vi.fn());
    vi.runAllTimers();

    const mountedEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.atom === dependencyAtom && e.type === AtomEventTypes.mounted)!;
    expect(mountedEvent).toHaveProperty('pendingPromises');
    expect(mountedEvent.pendingPromises).toEqual(new Set([promiseAtom]));
  });

  it('should not set dependencies on events when atom has no dependencies', () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    store = createLoggedStore(store, { formatter: customFormatter, synchronous: true });

    // Absent: primitive atom
    const primitiveAtom = atom(0);
    store.get(primitiveAtom);
    vi.runAllTimers();

    const initEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.type === AtomEventTypes.initialized && e.atom === primitiveAtom)!;
    expect(initEvent).not.toHaveProperty('dependencies');

    transactions.length = 0;
    store.set(primitiveAtom, 1);
    vi.runAllTimers();

    const changedEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.type === AtomEventTypes.changed && e.atom === primitiveAtom)!;
    expect(changedEvent).not.toHaveProperty('dependencies');
    transactions.length = 0;

    // Present: derived atom reads primitiveAtom
    const derivedAtom = atom((get) => get(primitiveAtom) * 2);
    store.get(derivedAtom);
    vi.runAllTimers();

    const derivedInitEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.type === AtomEventTypes.initialized && e.atom === derivedAtom)!;
    expect(derivedInitEvent).toHaveProperty('dependencies');
    expect(derivedInitEvent.dependencies).toEqual(new Set([primitiveAtom]));
  });

  it('should call the custom formatter for every transaction', () => {
    const callCount = { value: 0 };
    const customFormatter: AtomLoggerFormatter = () => {
      callCount.value += 1;
    };

    store = createLoggedStore(store, { formatter: customFormatter, synchronous: true });

    const atomA = atom(1);
    const atomB = atom(2);

    store.get(atomA);
    vi.runAllTimers();

    store.set(atomA, 10);
    vi.runAllTimers();

    store.get(atomB);
    vi.runAllTimers();

    expect(callCount.value).toBe(3);
  });

  it('should provide correct transaction data to the custom formatter', () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    store = createLoggedStore(store, { formatter: customFormatter, synchronous: true });

    const counterAtom = atom(0);
    store.set(counterAtom, 99);
    vi.runAllTimers();

    expect(transactions).toHaveLength(1);
    const tx = transactions[0]!;
    expect(tx.events.length).toBeGreaterThan(0);
    expect(tx.transactionNumber).toBe(1);
    expect(tx.startTimestamp).toBeGreaterThanOrEqual(0);
    expect(tx.endTimestamp).toBeGreaterThanOrEqual(tx.startTimestamp);
  });

  it('should call a new formatter after updating the formatter directly', () => {
    const firstFormatter = vi.fn<AtomLoggerFormatter>();
    const secondFormatter = vi.fn<AtomLoggerFormatter>();

    const options: AtomLoggerOptions = {
      formatter: firstFormatter,
      synchronous: true,
    };

    store = createLoggedStore(store, options);

    const testAtom = atom(0);
    store.get(testAtom);
    vi.runAllTimers();

    expect(firstFormatter).toHaveBeenCalledTimes(1);
    expect(secondFormatter).toHaveBeenCalledTimes(0);

    // Replace formatter by updating the options directly
    options.formatter = secondFormatter;

    store.set(testAtom, 1);
    vi.runAllTimers();

    expect(firstFormatter).toHaveBeenCalledTimes(1);
    expect(secondFormatter).toHaveBeenCalledTimes(1);
  });

  it('should not call the formatter when the logger is disabled', () => {
    const customFormatter = vi.fn<AtomLoggerFormatter>();

    store = createLoggedStore(store, {
      formatter: customFormatter,
      enabled: false,
      synchronous: true,
    });

    const testAtom = atom(42);
    store.get(testAtom);
    vi.runAllTimers();

    expect(customFormatter).not.toHaveBeenCalled();
  });

  it('should not call the formatter for private atoms when shouldShowPrivateAtoms is false', () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    store = createLoggedStore(store, {
      formatter: customFormatter,
      shouldShowPrivateAtoms: false,
      synchronous: true,
    });

    const privateAtom = atom(0);
    privateAtom.debugPrivate = true;

    store.get(privateAtom);
    vi.runAllTimers();

    // Private atom access creates no visible transaction events
    const hasPrivateEvent = transactions.some((tx) =>
      tx.events.some((e) => e.atom === privateAtom.toString()),
    );
    expect(hasPrivateEvent).toBe(false);
  });

  it('should allow shouldShowAtom to filter which atoms reach the formatter', () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    const allowedAtom = atom(1);
    const ignoredAtom = atom(2);

    store = createLoggedStore(store, {
      formatter: customFormatter,
      shouldShowAtom: (a) => a === allowedAtom,
      synchronous: true,
    });

    store.get(allowedAtom);
    vi.runAllTimers();

    store.get(ignoredAtom);
    vi.runAllTimers();

    // Only transactions for allowedAtom events should appear
    const mentionsIgnored = transactions.some((tx) =>
      tx.events.some((e) => e.atom === ignoredAtom.toString()),
    );
    expect(mentionsIgnored).toBe(false);
    expect(transactions.length).toBeGreaterThanOrEqual(1);
  });

  it('should work with a formatter that implements structured logging', () => {
    interface LogEntry {
      level: string;
      transactionNumber: number;
      atomId: string | undefined;
      eventCount: number;
    }

    const logs: LogEntry[] = [];
    const structuredFormatter: AtomLoggerFormatter = (transaction) => {
      logs.push({
        level: 'info',
        transactionNumber: transaction.transactionNumber,
        atomId:
          typeof transaction.atom === 'string' ? transaction.atom : transaction.atom?.toString(),
        eventCount: transaction.events.length,
      });
    };

    store = createLoggedStore(store, { formatter: structuredFormatter, synchronous: true });

    const myAtom = atom(0);
    store.get(myAtom);
    vi.runAllTimers();

    store.set(myAtom, 42);
    vi.runAllTimers();

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ level: 'info', transactionNumber: 1 });
    expect(logs[1]).toMatchObject({ level: 'info', transactionNumber: 2 });
  });

  it('should store the formatter in the loggerState', () => {
    const customFormatter: AtomLoggerFormatter = vi.fn();
    const options: AtomLoggerOptions = { formatter: customFormatter };
    store = createLoggedStore(store, options);
    expect(options.formatter).toBe(customFormatter);
  });

  it('should use a default consoleFormatter when no formatter is provided', () => {
    const options: AtomLoggerOptions = {};
    store = createLoggedStore(store, options);
    expect(typeof options.formatter).toBe('function');
  });
});
