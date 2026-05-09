import { createStore } from 'jotai';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from 'vitest';

import { createLoggedStore, getLoggedStoreOptions } from '../src/vanilla/create-logged-store.js';
import { createLogTransactionsScheduler } from '../src/vanilla/log-transactions-scheduler.js';
import type { AtomLoggerFormatter } from '../src/vanilla/types/formatter.js';
import { AtomTransactionTypes, type AtomTransaction } from '../src/vanilla/types/transaction.js';

function getFakeTransaction(transactionNumber: number): AtomTransaction {
  const transaction: AtomTransaction = {
    type: AtomTransactionTypes.unknown,
    atom: `test-${transactionNumber}`,
    endTimestamp: -1,
    events: [],
    ownerStack: undefined,
    componentDisplayName: undefined,
    startTimestamp: -1,
    transactionNumber: transactionNumber,
  };
  return transaction;
}

function getFakeTransactions(count: number): AtomTransaction[] {
  return Array.from({ length: count }, (_, i) => getFakeTransaction(i));
}

describe('logTransactionsScheduler', () => {
  let performanceNowSpy: MockInstance<typeof performance.now>;
  let setTimeoutSpy: MockInstance<typeof setTimeout>;
  let formatterSpy: Mock<AtomLoggerFormatter>;
  let requestIdleCallbackMockFn: MockInstance<typeof globalThis.requestIdleCallback>;

  const mockClearAllSpy = () => {
    setTimeoutSpy.mockClear();
    formatterSpy.mockClear();
    performanceNowSpy.mockClear();
    requestIdleCallbackMockFn.mockClear();
  };

  beforeEach(() => {
    formatterSpy = vi.fn<AtomLoggerFormatter>();
    performanceNowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);
    setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((cb): ReturnType<typeof globalThis.setTimeout> => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        if (typeof cb === 'function') cb();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        return 1 as unknown as ReturnType<typeof globalThis.setTimeout>;
      });
    requestIdleCallbackMockFn = vi.fn().mockImplementation((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    globalThis.requestIdleCallback =
      requestIdleCallbackMockFn as unknown as typeof globalThis.requestIdleCallback;
  });

  afterEach(() => {
    delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;
  });

  it('should schedule with requestIdleCallback if available', () => {
    const store = createLoggedStore(createStore(), { formatter: formatterSpy });
    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);

    expect(formatterSpy).not.toHaveBeenCalled();
    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();

    const transaction = getFakeTransaction(1);
    scheduler.add(transaction);

    expect(requestIdleCallbackMockFn).toHaveBeenCalledWith(expect.any(Function), { timeout: 250 });
    expect(formatterSpy).toHaveBeenCalledWith(transaction);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should fallback to setTimeout if requestIdleCallback is not available', () => {
    delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;

    const store = createLoggedStore(createStore(), { formatter: formatterSpy });
    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);

    expect(formatterSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    const transaction = getFakeTransaction(1);
    scheduler.add(transaction);

    expect(formatterSpy).toHaveBeenCalledWith(transaction);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
  });

  it('should process all transactions when maxProcessingTimeMs is 0 (disabled)', () => {
    const store = createLoggedStore(createStore(), {
      formatter: formatterSpy,
      maxProcessingTimeMs: 0,
    });

    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);
    scheduler.queue = getFakeTransactions(50);
    scheduler.process();

    expect(formatterSpy).toHaveBeenCalledTimes(50); // All processed
  });

  it('should not call performance.now when maxProcessingTimeMs is disabled', () => {
    const store = createLoggedStore(createStore(), {
      formatter: formatterSpy,
      maxProcessingTimeMs: 0,
    });

    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);
    scheduler.queue = getFakeTransactions(20);
    scheduler.process();

    expect(performanceNowSpy).not.toHaveBeenCalled(); // No time checks when maxProcessingTimeMs is 0
  });

  it('should call performance.now for start time on each process cycle', () => {
    const store = createLoggedStore(createStore(), {
      formatter: formatterSpy,
      maxProcessingTimeMs: 10,
    });

    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);

    scheduler.queue = getFakeTransactions(5);
    scheduler.process();
    expect(scheduler.isProcessing).toBe(false);
    expect(formatterSpy).toHaveBeenCalledTimes(5); // All processed
    expect(performanceNowSpy).toHaveBeenCalledTimes(1); // Only for start time
    expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(1);

    scheduler.queue = getFakeTransactions(5);
    scheduler.process();
    expect(scheduler.isProcessing).toBe(false);
    expect(formatterSpy).toHaveBeenCalledTimes(10); // All processed
    expect(performanceNowSpy).toHaveBeenCalledTimes(2); // Only for start time
    expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(2);
  });

  it('should check time when processing reaches checkTimeInternal transactions', () => {
    let callCount = 0;
    performanceNowSpy.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 100; // First call: 0ms (start), second call: 100ms (exceeded)
    });

    const requestIdleCallbacks: (() => void)[] = []; // Store scheduled callbacks
    requestIdleCallbackMockFn.mockImplementation((cb: IdleRequestCallback) => {
      requestIdleCallbacks.push(() => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
      });
      return 1;
    });

    const store = createLoggedStore(createStore(), {
      formatter: formatterSpy,
      maxProcessingTimeMs: 10, // Allow processing to continue
    });

    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);
    scheduler.queue = getFakeTransactions(12);
    scheduler.process();

    // Waiting for requestIdleCallback
    expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(1);
    expect(formatterSpy).not.toHaveBeenCalled();
    expect(performanceNowSpy).not.toHaveBeenCalled();
    mockClearAllSpy();

    requestIdleCallbacks.shift()!(); // Invoke the 1st scheduled callback

    expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(1); // Called again due to time limit
    expect(formatterSpy).toHaveBeenCalledTimes(10); // Processed until checkTimeInterval (10)
    expect(performanceNowSpy).toHaveBeenCalledTimes(2); // Start + first check
    mockClearAllSpy();

    requestIdleCallbacks.shift()!(); // Invoke the 2nd scheduled callback

    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled(); // Finished processing
    expect(formatterSpy).toHaveBeenCalledTimes(2); // Processed remaining 2
    expect(performanceNowSpy).toHaveBeenCalledTimes(1); // Start only (not reached checkTimeInterval)
  });

  it('should handle empty queue gracefully', () => {
    const store = createLoggedStore(createStore(), { formatter: formatterSpy });
    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);

    scheduler.process(); // Process empty queue

    expect(scheduler.isProcessing).toBe(false);
    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(formatterSpy).not.toHaveBeenCalled();
    expect(performanceNowSpy).not.toHaveBeenCalled();
  });

  it('should prevent concurrent processing', () => {
    const store = createLoggedStore(createStore(), { formatter: formatterSpy });
    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);

    scheduler.isProcessing = true; // Simulate ongoing processing
    scheduler.queue = getFakeTransactions(5);
    scheduler.process();

    expect(scheduler.isProcessing).toBe(true); // Still "processing"
    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(formatterSpy).not.toHaveBeenCalled();
    expect(performanceNowSpy).not.toHaveBeenCalled();
  });

  it('should handle null transactions in queue', () => {
    const store = createLoggedStore(createStore(), { formatter: formatterSpy });
    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);

    // Manually add undefined to queue (edge case)
    // @ts-expect-error: Testing edge case with invalid data
    scheduler.queue.push(undefined);
    scheduler.queue.push(getFakeTransaction(1));
    scheduler.process();

    expect(formatterSpy).toHaveBeenCalledTimes(1); // Only valid transaction processed
  });

  it('should use requestIdleCallback timeout from store configuration', () => {
    const store = createLoggedStore(createStore(), {
      formatter: formatterSpy,
      requestIdleCallbackTimeoutMs: 500, // Custom timeout
    });
    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);

    scheduler.add(getFakeTransaction(1));

    expect(requestIdleCallbackMockFn).toHaveBeenCalledWith(expect.any(Function), { timeout: 500 });
  });

  it('should execute immediately when requestIdleCallbackTimeoutMs is -1', () => {
    const store = createLoggedStore(createStore(), {
      formatter: formatterSpy,
      requestIdleCallbackTimeoutMs: -1, // Immediate execution
      maxProcessingTimeMs: -1, // Disable time checks
    });
    const scheduler = createLogTransactionsScheduler(getLoggedStoreOptions(store)!);

    scheduler.add(getFakeTransaction(1));

    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(formatterSpy).toHaveBeenCalledTimes(1);
    expect(performanceNowSpy).not.toHaveBeenCalled();
  });
});
