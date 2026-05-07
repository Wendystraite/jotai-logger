import type { Atom } from 'jotai';

/**
 * String representation of an atom.
 * It is the result of calling `atom.toString()`.
 */
export type AtomId = string;

/**
 * Generic atom type.
 */
export type AnyAtom = Atom<unknown>;

export const AtomEventTypes = {
  initialized: 1,
  initialPromisePending: 2,
  initialPromiseResolved: 3,
  initialPromiseRejected: 4,
  initialPromiseAborted: 5,
  changed: 6,
  changedPromisePending: 7,
  changedPromiseResolved: 8,
  changedPromiseRejected: 9,
  changedPromiseAborted: 10,
  dependenciesChanged: 11,
  mounted: 12,
  unmounted: 13,
  destroyed: 14,
} as const;

export type AtomEventTypes = typeof AtomEventTypes;

export type AtomEventType = AtomEventTypes[keyof AtomEventTypes];

/**
 * Fields common to all event types.
 */
export interface AtomEventBase {
  /** Atoms whose pending promises are blocking this atom at the time of the event. @see {@link AtomState.p} */
  pendingPromises?: Set<AnyAtom>;
  /** The set of atoms this atom depends on at the time of the event. @see {@link AtomState.d} @see {@link Mounted.d} */
  dependencies?: Set<AnyAtom>;
  /** The set of atoms that depend on this atom at the time of the event. @see {@link Mounted.t} */
  dependents?: Set<AnyAtom>;
}

/** Event emitted when an atom is initialized with a synchronous value. */
export interface AtomEventInitialized extends AtomEventBase {
  type: AtomEventTypes['initialized'];
  atom: AnyAtom;
  /** The initial value of the atom. */
  value: unknown;
}

/** Event emitted when an atom's initial promise is pending. */
export interface AtomEventInitialPromisePending extends AtomEventBase {
  type: AtomEventTypes['initialPromisePending'];
  atom: AnyAtom;
}

/** Event emitted when an atom's initial promise resolves. */
export interface AtomEventInitialPromiseResolved extends AtomEventBase {
  type: AtomEventTypes['initialPromiseResolved'];
  atom: AnyAtom;
  /** The resolved value of the promise. */
  value: unknown;
}

/** Event emitted when an atom's initial promise rejects. */
export interface AtomEventInitialPromiseRejected extends AtomEventBase {
  type: AtomEventTypes['initialPromiseRejected'];
  atom: AnyAtom;
  /** The rejection reason. */
  error: unknown;
}

/** Event emitted when an atom's initial promise is aborted. */
export interface AtomEventInitialPromiseAborted extends AtomEventBase {
  type: AtomEventTypes['initialPromiseAborted'];
  atom: AnyAtom;
}

/** Event emitted when an atom's value changes. */
export interface AtomEventChanged extends AtomEventBase {
  type: AtomEventTypes['changed'];
  atom: AnyAtom;
  /** The previous value of the atom, if known. */
  oldValue?: unknown;
  /** Previous values when multiple updates were batched. */
  oldValues?: unknown[];
  /** The new value of the atom. */
  newValue: unknown;
}

/** Event emitted when an atom changes to a pending promise. */
export interface AtomEventChangedPromisePending extends AtomEventBase {
  type: AtomEventTypes['changedPromisePending'];
  atom: AnyAtom;
  /** The previous synchronous value before the promise became pending. */
  oldValue: unknown;
}

/** Event emitted when an atom's changed promise resolves. */
export interface AtomEventChangedPromiseResolved extends AtomEventBase {
  type: AtomEventTypes['changedPromiseResolved'];
  atom: AnyAtom;
  /** The value before the promise was pending. */
  oldValue: unknown;
  /** The resolved value of the promise. */
  newValue: unknown;
}

/** Event emitted when an atom's changed promise rejects. */
export interface AtomEventChangedPromiseRejected extends AtomEventBase {
  type: AtomEventTypes['changedPromiseRejected'];
  atom: AnyAtom;
  /** The value before the promise was pending. */
  oldValue: unknown;
  /** The rejection reason. */
  error: unknown;
}

/** Event emitted when an atom's changed promise is aborted. */
export interface AtomEventChangedPromiseAborted extends AtomEventBase {
  type: AtomEventTypes['changedPromiseAborted'];
  atom: AnyAtom;
  /** The value before the promise was pending. */
  oldValue: unknown;
}

/** Event emitted when an atom's dependencies change. */
export interface AtomEventDependenciesChanged extends AtomEventBase {
  type: AtomEventTypes['dependenciesChanged'];
  atom: AnyAtom;
  /** The set of dependencies after this transaction. Overrides base optional field. */
  dependencies: Set<AnyAtom>;
  /** The set of dependencies before this transaction. */
  oldDependencies: Set<AnyAtom>;
  /** Dependencies added during this transaction. */
  addedDependencies: Set<AnyAtom>;
  /** Dependencies removed during this transaction. */
  removedDependencies: Set<AnyAtom>;
}

/** Event emitted when an atom is mounted (subscribed to). */
export interface AtomEventMounted extends AtomEventBase {
  type: AtomEventTypes['mounted'];
  atom: AnyAtom;
  /** The atom's value at mount time, if already initialized. */
  value?: unknown;
}

/** Event emitted when an atom is unmounted (no more subscribers). */
export interface AtomEventUnmounted extends AtomEventBase {
  type: AtomEventTypes['unmounted'];
  atom: AnyAtom;
}

/** Event emitted when an atom is garbage collected. */
export interface AtomEventDestroyed extends AtomEventBase {
  type: AtomEventTypes['destroyed'];
  /** Only the {@link AtomId} string is available because the atom object has been garbage collected. */
  atom: AtomId;
}

/**
 * Map from event type number to its concrete event shape.
 * Used for discriminated union lookup.
 */
export interface AtomEventMap {
  [AtomEventTypes.initialized]: AtomEventInitialized;
  [AtomEventTypes.initialPromisePending]: AtomEventInitialPromisePending;
  [AtomEventTypes.initialPromiseResolved]: AtomEventInitialPromiseResolved;
  [AtomEventTypes.initialPromiseRejected]: AtomEventInitialPromiseRejected;
  [AtomEventTypes.initialPromiseAborted]: AtomEventInitialPromiseAborted;
  [AtomEventTypes.changed]: AtomEventChanged;
  [AtomEventTypes.changedPromisePending]: AtomEventChangedPromisePending;
  [AtomEventTypes.changedPromiseResolved]: AtomEventChangedPromiseResolved;
  [AtomEventTypes.changedPromiseRejected]: AtomEventChangedPromiseRejected;
  [AtomEventTypes.changedPromiseAborted]: AtomEventChangedPromiseAborted;
  [AtomEventTypes.dependenciesChanged]: AtomEventDependenciesChanged;
  [AtomEventTypes.mounted]: AtomEventMounted;
  [AtomEventTypes.unmounted]: AtomEventUnmounted;
  [AtomEventTypes.destroyed]: AtomEventDestroyed;
}

/** Union of all concrete event types. */
export type AtomEvent = AtomEventMap[keyof AtomEventMap];
