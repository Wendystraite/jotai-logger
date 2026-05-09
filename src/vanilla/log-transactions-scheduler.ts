import type { AtomLoggerOptions } from './types/options.js';
import type { AtomLoggerStoreState } from './types/store.js';

// Check the time every N processed transactions to avoid doing it too often.
const checkTimeInterval = 10;

export function createLogTransactionsScheduler(
  loggerOptions: Pick<
    AtomLoggerOptions,
    'formatter' | 'synchronous' | 'requestIdleCallbackTimeoutMs' | 'maxProcessingTimeMs'
  >,
): AtomLoggerStoreState['logTransactionsScheduler'] {
  const logTransactionsScheduler: AtomLoggerStoreState['logTransactionsScheduler'] = {
    queue: [],
    isProcessing: false,
    process(this: AtomLoggerStoreState['logTransactionsScheduler']) {
      if (this.isProcessing || this.queue.length === 0) return;

      let maxProcessingTimeMs: number;
      if (loggerOptions.synchronous || loggerOptions.maxProcessingTimeMs === undefined) {
        maxProcessingTimeMs = -1;
      } else {
        maxProcessingTimeMs = loggerOptions.maxProcessingTimeMs;
      }

      this.isProcessing = true;
      schedule(
        () => {
          try {
            const startTime = maxProcessingTimeMs > 0 ? performance.now() : -1; // Not used if maxProcessingTimeMs <= 0

            let processedCount = 0;
            while (this.queue.length > 0) {
              const transaction = this.queue.shift();
              if (transaction) {
                loggerOptions.formatter?.(transaction);
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
        },
        {
          synchronous: loggerOptions.synchronous,
          requestIdleCallbackTimeoutMs: loggerOptions.requestIdleCallbackTimeoutMs,
        },
      );
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
  {
    synchronous,
    requestIdleCallbackTimeoutMs,
  }: Pick<AtomLoggerOptions, 'synchronous' | 'requestIdleCallbackTimeoutMs'>,
): void {
  if (
    synchronous ||
    requestIdleCallbackTimeoutMs === undefined ||
    requestIdleCallbackTimeoutMs <= -1
  ) {
    cb();
  } else if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(cb, { timeout: requestIdleCallbackTimeoutMs });
  } else {
    setTimeout(cb, 0);
  }
}
