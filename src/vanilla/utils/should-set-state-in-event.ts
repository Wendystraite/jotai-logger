import { AtomsLoggerEventTypes, type AtomsLoggerEvent } from '../types/event.js';

/**
 * Returns `true` if the event type carries state data (value, dependencies, etc.).
 *
 * `unmounted` and `destroyed` events do not carry any additional state.
 */
export function shouldSetStateInEvent(event: AtomsLoggerEvent): boolean {
  return (
    event.type !== AtomsLoggerEventTypes.unmounted && event.type !== AtomsLoggerEventTypes.destroyed
  );
}
