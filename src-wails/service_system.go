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

package main

import (
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
)

/*
 * The Go counterpart of `system.rs`, which reported device-wide resource use
 * to the development mode overlay through the `sysinfo` crate.
 *
 * gopsutil plays the part `sysinfo` did: it reads the same counter files on
 * Linux, the same Mach calls on macOS and the same performance counters on
 * Windows, without this package spawning a helper process for any of them.
 * That last point matters — probing Windows through a console helper would
 * flash a window at the user once a second.
 *
 * Neither command returned a `Result`, so an unavailable reading is reported
 * as a zero and never as a rejection.
 */

/*
 * sysMinimumCPUInterval is `sysinfo::MINIMUM_CPU_UPDATE_INTERVAL`. Two samples
 * taken closer together than this differ by a handful of ticks, which rounds
 * to a meaningless percentage, so the first reading pays for the wait once.
 */
const sysMinimumCPUInterval = 200 * time.Millisecond

/*
 * SystemService replaces the `static SYS_CPU: Mutex<Option<System>>` global.
 *
 * The Rust kept one `System` alive across calls purely so that CPU
 * percentages had a previous sample to compare against, and its mutex
 * serialised concurrent callers. Both roles are reproduced here.
 */
type SystemService struct {
	cpuMutex sync.Mutex
	sampled  time.Time
}

// newSystemService builds the service. Nothing is warmed up: the first
// GetCPUUsage establishes the baseline, exactly as the Rust did.
func newSystemService() *SystemService {
	return &SystemService{}
}

/*
 * GetSystemMemory reports used and total physical memory in bytes.
 *
 * The pair is marshalled as a two element array, because the Rust returned a
 * tuple and the overlay destructures `[used, total]`.
 */
func (s *SystemService) GetSystemMemory() [2]uint64 {
	stats, err := mem.VirtualMemory()

	if err != nil || stats == nil {
		return [2]uint64{0, 0}
	}

	/*
	 * `sysinfo::used_memory` counts everything the kernel cannot hand out on
	 * demand, which is total minus available rather than gopsutil's `Used`
	 * (the latter excludes reclaimable cache on Linux and so reads lower).
	 */
	used := stats.Used

	if stats.Available > 0 && stats.Total >= stats.Available {
		used = stats.Total - stats.Available
	}

	return [2]uint64{used, stats.Total}
}

/*
 * GetCPUUsage reports device-wide CPU load as a percentage.
 *
 * gopsutil compares against the sample taken by the previous call, so the
 * only thing to enforce here is that two calls are never closer together than
 * the minimum interval. The first call has nothing to compare against and
 * therefore blocks for that interval to take a pair of samples itself.
 */
func (s *SystemService) GetCPUUsage() float32 {
	s.cpuMutex.Lock()
	defer s.cpuMutex.Unlock()

	interval := time.Duration(0)

	if s.sampled.IsZero() {
		interval = sysMinimumCPUInterval
	} else if waited := time.Since(s.sampled); waited < sysMinimumCPUInterval {
		time.Sleep(sysMinimumCPUInterval - waited)
	}

	// A single aggregate figure, not one per core.
	percentages, err := cpu.Percent(interval, false)

	s.sampled = time.Now()

	if err != nil || len(percentages) == 0 {
		return 0
	}

	return float32(percentages[0])
}
