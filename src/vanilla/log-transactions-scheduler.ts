import { atomLoggerStoreSymbol } from './consts/store-symbol.js';
import type { AtomLoggerStoreState, AtomLoggerStore } from './types/store.js';

// Check the time every N processed transactions to avoid doing it too often.
const checkTimeInterval = 10;

export function createLogTransactionsScheduler(
  store: AtomLoggerStore,
): AtomLoggerStoreState['logTransactionsScheduler'] {
  const logTransactionsScheduler: AtomLoggerStoreState['logTransactionsScheduler'] = {
    queue: [],
    isProcessing: false,
    process(this: AtomLoggerStoreState['logTransactionsScheduler']) {
      if (this.isProcessing || this.queue.length === 0) return;
      const maxProcessingTimeMs = store[atomLoggerStoreSymbol].maxProcessingTimeMs;
      this.isProcessing = true;
      schedule(() => {
        try {
          const startTime = maxProcessingTimeMs > 0 ? performance.now() : -1; // Not used if maxProcessingTimeMs <= 0

          let processedCount = 0;
          while (this.queue.length > 0) {
            const transaction = this.queue.shift();
            if (transaction) {
              store[atomLoggerStoreSymbol].formatter(transaction);
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
      }, store[atomLoggerStoreSymbol]);
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
