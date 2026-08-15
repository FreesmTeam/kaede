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

function extractDate(input: unknown): Date {
  if (
    (typeof input === "number" && !Number.isNaN(input)) ||
    typeof input === "string"
  ) {
    return harden(new Date(input));
  }

  if (input instanceof wrappedDate) {
    const absolute: number = input.valueOf();

    return harden(new Date(absolute));
  }

  throw new TypeError("The input for the 'Date' constructor is invalid");
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
    const validated: Array<number> = [];

    for (const current of toValidate) {
      const isNumber = typeof current === "number" && !Number.isNaN(current);

      if (isNumber) {
        validated.push(current);

        continue;
      }

      if (current === undefined) {
        // It's okay if we have an undefined value since it might mean the argument isn't present
        continue;
      }

      throw new TypeError("The input for 'Date#UTC' should be a number");
    }

    return Date.UTC(
      ...(validated as [number, number, number, number, number, number, number]),
    );
  }

  /*
   * Extensions will be able to change this field, of course, but '#field' is still pretty new,
   * so old macOS builds with Safari < 14.1 won't be able to support the actual private fields.
   * Transpilation/etc. will work but will probably lead to a simple re-write
   * from '#currentDate' into a publicly available 'currentDate', which misses the point
   */
  private readonly currentDate: unknown;

  constructor(input: unknown) {
    if (input === undefined) {
      this.currentDate = Date.now();
    }

    // That's why we will validate the input directly in methods
    this.currentDate = input;
  }

  public valueOf(): number {
    const _date = extractDate(this.currentDate);

    /*
     * I think of it like this:
     *
     * 'new wrappedDate2(new wrappedDate1(wrappedDate.now()))#valueOf' ->
     * 'this#currentDate' of 'wrappedDate2' becomes 'wrappedDate1'
     * 'extractDate' executes 'wrappedDate2#valueOf' and gets into 'wrappedDate1#valueOf'
     * 'this#currentDate' of 'wrappedDate1' is a number
     * 'extractDate' sees that 'currentDate' is a number,
     * so it initializes an actual 'Date' object with a valid 'valueOf' that returns a number
     */
    return _date.valueOf();
  }

  public getDate(): number {
    const _date = extractDate(this.currentDate);

    return _date.getDate();
  }
  // TODO: safe getters, setters, and converters
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
