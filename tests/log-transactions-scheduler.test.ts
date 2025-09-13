import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { bindAtomsLoggerToStore } from '../src/bind-atoms-logger-to-store.js';
import { ATOMS_LOGGER_SYMBOL } from '../src/consts/atom-logger-symbol.js';
import * as logTransactionModule from '../src/log-atom-event/log-transaction.js';
import { createLogTransactionsScheduler } from '../src/log-transactions-scheduler.js';
import {
  AtomsLoggerTransactionTypes,
  type AtomsLoggerTransaction,
  type StoreWithAtomsLogger,
} from '../src/types/atoms-logger.js';

function getFakeTransaction(transactionNumber: number): AtomsLoggerTransaction {
  const transaction: AtomsLoggerTransaction = {
    type: AtomsLoggerTransactionTypes.unknown,
    atom: `test-${transactionNumber}`,
    endTimestamp: -1,
    events: [],
    eventsCount: 0,
    ownerStack: undefined,
    componentDisplayName: undefined,
    startTimestamp: -1,
    transactionNumber: transactionNumber,
  };
  return transaction;
}

function getFakeTransactions(count: number): AtomsLoggerTransaction[] {
  return Array.from({ length: count }, (_, i) => getFakeTransaction(i));
}

describe('logTransactionsScheduler', () => {
  let performanceNowSpy: MockInstance<typeof performance.now>;
  let setTimeoutSpy: MockInstance<typeof setTimeout>;
  let logTransactionSpy: MockInstance<typeof logTransactionModule.logTransaction>;
  let requestIdleCallbackMockFn: MockInstance<typeof globalThis.requestIdleCallback>;

  const mockClearAllSpy = () => {
    setTimeoutSpy.mockClear();
    logTransactionSpy.mockClear();
    performanceNowSpy.mockClear();
    requestIdleCallbackMockFn.mockClear();
  };

  beforeEach(() => {
    performanceNowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);
    setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: () => void) => {
      cb();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
    logTransactionSpy = vi.spyOn(logTransactionModule, 'logTransaction');
    requestIdleCallbackMockFn = vi.fn().mockImplementation((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      return 1;
    });
    globalThis.requestIdleCallback =
      requestIdleCallbackMockFn as unknown as typeof globalThis.requestIdleCallback;
  });

  afterEach(() => {
    delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;
  });

  it('should schedule with requestIdleCallback if available', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, { logger: { log: vi.fn() } });
    const scheduler = createLogTransactionsScheduler(store);

    expect(logTransactionSpy).not.toHaveBeenCalled();
    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();

    const transaction = getFakeTransaction(1);
    scheduler.add(transaction);

    expect(requestIdleCallbackMockFn).toHaveBeenCalledWith(expect.any(Function), { timeout: 250 });
    expect(logTransactionSpy).toHaveBeenCalledWith(transaction, store[ATOMS_LOGGER_SYMBOL]);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should fallback to setTimeout if requestIdleCallback is not available', () => {
    delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;

    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, { logger: { log: vi.fn() } });
    const scheduler = createLogTransactionsScheduler(store);

    expect(logTransactionSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    const transaction = getFakeTransaction(1);
    scheduler.add(transaction);

    expect(logTransactionSpy).toHaveBeenCalledWith(transaction, store[ATOMS_LOGGER_SYMBOL]);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
  });

  it('should process all transactions when maxProcessingTimeMs is 0 (disabled)', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, {
      logger: { log: vi.fn() },
      maxProcessingTimeMs: 0,
    });

    const scheduler = createLogTransactionsScheduler(store);
    scheduler.queue = getFakeTransactions(50);
    scheduler.process();

    expect(logTransactionSpy).toHaveBeenCalledTimes(50); // All processed
  });

  it('should not call performance.now when maxProcessingTimeMs is disabled', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, {
      logger: { log: vi.fn() },
      maxProcessingTimeMs: 0,
    });

    const scheduler = createLogTransactionsScheduler(store);
    scheduler.queue = getFakeTransactions(20);
    scheduler.process();

    expect(performanceNowSpy).not.toHaveBeenCalled(); // No time checks when maxProcessingTimeMs is 0
  });

  it('should call performance.now for start time on each process cycle', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, {
      logger: { log: vi.fn() },
      maxProcessingTimeMs: 10,
    });

    const scheduler = createLogTransactionsScheduler(store);

    scheduler.queue = getFakeTransactions(5);
    scheduler.process();
    expect(scheduler.isProcessing).toBe(false);
    expect(logTransactionSpy).toHaveBeenCalledTimes(5); // All processed
    expect(performanceNowSpy).toHaveBeenCalledTimes(1); // Only for start time
    expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(1);

    scheduler.queue = getFakeTransactions(5);
    scheduler.process();
    expect(scheduler.isProcessing).toBe(false);
    expect(logTransactionSpy).toHaveBeenCalledTimes(10); // All processed
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
        cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      });
      return 1;
    });

    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, {
      logger: { log: vi.fn() },
      maxProcessingTimeMs: 10, // Allow processing to continue
    });

    const scheduler = createLogTransactionsScheduler(store);
    scheduler.queue = getFakeTransactions(12);
    scheduler.process();

    // Waiting for requestIdleCallback
    expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(1);
    expect(logTransactionSpy).not.toHaveBeenCalled();
    expect(performanceNowSpy).not.toHaveBeenCalled();
    mockClearAllSpy();

    requestIdleCallbacks.shift()!(); // Invoke the 1st scheduled callback

    expect(requestIdleCallbackMockFn).toHaveBeenCalledTimes(1); // Called again due to time limit
    expect(logTransactionSpy).toHaveBeenCalledTimes(10); // Processed until checkTimeInterval (10)
    expect(performanceNowSpy).toHaveBeenCalledTimes(2); // Start + first check
    mockClearAllSpy();

    requestIdleCallbacks.shift()!(); // Invoke the 2nd scheduled callback

    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled(); // Finished processing
    expect(logTransactionSpy).toHaveBeenCalledTimes(2); // Processed remaining 2
    expect(performanceNowSpy).toHaveBeenCalledTimes(1); // Start only (not reached checkTimeInterval)
  });

  it('should handle empty queue gracefully', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, { logger: { log: vi.fn() } });
    const scheduler = createLogTransactionsScheduler(store);

    scheduler.process(); // Process empty queue

    expect(scheduler.isProcessing).toBe(false);
    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(logTransactionSpy).not.toHaveBeenCalled();
    expect(performanceNowSpy).not.toHaveBeenCalled();
  });

  it('should prevent concurrent processing', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, { logger: { log: vi.fn() } });
    const scheduler = createLogTransactionsScheduler(store);

    scheduler.isProcessing = true; // Simulate ongoing processing
    scheduler.queue = getFakeTransactions(5);
    scheduler.process();

    expect(scheduler.isProcessing).toBe(true); // Still "processing"
    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(logTransactionSpy).not.toHaveBeenCalled();
    expect(performanceNowSpy).not.toHaveBeenCalled();
  });

  it('should handle null transactions in queue', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, { logger: { log: vi.fn() } });
    const scheduler = createLogTransactionsScheduler(store);

    // Manually add undefined to queue (edge case)
    // @ts-expect-error: Testing edge case with invalid data
    scheduler.queue.push(undefined);
    scheduler.queue.push(getFakeTransaction(1));
    scheduler.process();

    expect(logTransactionSpy).toHaveBeenCalledTimes(1); // Only valid transaction processed
  });

  it('should use requestIdleCallback timeout from store configuration', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, {
      logger: { log: vi.fn() },
      requestIdleCallbackTimeoutMs: 500, // Custom timeout
    });
    const scheduler = createLogTransactionsScheduler(store);

    scheduler.add(getFakeTransaction(1));

    expect(requestIdleCallbackMockFn).toHaveBeenCalledWith(expect.any(Function), { timeout: 500 });
  });

  it('should execute immediately when requestIdleCallbackTimeoutMs is -1', () => {
    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, {
      logger: { log: vi.fn() },
      requestIdleCallbackTimeoutMs: -1, // Immediate execution
      maxProcessingTimeMs: -1, // Disable time checks
    });
    const scheduler = createLogTransactionsScheduler(store);

    scheduler.add(getFakeTransaction(1));

    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(logTransactionSpy).toHaveBeenCalledTimes(1);
    expect(performanceNowSpy).not.toHaveBeenCalled();
  });
});
