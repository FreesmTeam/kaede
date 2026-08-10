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

/*
 * Browsers do not expose real system statistics, so the development
 * mode overlay gets the javascript heap numbers where available
 * (Chromium only) and gentle placeholders everywhere else
 */

// 'performance.memory' is a non-standard Chromium extension
type MemoryPerformanceType = Performance & {
  "memory"?: {
    "usedJSHeapSize" : number;
    "jsHeapSizeLimit": number;
  };
};

const Gibibyte: number = 1024 ** 3;

let placeholderCpuUsage: number = 20;
let placeholderUsedMemory: number = 2 * Gibibyte;

// A replica of the 'get_cpu_usage' command: a random walk between 1% and 99%
export function getCpuUsageReplica(): number {
  const drift: number = (Math.random() - 0.5) * 10;

  placeholderCpuUsage = Math.min(Math.max(placeholderCpuUsage + drift, 1), 99);

  return placeholderCpuUsage;
}

// A replica of the 'get_system_memory' command: '[used, total]' in bytes
export function getSystemMemoryReplica(): [number, number] {
  const memory = (performance as MemoryPerformanceType).memory;

  if (memory) {
    return [memory.usedJSHeapSize, memory.jsHeapSizeLimit];
  }

  const drift: number = (Math.random() - 0.5) * 64 * 1024 * 1024;

  placeholderUsedMemory = Math.min(
    Math.max(placeholderUsedMemory + drift, Gibibyte),
    7 * Gibibyte,
  );

  return [Math.floor(placeholderUsedMemory), 8 * Gibibyte];
}
