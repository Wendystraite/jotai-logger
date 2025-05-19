import { INTERNAL_isPromiseLike } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type {
  AtomsLoggerStackTrace,
  AtomsLoggerTransaction,
  AtomsLoggerTransactionMap,
  StackFrame,
  StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { getTransactionMapTransaction } from '../utils/get-transaction-map-transaction.js';
import { parseStackFrames } from '../utils/parse-stack-frames.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { endTransaction } from './end-transaction.js';

export function startTransaction(
  store: StoreWithAtomsLogger,
  transactionMap: AtomsLoggerTransactionMap,
): void {
  if (store[ATOMS_LOGGER_SYMBOL].currentTransaction) {
    // Finish the previous transaction immediately to start a new one.
    endTransaction(store, { immediate: true });
  }

  const transaction = getTransactionMapTransaction(transactionMap);

  transaction.startTimestamp ??= performance.now();

  if (!transaction.stackTrace && store[ATOMS_LOGGER_SYMBOL].getStackTrace) {
    try {
      const stackTrace = store[ATOMS_LOGGER_SYMBOL].getStackTrace();
      if (INTERNAL_isPromiseLike(stackTrace)) {
        transaction.stackTrace = parseStackFramesPromise(transaction, stackTrace);
      } else if (stackTrace) {
        transaction.stackTrace = parseStackFrames(stackTrace);
      }
    } catch {
      transaction.stackTrace = undefined;
    }
  }

  if (transaction.atom && !shouldShowAtom(store, transaction.atom)) {
    transaction.atom = undefined;
  }

  store[ATOMS_LOGGER_SYMBOL].currentTransaction = transactionMap;
}

function parseStackFramesPromise(
  transaction: AtomsLoggerTransaction,
  stackTracePromise: Promise<StackFrame[] | undefined>,
): Promise<AtomsLoggerStackTrace | undefined> {
  return stackTracePromise.then(
    (stackFrames) => {
      if (stackFrames) {
        return (transaction.stackTrace = parseStackFrames(stackFrames));
      } else {
        return (transaction.stackTrace = { stackFrames: [] });
      }
    },
    () => {
      return (transaction.stackTrace = { stackFrames: [] });
    },
  );
}
