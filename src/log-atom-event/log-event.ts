import { DEFAULT_ATOMS_LOGGER_COLORS } from '../consts/colors.js';
import {
  type AtomsLoggerEvent,
  type AtomsLoggerEventMap,
  type AtomsLoggerState,
} from '../types/atoms-logger.js';
import { stringifyValue } from '../utils/stringify-value.js';
import { addAtomToLogs } from './add-atom-to-logs.js';
import { addToLogs } from './add-to-logs.js';

const AtomsLoggerEventLabelMap: Record<
  keyof AtomsLoggerEventMap,
  {
    label: string;
    coloredLabel: `%c${string}`;
    colors: (
      | keyof typeof DEFAULT_ATOMS_LOGGER_COLORS
      | [keyof typeof DEFAULT_ATOMS_LOGGER_COLORS, 'bold' | 'normal' | 'light']
    )[];
  }
> = {
  initialized: {
    label: 'initialized value of',
    coloredLabel: '%cinitialized value %cof',
    colors: [['blue', 'bold'], 'grey'],
  },
  changed: {
    label: 'changed value of',
    coloredLabel: '%cchanged value %cof',
    colors: [['lightBlue', 'bold'], 'grey'],
  },
  initialPromisePending: {
    label: 'pending initial promise of',
    coloredLabel: '%cpending initial promise %cof',
    colors: [['pink', 'bold'], 'grey'],
  },
  changedPromisePending: {
    label: 'pending promise of',
    coloredLabel: '%cpending promise %cof',
    colors: [['pink', 'bold'], 'grey'],
  },
  initialPromiseResolved: {
    label: 'resolved initial promise of',
    coloredLabel: '%cresolved %cinitial promise %cof',
    colors: [['green', 'bold'], ['pink', 'bold'], 'grey'],
  },
  changedPromiseResolved: {
    label: 'resolved promise of',
    coloredLabel: '%cresolved %cpromise %cof',
    colors: [['green', 'bold'], ['pink', 'bold'], 'grey'],
  },
  initialPromiseRejected: {
    label: 'rejected initial promise of',
    coloredLabel: '%crejected %cinitial promise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
  changedPromiseRejected: {
    label: 'rejected promise of',
    coloredLabel: '%crejected %cpromise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
  initialPromiseAborted: {
    label: 'aborted initial promise of',
    coloredLabel: '%caborted %cinitial promise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
  changedPromiseAborted: {
    label: 'aborted promise of',
    coloredLabel: '%caborted %cpromise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
  destroyed: {
    label: 'destroyed',
    coloredLabel: '%cdestroyed',
    colors: [['red', 'bold']],
  },
  mounted: {
    label: 'mounted',
    coloredLabel: '%cmounted',
    colors: [['green', 'bold']],
  },
  unmounted: {
    label: 'unmounted',
    coloredLabel: '%cunmounted',
    colors: [['red', 'bold']],
  },
};

export function logEvent(logEventMap: AtomsLoggerEventMap, options: AtomsLoggerState): void {
  const { collapseEvents, logger, indentSpaces, indentSpacesDepth1, indentSpacesDepth2 } = options;

  let { groupLogs } = options;

  const { logs, subLogsArray, subLogsObject } = getEventLogs(logEventMap, options);

  if (indentSpacesDepth1.length > 0) {
    logs[0] = `${indentSpacesDepth1}${logs[0]}`;
  }

  if (collapseEvents ? !logger.groupCollapsed : !logger.group) {
    groupLogs = false;
  } else if (!logger.groupEnd) {
    groupLogs = false;
  } else if (subLogsArray.length <= 0) {
    groupLogs = false;
  }

  try {
    if (!groupLogs) {
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
        if (indentSpaces > 0) {
          subLogs[0] = `${indentSpacesDepth2}${subLogs[0]}`;
        }
        logger.log(...subLogs);
      }
    }
  } finally {
    if (groupLogs) {
      logger.groupEnd?.();
    }
  }
}

export function getEventLogs(
  logEventMap: AtomsLoggerEventMap,
  options: AtomsLoggerState,
): {
  logs: [string, ...unknown[]];
  subLogsArray: [string, ...unknown[]][];
  subLogsObject: Record<string, unknown>;
} {
  const [eventType, event] = Object.entries(logEventMap)[0] as [
    keyof AtomsLoggerEventMap,
    AtomsLoggerEvent,
  ];

  const {
    label: eventLabel,
    coloredLabel: coloredEventLabel,
    colors: eventColors,
  } = AtomsLoggerEventLabelMap[eventType];

  const logs = [] as unknown[] as [string, ...unknown[]];
  const subLogsArray: [string, ...unknown[]][] = [];
  const subLogsObject: Record<string, unknown> = {};

  addToLogs(logs, options, {
    plainText: () => eventLabel,
    formatted: () => [coloredEventLabel, ...eventColors],
  });

  addAtomToLogs(logs, event.atom, options);

  const { hasOldValue, isOldValueError } = addOldValuesToLogs({
    event,
    logs,
    subLogsArray,
    subLogsObject,
    options,
  });

  addNewValuesToLogs({
    logEventMap,
    event,
    logs,
    subLogsArray,
    subLogsObject,
    options,
    hasOldValue,
    isOldValueError,
  });

  // If the atom is unmounted or destroyed, we don't need to log anything else.
  if (!logEventMap.unmounted && !logEventMap.destroyed) {
    if (event.pendingPromises) {
      subLogsArray.push(['pending promises', event.pendingPromises]);
      subLogsObject.pendingPromises = event.pendingPromises;
    }
    if (event.dependencies) {
      subLogsArray.push(['dependencies', event.dependencies]);
      subLogsObject.dependencies = event.dependencies;
    }
    if (event.mountedDependencies) {
      subLogsArray.push(['mounted dependencies', event.mountedDependencies]);
      subLogsObject.mountedDependencies = event.mountedDependencies;
    }
    if (event.mountedDependents) {
      subLogsArray.push(['mounted dependents', event.mountedDependents]);
      subLogsObject.mountedDependents = event.mountedDependents;
    }
  }

  return { logs, subLogsArray, subLogsObject };
}

function addOldValuesToLogs({
  event,
  logs,
  subLogsArray,
  subLogsObject,
  options,
}: {
  event: AtomsLoggerEvent;
  logs: [string, ...unknown[]];
  subLogsArray: [string, ...unknown[]][];
  subLogsObject: Record<string, unknown>;
  options: AtomsLoggerState;
}): {
  hasOldValue: boolean;
  oldValue: unknown;
  isOldValueError: boolean;
  hasOldValues: boolean;
  oldValues: unknown[];
} {
  let hasOldValue = false;
  let oldValue: unknown;
  let isOldValueError = false;

  if ('oldValue' in event) {
    hasOldValue = true;
    oldValue = event.oldValue;
    isOldValueError = oldValue instanceof Error;
  }

  let hasOldValues = false;
  let oldValues: unknown[] = [];
  if ('oldValues' in event && event.oldValues !== undefined && event.oldValues.length > 0) {
    hasOldValues = true;
    oldValues = event.oldValues;
    hasOldValue = true;
    oldValue = oldValues[0];
    isOldValueError = oldValue instanceof Error;
  }

  if (hasOldValues) {
    addToLogs(logs, options, {
      plainText: () => `${oldValues.length.toString()} times`,
      formatted: () => [`%c${oldValues.length.toString()} %ctimes`, 'default', 'grey'],
    });
  }

  if (hasOldValue) {
    addToLogs(logs, options, {
      plainText: () => {
        if (options.stringifyValues) {
          const stringifiedState = stringifyValue(oldValue, options);
          return `from ${stringifiedState}`;
        } else if (hasOldValues) {
          return [`from`, oldValues];
        } else {
          return [`from`, oldValue];
        }
      },
      formatted: () => {
        if (options.stringifyValues) {
          const stringifiedState = stringifyValue(oldValue, options);
          return [`%cfrom %c${stringifiedState}`, 'grey', 'default'];
        } else {
          return [`%cfrom %c%o`, 'grey', 'default', { data: oldValue }];
        }
      },
    });
  }

  if (hasOldValues) {
    subLogsArray.push(['old values', oldValues]);
    if (options.stringifyValues) subLogsObject.oldValues = oldValues;
  } else if (hasOldValue) {
    if (isOldValueError) {
      subLogsArray.push(['old error', oldValue]);
      if (options.stringifyValues) subLogsObject.oldError = oldValue;
    } else {
      subLogsArray.push(['old value', oldValue]);
      if (options.stringifyValues) subLogsObject.oldValue = oldValue;
    }
  }

  return { hasOldValue, oldValue, isOldValueError, hasOldValues, oldValues };
}

function addNewValuesToLogs({
  event,
  logs,
  logEventMap,
  subLogsArray,
  subLogsObject,
  options,
  hasOldValue,
  isOldValueError,
}: {
  event: AtomsLoggerEvent;
  logs: [string, ...unknown[]];
  logEventMap: AtomsLoggerEventMap;
  subLogsArray: [string, ...unknown[]][];
  subLogsObject: Record<string, unknown>;
  options: AtomsLoggerState;
  hasOldValue: boolean;
  isOldValueError: boolean;
}) {
  let hasNewValue = false;
  let newValue: unknown;
  let isNewValueError = false;
  const showNewValueInLog = !logEventMap.mounted;

  if ('newValue' in event) {
    hasNewValue = true;
    newValue = event.newValue;
    isNewValueError = false;
  } else if ('value' in event) {
    hasNewValue = true;
    newValue = event.value;
    isNewValueError = false;
  } else if ('error' in event) {
    hasNewValue = true;
    newValue = event.error;
    isNewValueError = true;
  }

  if (showNewValueInLog && hasNewValue) {
    addToLogs(logs, options, {
      plainText: () => {
        if (options.stringifyValues) {
          const stringifiedState = stringifyValue(newValue, options);
          return `to ${stringifiedState}`;
        } else {
          return [`to`, newValue];
        }
      },
      formatted: () => {
        if (options.stringifyValues) {
          const stringifiedState = stringifyValue(newValue, options);
          return [`%cto %c${stringifiedState}`, 'grey', 'default'];
        } else {
          return [`%cto %c%o`, 'grey', 'default', { data: newValue }];
        }
      },
    });
  }

  if (hasNewValue) {
    if (isNewValueError) {
      if (hasOldValue && isOldValueError) {
        subLogsArray.push(['new error', newValue]);
        if (options.stringifyValues) subLogsObject.newError = newValue;
      } else {
        subLogsArray.push(['error', newValue]);
        if (options.stringifyValues) subLogsObject.error = newValue;
      }
    } else {
      if (hasOldValue && !isOldValueError) {
        subLogsArray.push(['new value', newValue]);
        if (options.stringifyValues) subLogsObject.newValue = newValue;
      } else {
        subLogsArray.push(['value', newValue]);
        if (options.stringifyValues) subLogsObject.value = newValue;
      }
    }
  }
}
