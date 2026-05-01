import { ATOMS_LOGGER_SYMBOL } from './consts/atom-logger-symbol.js';
import { logTransaction } from './log-atom-event/log-transaction.js';
import type { AtomsLoggerState, StoreWithAtomsLogger } from './types/atoms-logger.js';

// Check the time every N processed transactions to avoid doing it too often.
const checkTimeInterval = 10;

export function createLogTransactionsScheduler(
  store: StoreWithAtomsLogger,
): AtomsLoggerState['logTransactionsScheduler'] {
  const logTransactionsScheduler: AtomsLoggerState['logTransactionsScheduler'] = {
    queue: [],
    isProcessing: false,
    process(this: AtomsLoggerState['logTransactionsScheduler']) {
      if (this.isProcessing || this.queue.length === 0) return;
      const maxProcessingTimeMs = store[ATOMS_LOGGER_SYMBOL].maxProcessingTimeMs;
      this.isProcessing = true;
      schedule(() => {
        try {
          const startTime = maxProcessingTimeMs > 0 ? performance.now() : -1; // Not used if maxProcessingTimeMs <= 0

          let processedCount = 0;
          while (this.queue.length > 0) {
            const transaction = this.queue.shift();
            if (transaction) {
              logTransaction(transaction, store[ATOMS_LOGGER_SYMBOL]);
              processedCount += 1;

              // Stop processing if we reached the max processing time
              if (
                maxProcessingTimeMs > 0 &&
                processedCount % checkTimeInterval === 0 &&
                performance.now() - startTime >= maxProcessingTimeMs
              ) {
                break;
              }
            }
          }
        } finally {
          this.isProcessing = false;

          // Continue processing if there are still transactions in the queue
          if (this.queue.length > 0) {
            this.process();
          }
        }
      }, store[ATOMS_LOGGER_SYMBOL]);
    },
    add(transaction) {
      this.queue.push(transaction);
      this.process();
    },
  };
  return logTransactionsScheduler;
}

function schedule(
  cb: () => void,
  { requestIdleCallbackTimeoutMs }: { requestIdleCallbackTimeoutMs: number },
): void {
  if (requestIdleCallbackTimeoutMs <= -1) {
    cb();
  } else if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(cb, { timeout: requestIdleCallbackTimeoutMs });
  } else {
    setTimeout(cb, 0);
  }
}
