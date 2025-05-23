import type { Atom } from 'jotai';

export function convertAtomsToStrings(
  atoms: IteratorObject<Atom<unknown>> | undefined,
  options: {
    shouldShowPrivateAtoms: boolean;
  },
): string[] | undefined {
  if (!atoms) {
    return undefined;
  }
  const strings: string[] = [];
  for (const atom of atoms) {
    if (!options.shouldShowPrivateAtoms && atom.debugPrivate === true) {
      continue;
    }
    strings.push(atom.toString());
  }
  return strings;
}
