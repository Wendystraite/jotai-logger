import { AtomEventTypes } from '../../vanilla/types/event.js';
import type { AtomEvent, AtomEventChanged } from '../../vanilla/types/event.js';
import type { AtomTransaction } from '../../vanilla/types/transaction.js';
import { logEvent } from './log-event.js';
import { TransactionLogPipeline } from './transaction-log-pipeline.js';
import type { ConsoleFormatterState } from './types.js';

interface MergedEvent {
  event: AtomEvent;
  oldValues?: unknown[];
}

/**
 * Merge multiple "changed" events for the same atom within a transaction into a single entry.
 */
function buildMergedEvents(events: AtomEvent[]): MergedEvent[] {
  const mergedByAtom = new Map<AtomEvent['atom'], MergedEvent>();
  const result: MergedEvent[] = [];

  for (const event of events) {
    if (event.type === AtomEventTypes.changed) {
      const existing = mergedByAtom.get(event.atom);
      if (existing !== undefined) {
        if (existing.oldValues !== undefined) {
          existing.oldValues.push(event.oldValue);
        } else {
          existing.oldValues = [(existing.event as AtomEventChanged).oldValue, event.oldValue];
        }
        existing.event = event;
        continue;
      }
      const merged: MergedEvent = { event };
      mergedByAtom.set(event.atom, merged);
      result.push(merged);
      continue;
    }
    result.push({ event });
  }

  return result;
}

export function logTransaction(transaction: AtomTransaction, options: ConsoleFormatterState): void {
  const { logger, collapseTransactions } = options;

  let { groupTransactions } = options;

  const mergedEvents = buildMergedEvents(transaction.events);

  const { logs, additionalDataToLog } = TransactionLogPipeline.execute({
    transaction,
    eventsCount: mergedEvents.length,
    options,
  });

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
    for (const { event, oldValues } of mergedEvents) {
      logEvent(event, options, oldValues);
    }
  } finally {
    if (logs.length > 0 && groupTransactions) {
      logger.groupEnd?.();
    }
  }
}
