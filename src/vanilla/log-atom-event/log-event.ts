import { type AtomsLoggerEvent, type AtomsLoggerState } from '../types/atoms-logger.js';
import { EventLogPipeline } from './event-log-pipeline.js';

export function logEvent(event: AtomsLoggerEvent, options: AtomsLoggerState): void {
  const { collapseEvents, logger } = options;

  let { groupEvents } = options;

  const { logs, subLogsArray, subLogsObject } = EventLogPipeline.execute({ event, options });

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
