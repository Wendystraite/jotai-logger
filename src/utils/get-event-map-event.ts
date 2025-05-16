import type { AtomsLoggerEvent, AtomsLoggerEventMap } from '../types/atoms-logger.js';

export function getEventMapEvent(eventMap: AtomsLoggerEventMap): AtomsLoggerEvent {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should be always present
  return Object.values(eventMap)[0]!;
}
