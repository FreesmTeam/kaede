export default function isKeyInObject<T extends object>(
  key: PropertyKey,
  passedObject: T,
): key is keyof T {
  return Object.prototype.hasOwnProperty.call(passedObject, key);
}
