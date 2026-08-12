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

/**
 * ATTENTION: AI-generated (by Claude Opus 5 on 'max' reasoning)
 */

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

/*
 * The Go counterpart of translations.rs.
 *
 * Locale files are user supplied JSON dropped into the translations directory,
 * so anything unreadable, unparseable or missing its Info block is skipped
 * silently: one bad file must not hide the locales that are fine.
 */

// trMaxConcurrentReads bounds the parallel reads. translations.rs spawns one
// task per file, which a directory holding hundreds of locales would turn into
// hundreds of simultaneous file handles.
const trMaxConcurrentReads = 8

/*
 * TrLocale is `ItemInfo` of translations.rs, which carries no `rename_all`, so
 * both wire names are the lowercase Rust field names.
 */
type TrLocale struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

/*
 * The locale file itself. Only the Info block is read, the Messages section is
 * ignored, and the PascalCase keys come from explicit serde renames.
 *
 * Every field is a pointer so a file that parses but leaves Info, Code or Name
 * out is skipped rather than contributing an empty entry, which is what the
 * chain of Option question marks does in the Rust.
 */
type trLocaleInfo struct {
	Code *string `json:"Code"`
	Name *string `json:"Name"`
}

type trLocaleFile struct {
	Info *trLocaleInfo `json:"Info"`
}

// TranslationsService carries no state: each call rescans the directory it is
// given.
type TranslationsService struct{}

/*
 * GetLocales lists the locales available in a directory, backing `get_locales`.
 *
 * The Rust collects in JoinSet completion order, which is nondeterministic;
 * these results follow the directory listing instead. Nothing observable
 * depends on the order — the settings tab appends whatever it has not already
 * got a code for — and a stable order keeps the language list from reshuffling
 * between launches.
 */
func (t *TranslationsService) GetLocales(directory string) ([]TrLocale, error) {
	paths, err := trLocaleFilePaths(directory)

	if err != nil {
		return nil, err
	}

	locales := make([]TrLocale, len(paths))
	usable := make([]bool, len(paths))
	semaphore := make(chan struct{}, trMaxConcurrentReads)

	var waitGroup sync.WaitGroup

	for index, path := range paths {
		waitGroup.Add(1)
		semaphore <- struct{}{}

		// Each task owns its own slot, so the results need no locking.
		go func() {
			defer waitGroup.Done()
			defer func() { <-semaphore }()

			locales[index], usable[index] = trReadLocale(path)
		}()
	}

	waitGroup.Wait()

	// Non-nil even when nothing was found: the frontend iterates the answer and
	// a nil slice would reach it as JSON null.
	items := make([]TrLocale, 0, len(paths))

	for index := range paths {
		if usable[index] {
			items = append(items, locales[index])
		}
	}

	return items, nil
}

/*
 * trLocaleFilePaths lists the *.json files directly inside directory.
 *
 * The Rust distinguishes a failure to open the directory from a failure to walk
 * it; os.ReadDir folds both into one error, so the opening message covers them.
 */
func trLocaleFilePaths(directory string) ([]string, error) {
	entries, err := os.ReadDir(directory)

	if err != nil {
		return nil, fmt.Errorf("Failed to read directory '%s': %w", directory, err)
	}

	paths := make([]string, 0, len(entries))

	for _, entry := range entries {
		/*
		 * translations.rs filters on DirEntry::file_type, which does not follow
		 * symlinks, so a symlinked locale file is skipped. extensions.rs uses
		 * the following variant instead, hence the different check there.
		 */
		if !entry.Type().IsRegular() {
			continue
		}

		if !trHasJSONExtension(entry.Name()) {
			continue
		}

		paths = append(paths, filepath.Join(directory, entry.Name()))
	}

	return paths, nil
}

// trHasJSONExtension compares the extension case insensitively, mirroring
// Path::extension, which sees no extension in a dotfile such as ".json".
func trHasJSONExtension(fileName string) bool {
	dot := strings.LastIndexByte(fileName, '.')

	if dot <= 0 {
		return false
	}

	return strings.EqualFold(fileName[dot+1:], "json")
}

/*
 * trReadLocale derives one locale from a file, reporting whether it is usable.
 *
 * The display name is taken straight from Info.Name, the label the translator
 * wrote in their own language, e.g. "Русский" — it is never derived from the
 * file name or the code.
 */
func trReadLocale(path string) (TrLocale, bool) {
	contents, err := os.ReadFile(path)

	if err != nil {
		return TrLocale{}, false
	}

	var parsed trLocaleFile

	// A byte order mark makes serde_json fail too, so such a file is skipped on
	// both backends rather than quietly rescued here.
	if err := json.Unmarshal(contents, &parsed); err != nil {
		return TrLocale{}, false
	}

	if parsed.Info == nil || parsed.Info.Code == nil || parsed.Info.Name == nil {
		return TrLocale{}, false
	}

	return TrLocale{Code: *parsed.Info.Code, Name: *parsed.Info.Name}, true
}
