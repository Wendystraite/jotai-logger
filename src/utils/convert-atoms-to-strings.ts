import type { AnyAtom, AtomId } from '../types/atoms-logger.js';

export function convertAtomsToStrings(
  atoms: IteratorObject<AnyAtom> | undefined,
  options: {
    shouldShowPrivateAtoms: boolean;
  },
): AtomId[] | undefined {
  if (!atoms) {
    return undefined;
  }
  const strings: AtomId[] = [];
  for (const atom of atoms) {
    if (!options.shouldShowPrivateAtoms && atom.debugPrivate === true) {
      continue;
    }
    strings.push(atom.toString());
  }
  return strings;
}
