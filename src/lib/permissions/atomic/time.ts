/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import "ses";

const wrappedPerformance = {
  "timeOrigin": performance.timeOrigin,
  "now"       : (): number => performance.now(),
};

const dateReferences = new WeakMap<wrappedDate, Date>;

function getDateReference(input: wrappedDate): Date {
  const current: Date | undefined = dateReferences.get(input);

  if (!current) {
    throw new Error("The provided 'Date' is unregistered in the host references");
  }

  return current;
}

class wrappedDate {
  public static now(): number {
    return Date.now();
  }

  public static parse(input: unknown): number {
    if (typeof input !== "string") {
      throw new TypeError("The input for 'Date#parse' should be a string");
    }

    return Date.parse(input);
  }

  public static UTC(
    year?: unknown,
    monthIndex?: unknown,
    date?: unknown,
    hours?: unknown,
    minutes?: unknown,
    seconds?: unknown,
    ms?: unknown,
  ): number {
    const toValidate = [year, monthIndex, date, hours, minutes, seconds, ms];
    const validated: Array<number | undefined> = [];

    for (const current of toValidate) {
      const isNumber = typeof current === "number" && !Number.isNaN(current);

      if (isNumber || current === undefined) {
        // It's okay if we have an undefined value since it might mean the argument isn't present
        validated.push(current);

        continue;
      }

      throw new TypeError("The input for 'Date#UTC' should be a number");
    }

    return Date.UTC(
      ...(validated as [number, number, number, number, number, number, number]),
    );
  }

  constructor(input: unknown) {
    if (input === undefined) {
      dateReferences.set(this, harden(new Date));

      return;
    }

    if (
      (typeof input === "number" && !Number.isNaN(input)) ||
      typeof input === "string"
    ) {
      dateReferences.set(this, harden(new Date(input)));

      return;
    }

    if (input instanceof wrappedDate) {
      const absolute: number = getDateReference(input).valueOf();

      dateReferences.set(this, harden(new Date(absolute)));

      return;
    }

    throw new TypeError("The input for the 'Date' constructor is invalid");
  }

  public valueOf(): number {
    return getDateReference(this).valueOf();
  }

  public getDate(): number {
    return getDateReference(this).getDate();
  }

  public getDay(): number {
    return getDateReference(this).getDay();
  }

  public getFullYear(): number {
    return getDateReference(this).getFullYear();
  }

  public getHours(): number {
    return getDateReference(this).getHours();
  }

  public getMilliseconds(): number {
    return getDateReference(this).getMilliseconds();
  }

  public getMinutes(): number {
    return getDateReference(this).getMinutes();
  }

  public getMonth(): number {
    return getDateReference(this).getMonth();
  }

  public getSeconds(): number {
    return getDateReference(this).getSeconds();
  }

  public getTime(): number {
    return getDateReference(this).getTime();
  }

  public getTimezoneOffset(): number {
    return getDateReference(this).getTimezoneOffset();
  }

  public getUTCDate(): number {
    return getDateReference(this).getUTCDate();
  }

  public getUTCDay(): number {
    return getDateReference(this).getUTCDay();
  }

  public getUTCFullYear(): number {
    return getDateReference(this).getUTCFullYear();
  }

  public getUTCHours(): number {
    return getDateReference(this).getUTCHours();
  }

  public getUTCMilliseconds(): number {
    return getDateReference(this).getUTCMilliseconds();
  }

  public getUTCMinutes(): number {
    return getDateReference(this).getUTCMinutes();
  }

  public getUTCMonth(): number {
    return getDateReference(this).getUTCMonth();
  }

  public getUTCSeconds(): number {
    return getDateReference(this).getUTCSeconds();
  }

  public toString(): string {
    return getDateReference(this).toString();
  }

  public toTimeString(): string {
    return getDateReference(this).toTimeString();
  }

  public toUTCString(): string {
    return getDateReference(this).toUTCString();
  }

  public toJSON(): string {
    return getDateReference(this).toJSON();
  }

  public toDateString(): string {
    return getDateReference(this).toDateString();
  }

  public toISOString(): string {
    return getDateReference(this).toISOString();
  }

  public toLocaleString(): string {
    return getDateReference(this).toLocaleString();
  }

  public toLocaleDateString(): string {
    return getDateReference(this).toLocaleDateString();
  }

  public toLocaleTimeString(): string {
    return getDateReference(this).toLocaleTimeString();
  }
}

export function handleTimePermission({
  scope,
}: {
  "id"   : string;
  "scope": "performance" | "date";
}): unknown {
  switch (scope) {
    case "performance": {
      return harden({
        "performance": wrappedPerformance,
      });
    }
    case "date": {
      return harden({
        "Date": wrappedDate,
      });
    }
  }
}
