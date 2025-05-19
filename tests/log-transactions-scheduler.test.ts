import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bindAtomsLoggerToStore } from '../src/bind-atoms-logger-to-store.js';
import * as logTransactionModule from '../src/log-atom-event/log-transaction.js';
import { createLogTransactionsScheduler } from '../src/log-transactions-scheduler.js';
import type { StoreWithAtomsLogger } from '../src/types/atoms-logger.js';

describe('logTransactionsScheduler', () => {
  let originalRequestIdleCallback: typeof globalThis.requestIdleCallback;

  beforeEach(() => {
    originalRequestIdleCallback = globalThis.requestIdleCallback;
  });

  afterEach(() => {
    globalThis.requestIdleCallback = originalRequestIdleCallback;
    vi.clearAllMocks();
  });

  it('should schedule with requestIdleCallback if available', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const logTransactionSpy = vi.spyOn(logTransactionModule, 'logTransaction');

    const requestIdleCallbackMockFn = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      return 1;
    });
    globalThis.requestIdleCallback = requestIdleCallbackMockFn;

    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, { logger: { log: vi.fn() } });
    const scheduler = createLogTransactionsScheduler(store);

    expect(logTransactionSpy).not.toHaveBeenCalled();
    expect(requestIdleCallbackMockFn).not.toHaveBeenCalled();

    const transactionMap = { unknown: { atom: 'test' } };
    scheduler.add(transactionMap);

    expect(requestIdleCallbackMockFn).toHaveBeenCalledWith(expect.any(Function), { timeout: 250 });
    expect(logTransactionSpy).toHaveBeenCalledWith(store, transactionMap);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should fallback to setTimeout if requestIdleCallback is not available', () => {
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((cb: () => void) => {
        cb();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      });
    const logTransactionSpy = vi.spyOn(logTransactionModule, 'logTransaction');

    // @ts-expect-error: delete for test
    delete globalThis.requestIdleCallback;

    const store = createStore() as StoreWithAtomsLogger;
    bindAtomsLoggerToStore(store, { logger: { log: vi.fn() } });
    const scheduler = createLogTransactionsScheduler(store);

    expect(logTransactionSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    const transactionMap = { unknown: { atom: 'test' } };
    scheduler.add(transactionMap);

    expect(logTransactionSpy).toHaveBeenCalledWith(store, transactionMap);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
  });
});
