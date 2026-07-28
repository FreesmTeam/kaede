export type ArrayComparator<T> = (left: T, right: T) => number;

export function copyAndSort<T>(
  values: ReadonlyArray<T>,
  compareFunction?: ArrayComparator<T>,
): Array<T> {
  const copy = [...values];

  copy.sort(compareFunction);

  return copy;
}

export function copyAndReverse<T>(values: ReadonlyArray<T>): Array<T> {
  const copy = [...values];

  copy.reverse();

  return copy;
}
