import type { AtomsLoggerTransaction } from '../../vanilla/types/transaction.js';
import { logEvent } from './log-event.js';
import { TransactionLogPipeline } from './transaction-log-pipeline.js';
import type { ConsoleFormatterState } from './types.js';

export function logTransaction(
  transaction: AtomsLoggerTransaction,
  options: ConsoleFormatterState,
): void {
  const { logger, collapseTransactions } = options;

  let { groupTransactions } = options;

  const {
    logs,
    additionalDataToLog,
    transaction: { events },
  } = TransactionLogPipeline.execute({ transaction, options });

  if (Object.keys(additionalDataToLog).length > 0) {
    logs.push(additionalDataToLog);
  }

  if (collapseTransactions ? !logger.groupCollapsed : !logger.group) {
    groupTransactions = false;
  } else if (!logger.groupEnd) {
    groupTransactions = false;
  }

  try {
    /* v8 ignore next -- empty logs only when all transaction header fields are disabled (showTransactionNumber, domain, eventsCount, time all off) with an unknown transaction type -- @preserve */
    if (logs.length > 0) {
      if (!groupTransactions) {
        logger.log(...logs);
      } else if (collapseTransactions) {
        logger.groupCollapsed?.(...logs);
      } else {
        logger.group?.(...logs);
      }
    }
    for (const event of events) {
      if (event) {
        logEvent(event, options);
      }
    }
  } finally {
    if (logs.length > 0 && groupTransactions) {
      logger.groupEnd?.();
    }
  }
}
