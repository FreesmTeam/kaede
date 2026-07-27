import type { Hardener, URLSink } from "ark-of-atrahasis";

export const ALL_URL_SINKS = Object.freeze([
  "anchor.href",
  "image.src",
  "video.src",
  "video.poster",
  "audio.src",
  "source.src",
  "track.src",
] as const satisfies ReadonlyArray<URLSink>);

export const NOOP_DISPOSE = (): void => {};

export const testHarden: Hardener = <Value>(value: Value): Value => {
  const seen = (new WeakSet<object>);

  const freeze = (candidate: unknown): void => {
    if (
      typeof candidate !== "function" &&
      (candidate === null || typeof candidate !== "object")
    ) {
      return;
    }

    if (seen.has(candidate)) {
      return;
    }

    seen.add(candidate);

    for (const key of Reflect.ownKeys(candidate)) {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);

      if (descriptor !== undefined && "value" in descriptor) {
        freeze(descriptor.value);
      }
    }

    Object.freeze(candidate);
  };

  freeze(value);

  return value;
};
