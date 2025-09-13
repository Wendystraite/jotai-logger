import { ATOMS_LOGGER_SYMBOL } from './consts/atom-logger-symbol.js';
import { logTransaction } from './log-atom-event/log-transaction.js';
import type { AtomsLoggerState, StoreWithAtomsLogger } from './types/atoms-logger.js';

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
      const nextTransaction = this.queue.shift()!;

      schedule(() => {
        try {
          logTransaction(nextTransaction, store[ATOMS_LOGGER_SYMBOL]);
        } finally {
          this.isProcessing = false;
          this.process();
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
