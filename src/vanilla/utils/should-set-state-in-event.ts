import { AtomEventTypes, type AtomEvent } from '../types/event.js';

/**
 * Returns `true` if the event type carries state data (value, dependencies, etc.).
 *
 * `unmounted` and `destroyed` events do not carry any additional state.
 */
export function shouldSetStateInEvent(event: AtomEvent): boolean {
  return event.type !== AtomEventTypes.unmounted && event.type !== AtomEventTypes.destroyed;
}
