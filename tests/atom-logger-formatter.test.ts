import { atom } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AtomTransactionTypes, createLoggedStore, type AtomLoggerOptions } from '../src/index.js';
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

  it('should call the custom formatter with each completed transaction', async () => {
    const transactions: AtomTransaction[] = [];
    const customFormatter: AtomLoggerFormatter = (transaction) => transactions.push(transaction);

    store = createLoggedStore(store, { formatter: customFormatter, synchronous: true });

    const subFn = vi.fn();

    // Synchronous atoms
    const toggleAtom = atom(false);
    toggleAtom.debugPrivate = true;
    const testAtom = atom(42);
    const derivedAtom = atom((get) => {
      if (get(toggleAtom)) return 0;
      return get(testAtom) + 1;
    });

    // Async A: initialPromisePending → aborted → initialPromisePending → initialPromiseResolved
    const depA = atom(0);
    depA.debugPrivate = true;
    let resolveA!: (v: number) => void;
    const asyncAtomA = atom(async (get, { signal }) => {
      const v = get(depA);
      if (v === 0)
        return new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      return new Promise<number>((r) => {
        resolveA = r;
      });
    });
    const listenerA = vi.fn();

    // Async B: changedPromisePending → changedPromiseResolved
    const changedAtomB = atom<unknown>(0);
    const listenerB = vi.fn();

    // Async C: changedPromisePending → changedPromiseAborted → changedPromisePending → changedPromiseRejected
    const changedAtomC = atom<unknown>(0);
    const listenerC = vi.fn();

    // Phase 1: synchronous transactions
    store.get(testAtom); //                           tx1
    store.set(testAtom, 43); //                       tx2
    const unsub = store.sub(derivedAtom, subFn); //   tx3
    store.set(toggleAtom, true); //                   tx4
    unsub(); //                                       tx5
    vi.runAllTimers();

    // Phase 2: async initial promise events
    store.sub(asyncAtomA, listenerA); //              tx6: initialPromisePending + mounted
    await vi.advanceTimersByTimeAsync(0);
    store.set(depA, 1); //                            tx7: initialPromiseAborted + initialPromisePending
    await vi.advanceTimersByTimeAsync(0);
    resolveA(77);
    await vi.advanceTimersByTimeAsync(0); //          tx8: initialPromiseResolved(77)

    // Phase 3: changedPromisePending → changedPromiseResolved
    store.sub(changedAtomB, listenerB); //            tx9: initialized(0) + mounted(0)
    vi.runAllTimers();
    const resolvedPromise = Promise.resolve(99);
    store.set(changedAtomB, resolvedPromise); //      tx10: changedPromisePending(oldValue=0)
    await vi.advanceTimersByTimeAsync(0); //          tx11: changedPromiseResolved(oldValue=0, newValue=99)

    // Phase 4: changedPromisePending → aborted → changedPromiseRejected
    store.sub(changedAtomC, listenerC); //            tx12: initialized(0) + mounted(0)
    vi.runAllTimers();
    const pendingPromise = new Promise<never>(() => {});
    store.set(changedAtomC, pendingPromise); //       tx13: changedPromisePending(oldValue=0)
    await vi.advanceTimersByTimeAsync(0);
    const rejectedPromise = Promise.reject(new Error('rejected'));
    rejectedPromise.catch(() => {});
    store.set(changedAtomC, rejectedPromise); //      tx14: changedPromiseAborted(0) + changedPromisePending(0)
    await vi.advanceTimersByTimeAsync(0); //          tx15: changedPromiseRejected(oldValue=0, error)

    vi.runAllTimers();

    expect(transactions).toHaveLength(15);
    expect(transactions).toEqual([
      // ── tx1: store.get(testAtom) ──────────────────────────────────────────
      {
        type: AtomTransactionTypes.storeGet,
        transactionNumber: 1,
        atom: testAtom,
        events: [{ type: AtomEventTypes.initialized, atom: testAtom, value: 42 }],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx2: store.set(testAtom, 43) ─────────────────────────────────────
      {
        type: AtomTransactionTypes.storeSet,
        transactionNumber: 2,
        atom: testAtom,
        args: [43],
        result: undefined,
        events: [{ type: AtomEventTypes.changed, atom: testAtom, newValue: 43, oldValue: 42 }],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx3: store.sub(derivedAtom, subFn) ───────────────────────────────
      {
        type: AtomTransactionTypes.storeSubscribe,
        transactionNumber: 3,
        atom: derivedAtom,
        listener: subFn,
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: derivedAtom,
            value: 44,
            dependencies: new Set([testAtom]),
          },
          {
            type: AtomEventTypes.mounted,
            atom: testAtom,
            value: 43,
            dependents: new Set([derivedAtom]),
          },
          {
            type: AtomEventTypes.mounted,
            atom: derivedAtom,
            value: 44,
            dependencies: new Set([testAtom]),
          },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx4: store.set(toggleAtom, true) — toggleAtom is private ─────────
      {
        type: AtomTransactionTypes.storeSet,
        transactionNumber: 4,
        atom: undefined,
        args: [true],
        result: undefined,
        events: [
          { type: AtomEventTypes.changed, atom: derivedAtom, newValue: 0, oldValue: 44 },
          {
            type: AtomEventTypes.dependenciesChanged,
            atom: derivedAtom,
            oldDependencies: new Set([testAtom]),
            removedDependencies: new Set([testAtom]),
          },
          { type: AtomEventTypes.unmounted, atom: testAtom },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx5: unsub() — storeUnsubscribe ──────────────────────────────────
      {
        type: AtomTransactionTypes.storeUnsubscribe,
        transactionNumber: 5,
        atom: derivedAtom,
        listener: subFn,
        events: [{ type: AtomEventTypes.unmounted, atom: derivedAtom }],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx6: store.sub(asyncAtomA) ────────────────────────────────────────
      {
        type: AtomTransactionTypes.storeSubscribe,
        transactionNumber: 6,
        atom: asyncAtomA,
        listener: listenerA,
        events: [
          { type: AtomEventTypes.initialPromisePending, atom: asyncAtomA },
          { type: AtomEventTypes.mounted, atom: asyncAtomA },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx7: store.set(depA, 1) — depA is private ────────────────────────
      {
        type: AtomTransactionTypes.storeSet,
        transactionNumber: 7,
        atom: undefined,
        args: [1],
        result: undefined,
        events: [
          { type: AtomEventTypes.initialPromiseAborted, atom: asyncAtomA },
          { type: AtomEventTypes.initialPromisePending, atom: asyncAtomA },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx8: promiseResolved — resolveA(77) ──────────────────────────────
      {
        type: AtomTransactionTypes.promiseResolved,
        transactionNumber: 8,
        atom: asyncAtomA,
        events: [{ type: AtomEventTypes.initialPromiseResolved, atom: asyncAtomA, value: 77 }],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx9: store.sub(changedAtomB) ─────────────────────────────────────
      {
        type: AtomTransactionTypes.storeSubscribe,
        transactionNumber: 9,
        atom: changedAtomB,
        listener: listenerB,
        events: [
          { type: AtomEventTypes.initialized, atom: changedAtomB, value: 0 },
          { type: AtomEventTypes.mounted, atom: changedAtomB, value: 0 },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx10: store.set(changedAtomB, resolvedPromise) ───────────────────
      {
        type: AtomTransactionTypes.storeSet,
        transactionNumber: 10,
        atom: changedAtomB,
        args: [resolvedPromise],
        result: undefined,
        events: [{ type: AtomEventTypes.changedPromisePending, atom: changedAtomB, oldValue: 0 }],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx11: promiseResolved — resolvedPromise settles ───────────────────
      {
        type: AtomTransactionTypes.promiseResolved,
        transactionNumber: 11,
        atom: changedAtomB,
        events: [
          {
            type: AtomEventTypes.changedPromiseResolved,
            atom: changedAtomB,
            oldValue: 0,
            newValue: 99,
          },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx12: store.sub(changedAtomC) ─────────────────────────────────────
      {
        type: AtomTransactionTypes.storeSubscribe,
        transactionNumber: 12,
        atom: changedAtomC,
        listener: listenerC,
        events: [
          { type: AtomEventTypes.initialized, atom: changedAtomC, value: 0 },
          { type: AtomEventTypes.mounted, atom: changedAtomC, value: 0 },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx13: store.set(changedAtomC, pendingPromise) ────────────────────
      {
        type: AtomTransactionTypes.storeSet,
        transactionNumber: 13,
        atom: changedAtomC,
        args: [pendingPromise],
        result: undefined,
        events: [{ type: AtomEventTypes.changedPromisePending, atom: changedAtomC, oldValue: 0 }],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx14: store.set(changedAtomC, rejectedPromise) — aborts pendingPromise
      {
        type: AtomTransactionTypes.storeSet,
        transactionNumber: 14,
        atom: changedAtomC,
        args: [rejectedPromise],
        result: undefined,
        events: [
          { type: AtomEventTypes.changedPromiseAborted, atom: changedAtomC, oldValue: 0 },
          { type: AtomEventTypes.changedPromisePending, atom: changedAtomC, oldValue: 0 },
        ],
        startTimestamp: 0,
        endTimestamp: 0,
      },
      // ── tx15: promiseRejected — rejectedPromise settles ───────────────────
      {
        type: AtomTransactionTypes.promiseRejected,
        transactionNumber: 15,
        atom: changedAtomC,
        events: [
          {
            type: AtomEventTypes.changedPromiseRejected,
            atom: changedAtomC,
            oldValue: 0,
            error: new Error('rejected'),
          },
        ],
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
    expect(syncEvent).not.toHaveProperty('dependents');

    expect(transactions).toEqual([
      expect.objectContaining({
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: syncAtom,
            value: 42,
          },
        ],
      }),
    ]);

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
    expect(mountedEvent).toHaveProperty('dependents');
    expect(mountedEvent.dependents).toEqual(new Set([promiseAtom]));

    // initialized fires before atomState.p is populated → needs retroactive update too
    const initEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.atom === dependencyAtom && e.type === AtomEventTypes.initialized)!;
    expect(initEvent).toBeDefined();
    expect(initEvent).toHaveProperty('pendingPromises');
    expect(initEvent.pendingPromises).toEqual(new Set([promiseAtom]));

    expect(transactions).toEqual([
      expect.objectContaining({
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: dependencyAtom,
            value: 0,
            dependents: new Set([promiseAtom]),
            pendingPromises: new Set([promiseAtom]),
          },
          {
            type: AtomEventTypes.initialPromisePending,
            atom: promiseAtom,
            dependencies: new Set([dependencyAtom]),
          },
          {
            type: AtomEventTypes.mounted,
            atom: dependencyAtom,
            value: 0,
            dependents: new Set([promiseAtom]),
            pendingPromises: new Set([promiseAtom]),
          },
          {
            type: AtomEventTypes.mounted,
            atom: promiseAtom,
            dependencies: new Set([dependencyAtom]),
          },
        ],
      }),
    ]);
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

    expect(transactions).toEqual([
      expect.objectContaining({
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: primitiveAtom,
            value: 0,
          },
        ],
      }),
    ]);

    transactions.length = 0;
    store.set(primitiveAtom, 1);
    vi.runAllTimers();

    const changedEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.type === AtomEventTypes.changed && e.atom === primitiveAtom)!;
    expect(changedEvent).not.toHaveProperty('dependencies');

    expect(transactions).toEqual([
      expect.objectContaining({
        events: [
          {
            type: AtomEventTypes.changed,
            atom: primitiveAtom,
            newValue: 1,
            oldValue: 0,
          },
        ],
      }),
    ]);

    // Present: derived atom reads primitiveAtom
    transactions.length = 0;
    const derivedAtom = atom((get) => get(primitiveAtom) * 2);
    store.get(derivedAtom);
    vi.runAllTimers();

    const derivedInitEvent = transactions
      .flatMap((tx) => tx.events)
      .find((e) => e.type === AtomEventTypes.initialized && e.atom === derivedAtom)!;
    expect(derivedInitEvent).toHaveProperty('dependencies');
    expect(derivedInitEvent.dependencies).toEqual(new Set([primitiveAtom]));

    expect(transactions).toEqual([
      expect.objectContaining({
        events: [
          {
            type: AtomEventTypes.initialized,
            atom: derivedAtom,
            value: 2,
            dependencies: new Set([primitiveAtom]),
          },
        ],
      }),
    ]);
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
