import { type AtomEvent } from '../../vanilla/types/event.js';
import { EventLogPipeline } from './event-log-pipeline.js';
import type { ConsoleFormatterState } from './types.js';

export function logEvent(
  event: AtomEvent,
  options: ConsoleFormatterState,
  mergedOldValues?: unknown[],
): void {
  const { collapseEvents, logger } = options;

  let { groupEvents } = options;

  const { logs, subLogsArray, subLogsObject } = EventLogPipeline.execute({
    event,
    options,
    mergedOldValues,
  });

  if (collapseEvents ? !logger.groupCollapsed : !logger.group) {
    groupEvents = false;
  } else if (!logger.groupEnd) {
    groupEvents = false;
  } else if (subLogsArray.length <= 0) {
    groupEvents = false;
  }

  try {
    if (!groupEvents) {
      if (Object.keys(subLogsObject).length <= 0) {
        logger.log(...logs);
      } else {
        logger.log(...logs, subLogsObject);
      }
    } else {
      if (collapseEvents) {
        logger.groupCollapsed?.(...logs);
      } else {
        logger.group?.(...logs);
      }
      for (const subLogs of subLogsArray) {
        logger.log(...subLogs);
      }
    }
  } finally {
    if (groupEvents) {
      logger.groupEnd?.();
    }
  }
}
