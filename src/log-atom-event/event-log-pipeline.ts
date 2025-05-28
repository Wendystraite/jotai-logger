import type {
  AtomsLoggerEvent,
  AtomsLoggerEventMap,
  AtomsLoggerState,
} from '../types/atoms-logger.js';
import { getEventMapEvent } from '../utils/get-event-map-event.js';
import { stringifyValue } from '../utils/stringify-value.js';
import { addAtomToLogs } from './add-atom-to-logs.js';
import { addToLogs } from './add-to-logs.js';
import { LogPipeline } from './log-pipeline.js';

export const EventLogPipeline = new LogPipeline()
  .withArgs<{
    eventMap: AtomsLoggerEventMap;
    options: AtomsLoggerState;
  }>()

  // Initialize base logging context
  .withMeta<{
    logs: [string, ...unknown[]];
    subLogsArray: [string, ...unknown[]][];
    subLogsObject: Record<string, unknown>;
    event: AtomsLoggerEvent;
  }>(function addLogsToEventMeta(context) {
    context.logs = [] as unknown[] as [string, ...unknown[]];
    context.subLogsArray = [];
    context.subLogsObject = {};
    context.event = getEventMapEvent(context.eventMap);
  })

  // Process old values
  .withMeta<
    (
      | { hasOldValues: true; oldValues: unknown[] }
      | { hasOldValues?: undefined; oldValues?: undefined }
    ) &
      (
        | { hasOldValue: true; oldValue: unknown; isOldValueError: boolean }
        | { hasOldValue?: undefined; oldValue?: undefined; isOldValueError?: undefined }
      )
  >(function addOldValuesToEventMeta(context) {
    const { event } = context;
    if ('oldValues' in event && event.oldValues !== undefined && event.oldValues.length > 0) {
      context.hasOldValues = true;
      context.oldValues = event.oldValues;
      context.hasOldValue = true;
      context.oldValue = event.oldValues[0];
      context.isOldValueError = event.oldValues[0] instanceof Error;
    } else if ('oldValue' in event) {
      context.hasOldValue = true;
      context.oldValue = event.oldValue;
      context.isOldValueError = event.oldValue instanceof Error;
    }
  })

  // Process new values
  .withMeta<
    (
      | { hasNewValue: true; newValue: unknown; isNewValueError: boolean }
      | { hasNewValue?: undefined; newValue?: undefined; isNewValueError?: undefined }
    ) & { showNewValueInLog: boolean }
  >(function addNewValuesToEventMeta(context) {
    const { event, eventMap } = context;
    if ('newValue' in event) {
      context.hasNewValue = true;
      context.newValue = event.newValue;
      context.isNewValueError = false;
    } else if ('value' in event) {
      context.hasNewValue = true;
      context.newValue = event.value;
      context.isNewValueError = false;
    } else if ('error' in event) {
      context.hasNewValue = true;
      context.newValue = event.error;
      context.isNewValueError = true;
    }
    context.showNewValueInLog = !eventMap.mounted;
  })

  // {event}
  .withLog(function addEventToEventLogs(context) {
    const { logs, eventMap, options } = context;
    if (eventMap.initialized) {
      addToLogs(logs, options, {
        plainText: () => 'initialized value of',
        formatted: () => ['%cinitialized value %cof', ['blue', 'bold'], 'grey'],
      });
    } else if (eventMap.changed) {
      addToLogs(logs, options, {
        plainText: () => 'changed value of',
        formatted: () => ['%cchanged value %cof', ['lightBlue', 'bold'], 'grey'],
      });
    } else if (eventMap.initialPromisePending) {
      addToLogs(logs, options, {
        plainText: () => 'pending initial promise of',
        formatted: () => ['%cpending initial promise %cof', ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.changedPromisePending) {
      addToLogs(logs, options, {
        plainText: () => 'pending promise of',
        formatted: () => ['%cpending promise %cof', ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.initialPromiseResolved) {
      addToLogs(logs, options, {
        plainText: () => 'resolved initial promise of',
        formatted: () => [
          '%cresolved %cinitial promise %cof',
          ['green', 'bold'],
          ['pink', 'bold'],
          'grey',
        ],
      });
    } else if (eventMap.changedPromiseResolved) {
      addToLogs(logs, options, {
        plainText: () => 'resolved promise of',
        formatted: () => ['%cresolved %cpromise %cof', ['green', 'bold'], ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.initialPromiseRejected) {
      addToLogs(logs, options, {
        plainText: () => 'rejected initial promise of',
        formatted: () => [
          '%crejected %cinitial promise %cof',
          ['red', 'bold'],
          ['pink', 'bold'],
          'grey',
        ],
      });
    } else if (eventMap.changedPromiseRejected) {
      addToLogs(logs, options, {
        plainText: () => 'rejected promise of',
        formatted: () => ['%crejected %cpromise %cof', ['red', 'bold'], ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.initialPromiseAborted) {
      addToLogs(logs, options, {
        plainText: () => 'aborted initial promise of',
        formatted: () => [
          '%caborted %cinitial promise %cof',
          ['red', 'bold'],
          ['pink', 'bold'],
          'grey',
        ],
      });
    } else if (eventMap.changedPromiseAborted) {
      addToLogs(logs, options, {
        plainText: () => 'aborted promise of',
        formatted: () => ['%caborted %cpromise %cof', ['red', 'bold'], ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.destroyed) {
      addToLogs(logs, options, {
        plainText: () => 'destroyed',
        formatted: () => ['%cdestroyed', ['red', 'bold']],
      });
    } else if (eventMap.dependenciesChanged) {
      addToLogs(logs, options, {
        plainText: () => 'changed dependencies of',
        formatted: () => ['%cchanged dependencies %cof', ['yellow', 'bold'], 'grey'],
      });
    } else if (eventMap.mounted) {
      addToLogs(logs, options, {
        plainText: () => 'mounted',
        formatted: () => ['%cmounted', ['green', 'bold']],
      });
    } else if (eventMap.unmounted) {
      addToLogs(logs, options, {
        plainText: () => 'unmounted',
        formatted: () => ['%cunmounted', ['red', 'bold']],
      });
    }
  })

  // {atom}
  .withLog(function addAtomToEventLogs({ logs, event, options }) {
    addAtomToLogs(logs, event.atom, options);
  })

  // xx times
  .withLog(function addCallTimesToEventLogs({ logs, hasOldValues, oldValues, options }) {
    if (hasOldValues) {
      addToLogs(logs, options, {
        plainText: () => `${oldValues.length.toString()} times`,
        formatted: () => [`%c${oldValues.length.toString()} %ctimes`, 'default', 'grey'],
      });
    }
  })

  // from xx
  .withLog(function addOldValuesToEventLogs({
    logs,
    subLogsArray,
    subLogsObject,
    options,
    options: { stringifyValues },
    hasOldValue,
    oldValue,
    isOldValueError,
    hasOldValues,
    oldValues,
  }) {
    if (hasOldValue) {
      addToLogs(logs, options, {
        plainText: () => {
          if (stringifyValues) {
            const stringifiedState = stringifyValue(oldValue, options);
            return `from ${stringifiedState}`;
          } else if (hasOldValues) {
            return [`from`, oldValues];
          } else {
            return [`from`, oldValue];
          }
        },
        formatted: () => {
          if (stringifyValues) {
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
  })

  // to xx
  .withLog(function addNewValuesToEventLogs({
    logs,
    subLogsArray,
    subLogsObject,
    options,
    options: { stringifyValues },
    hasNewValue,
    newValue,
    isNewValueError,
    showNewValueInLog,
    hasOldValue,
    isOldValueError,
  }) {
    if (showNewValueInLog && hasNewValue) {
      addToLogs(logs, options, {
        plainText: () => {
          if (stringifyValues) {
            const stringifiedState = stringifyValue(newValue, options);
            return `to ${stringifiedState}`;
          } else {
            return [`to`, newValue];
          }
        },
        formatted: () => {
          if (stringifyValues) {
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
  })

  // Extra data logger
  .withLog(function addExtraDataToEventLogs({ subLogsArray, subLogsObject, eventMap, event }) {
    if (!shouldSetStateInEvent(eventMap)) return;

    const { pendingPromises, dependencies, dependents } = event;

    const showPendingPromises = pendingPromises && pendingPromises.length > 0;
    const showDependents = dependents && dependents.length > 0;

    let oldDependencies = eventMap.dependenciesChanged?.oldDependencies;
    let newDependencies = dependencies;
    const showOldDependencies = eventMap.dependenciesChanged;
    const showNewDependencies = showOldDependencies;

    const showDependencies = !showNewDependencies && dependencies && dependencies.size > 0;

    if (showPendingPromises) {
      subLogsArray.push(['pending promises', pendingPromises]);
      subLogsObject.pendingPromises = pendingPromises;
    }
    if (showOldDependencies) {
      oldDependencies ??= new Set();
      const oldDependenciesArray = Array.from(oldDependencies);
      subLogsArray.push(['old dependencies', oldDependenciesArray]);
      subLogsObject.oldDependencies = oldDependenciesArray;
    }
    if (showNewDependencies) {
      newDependencies ??= new Set();
      const newDependenciesArray = Array.from(newDependencies);
      subLogsArray.push(['new dependencies', newDependenciesArray]);
      subLogsObject.newDependencies = newDependenciesArray;
    }
    if (showDependencies) {
      const dependenciesArray = Array.from(dependencies);
      subLogsArray.push(['dependencies', dependenciesArray]);
      subLogsObject.dependencies = dependenciesArray;
    }
    if (showDependents) {
      subLogsArray.push(['dependents', dependents]);
      subLogsObject.dependents = dependents;
    }
  })

  // Indentation
  .withLog(function addIndentationToEventLogs({ logs, subLogsArray, options }) {
    const { indentSpaces, indentSpacesDepth1, indentSpacesDepth2 } = options;

    if (indentSpaces > 0) {
      logs[0] = `${indentSpacesDepth1}${logs[0]}`;

      for (const subLogs of subLogsArray) {
        if (indentSpaces > 0) {
          subLogs[0] = `${indentSpacesDepth2}${subLogs[0]}`;
        }
      }
    }
  });

/**
 * Check if the event states should be added to the event.
 */
export function shouldSetStateInEvent(eventMap: AtomsLoggerEventMap): boolean {
  // If the atom is unmounted or destroyed, we don't need to log anything else.
  return !eventMap.unmounted && !eventMap.destroyed;
}
