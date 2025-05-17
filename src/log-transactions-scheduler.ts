import { INTERNAL_isPromiseLike } from 'jotai/vanilla/internals';

import { logTransaction } from './log-atom-event/log-transaction.js';
import type {
  AtomsLoggerStackTrace,
  AtomsLoggerState,
  StoreWithAtomsLogger,
} from './types/atoms-logger.js';
import { getTransactionMapTransaction } from './utils/get-transaction-map-transaction.js';

/**
 * Timeout for requestIdleCallback in ms.
 */
const REQUEST_IDLE_CALLBACK_TIMEOUT_MS = 250;

export function createLogTransactionsScheduler(
  store: StoreWithAtomsLogger,
): AtomsLoggerState['logTransactionsScheduler'] {
  const logTransactionsScheduler: AtomsLoggerState['logTransactionsScheduler'] = {
    queue: [],
    isProcessing: false,
    process(this: AtomsLoggerState['logTransactionsScheduler']) {
      if (this.isProcessing || this.queue.length === 0) return;

      this.isProcessing = true;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should exist
      const nextTransactionMap = this.queue.shift()!;
      const nextTransaction = getTransactionMapTransaction(nextTransactionMap);

      schedule(() => {
        waitForStackTrace(nextTransaction.stackTrace, (stackTrace) => {
          nextTransaction.stackTrace = stackTrace;
          try {
            logTransaction(store, nextTransactionMap);
          } finally {
            this.isProcessing = false;
            this.process();
          }
        });
      });
    },
    add(transactionMap) {
      this.queue.push(transactionMap);
      this.process();
    },
  };
  return logTransactionsScheduler;
}

function schedule(cb: () => void) {
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(cb, { timeout: REQUEST_IDLE_CALLBACK_TIMEOUT_MS });
  } else {
    setTimeout(cb, 0);
  }
}

function waitForStackTrace(
  stackTrace: AtomsLoggerStackTrace | Promise<AtomsLoggerStackTrace | undefined> | undefined,
  callback: (stackTrace: AtomsLoggerStackTrace | undefined) => void,
): void {
  if (stackTrace && INTERNAL_isPromiseLike(stackTrace)) {
    stackTrace.then(callback, callback);
  } else {
    callback(stackTrace);
  }
}
