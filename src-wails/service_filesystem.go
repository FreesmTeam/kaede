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
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

/*
 * FilesystemService backs the `plugin:fs` endpoints.
 *
 * These never existed in `src-tauri`: the Tauri build got them from the file
 * system plugin, so the contract followed here is the plugin's wire format as
 * consumed by `@tauri-apps/plugin-fs` (and replicated in
 * `src/lib/__browser/scopes`), not any `#[tauri::command]`.
 */
type FilesystemService struct{}

/*
 * FsDirEntry mirrors the plugin's `DirEntry`. The flags come from the directory
 * record rather than from a followed stat, so a link to a directory reports
 * neither file nor directory - the same answer `std::fs::DirEntry::file_type`
 * gives.
 */
type FsDirEntry struct {
	Name        string `json:"name"`
	IsDirectory bool   `json:"isDirectory"`
	IsFile      bool   `json:"isFile"`
	IsSymlink   bool   `json:"isSymlink"`
}

/*
 * FsFileInfo mirrors the plugin's `FileInfo`.
 *
 * `parseFileInfo` on the JS side reads every single field, so all of them are
 * always serialised. The ones that need platform specific metadata (`statx`,
 * `GetFileInformationByHandle`) are pointers and marshal to null instead of
 * being invented, because this backend has to type-check for every OS without
 * build tags.
 *
 * Timestamps are milliseconds since the Unix epoch: the JS wrapper hands them
 * straight to `new Date(value)`.
 */
type FsFileInfo struct {
	IsFile         bool    `json:"isFile"`
	IsDirectory    bool    `json:"isDirectory"`
	IsSymlink      bool    `json:"isSymlink"`
	Size           int64   `json:"size"`
	Mtime          *int64  `json:"mtime"`
	Atime          *int64  `json:"atime"`
	Birthtime      *int64  `json:"birthtime"`
	Readonly       bool    `json:"readonly"`
	FileAttributes *uint32 `json:"fileAttributes"`
	Dev            *uint64 `json:"dev"`
	Ino            *uint64 `json:"ino"`
	Mode           *uint32 `json:"mode"`
	Nlink          *uint64 `json:"nlink"`
	UID            *uint32 `json:"uid"`
	GID            *uint32 `json:"gid"`
	Rdev           *uint64 `json:"rdev"`
	Blksize        *int64  `json:"blksize"`
	Blocks         *int64  `json:"blocks"`
}

const (
	// Rust's `create_dir` and `File::create` ask for these modes and let the
	// umask narrow them down; Go does exactly the same with them.
	fsDirectoryMode os.FileMode = 0o777
	fsFileMode      os.FileMode = 0o666

	/*
	 * The owner write bit. Windows has no permission bits, but Go reports a
	 * file carrying FILE_ATTRIBUTE_READONLY as 0444, so testing this one bit
	 * answers "is this read-only" on every platform.
	 */
	fsWriteBit os.FileMode = 0o200
)

// Exists is the counterpart of `plugin:fs|exists`. A missing path is an answer
// rather than a failure; anything else (a denied parent directory, say) is not.
func (f *FilesystemService) Exists(path string) (bool, error) {
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}

		return false, fmt.Errorf("failed to check whether %s exists: %w", path, fsCause(err))
	}

	return true, nil
}

// Mkdir is the counterpart of `plugin:fs|mkdir`. Without recursion a missing
// parent is an error and an existing directory is an error too, which is what
// the plugin's `create_dir` does.
func (f *FilesystemService) Mkdir(path string, recursive bool) error {
	var err error

	if recursive {
		err = os.MkdirAll(path, fsDirectoryMode)
	} else {
		err = os.Mkdir(path, fsDirectoryMode)
	}

	if err != nil {
		return fmt.Errorf("failed to create the directory %s: %w", path, fsCause(err))
	}

	return nil
}

// ReadFile is the counterpart of `plugin:fs|read_file`. The bytes leave as
// base64 and the bridge turns them back into the Uint8Array the plugin API
// promises.
func (f *FilesystemService) ReadFile(path string) (string, error) {
	contents, err := os.ReadFile(path)

	if err != nil {
		return "", fmt.Errorf("failed to read %s: %w", path, fsCause(err))
	}

	return encodeBytes(contents), nil
}

// WriteFile is the counterpart of `plugin:fs|write_file`, where the frontend
// sends the payload as base64. Missing parent directories are not created, so
// that callers keep failing loudly exactly like they did under Tauri.
func (f *FilesystemService) WriteFile(path string, contents string) error {
	decoded, err := decodeBytes(contents)

	if err != nil {
		return fmt.Errorf("failed to decode the contents for %s: %w", path, err)
	}

	if err := os.WriteFile(path, decoded, fsFileMode); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, fsCause(err))
	}

	return nil
}

/*
 * WriteTextFile is the counterpart of `plugin:fs|write_text_file`.
 *
 * Text is the one payload that needs no base64 detour: the bridge already has
 * a UTF-8 string, and Go stores strings as UTF-8, so the bytes that land on
 * disk are the bytes the frontend encoded.
 */
func (f *FilesystemService) WriteTextFile(path string, contents string) error {
	if err := os.WriteFile(path, []byte(contents), fsFileMode); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, fsCause(err))
	}

	return nil
}

// ReadDir is the counterpart of `plugin:fs|read_dir`: immediate children only,
// never a recursive walk.
func (f *FilesystemService) ReadDir(path string) ([]FsDirEntry, error) {
	listing, err := os.ReadDir(path)

	if err != nil {
		return nil, fmt.Errorf("failed to read the directory %s: %w", path, fsCause(err))
	}

	// An empty directory has to marshal as `[]` and not as `null`, because the
	// frontend iterates the result without checking it.
	entries := make([]FsDirEntry, 0, len(listing))

	for _, entry := range listing {
		/*
		 * `Type` is filled from the directory record, and from an lstat when
		 * the platform leaves that record untyped. Either way nothing follows
		 * the link, which is what the plugin reports.
		 */
		kind := entry.Type()

		entries = append(entries, FsDirEntry{
			Name:        entry.Name(),
			IsDirectory: kind.IsDir(),
			IsFile:      kind.IsRegular(),
			IsSymlink:   kind&os.ModeSymlink != 0,
		})
	}

	return entries, nil
}

// Remove is the counterpart of `plugin:fs|remove`.
func (f *FilesystemService) Remove(path string, recursive bool) error {
	var err error

	if recursive {
		err = os.RemoveAll(path)
	} else {
		err = os.Remove(path)
	}

	if err != nil {
		return fmt.Errorf("failed to remove %s: %w", path, fsCause(err))
	}

	return nil
}

// Rename is the counterpart of `plugin:fs|rename`. An existing destination is
// replaced, matching `std::fs::rename` on both Windows and Unix.
func (f *FilesystemService) Rename(oldPath string, newPath string) error {
	if err := os.Rename(oldPath, newPath); err != nil {
		return fmt.Errorf("failed to rename %s to %s: %w", oldPath, newPath, fsCause(err))
	}

	return nil
}

// Stat is the counterpart of `plugin:fs|stat` and follows symlinks, so
// `isSymlink` is necessarily false: the metadata describes the target.
func (f *FilesystemService) Stat(path string) (FsFileInfo, error) {
	info, err := os.Stat(path)

	if err != nil {
		return FsFileInfo{}, fmt.Errorf("failed to get metadata of %s: %w", path, fsCause(err))
	}

	return fsFileInfoFrom(info), nil
}

// Lstat is the counterpart of `plugin:fs|lstat` and describes the link itself.
func (f *FilesystemService) Lstat(path string) (FsFileInfo, error) {
	info, err := os.Lstat(path)

	if err != nil {
		return FsFileInfo{}, fmt.Errorf("failed to get metadata of %s: %w", path, fsCause(err))
	}

	return fsFileInfoFrom(info), nil
}

/*
 * Size is the counterpart of `plugin:fs|size`.
 *
 * A file answers with its own length, a directory with the recursive total of
 * everything underneath it - the plugin walks the tree and so does the browser
 * replica, and callers use this to report how much disk an instance takes.
 */
func (f *FilesystemService) Size(path string) (int64, error) {
	info, err := os.Stat(path)

	if err != nil {
		return 0, fmt.Errorf("failed to measure %s: %w", path, fsCause(err))
	}

	if !info.IsDir() {
		return info.Size(), nil
	}

	total, err := fsDirectorySize(path)

	if err != nil {
		return 0, fmt.Errorf("failed to measure %s: %w", path, fsCause(err))
	}

	return total, nil
}

/*
 * fsDirectorySize adds up every regular file underneath root.
 *
 * Only regular files count: directories would add their own bookkeeping blocks
 * to the total, and links are skipped so that a link pointing back up the tree
 * cannot double-count (or loop - WalkDir never descends into one).
 */
func fsDirectorySize(root string) (int64, error) {
	var total int64

	err := filepath.WalkDir(root, func(_ string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !entry.Type().IsRegular() {
			return nil
		}

		info, err := entry.Info()

		if err != nil {
			// A download or an extraction running in parallel may have moved
			// the entry between the listing and this stat.
			if errors.Is(err, os.ErrNotExist) {
				return nil
			}

			return err
		}

		total += info.Size()

		return nil
	})

	if err != nil {
		return 0, err
	}

	return total, nil
}

// fsFileInfoFrom translates Go's portable metadata into the plugin's shape.
func fsFileInfoFrom(info os.FileInfo) FsFileInfo {
	mode := info.Mode()

	details := FsFileInfo{
		IsFile:      mode.IsRegular(),
		IsDirectory: mode.IsDir(),
		IsSymlink:   mode&os.ModeSymlink != 0,
		Size:        info.Size(),
		Mtime:       fsEpochMilliseconds(info.ModTime()),
		Readonly:    mode.Perm()&fsWriteBit == 0,
	}

	/*
	 * Go's FileMode is not st_mode: its type bits live in different places, so
	 * only the permission bits can be handed over as a Unix mode. Windows has
	 * none to hand over - Go synthesises 0666/0444 there - so the field stays
	 * null, just as the Rust plugin leaves it null off Unix.
	 */
	if runtime.GOOS != "windows" {
		permissions := uint32(mode.Perm())
		details.Mode = &permissions
	}

	return details
}

// fsEpochMilliseconds renders a timestamp for `new Date(value)`. A zero time
// means the platform reported nothing, and that has to stay null.
func fsEpochMilliseconds(moment time.Time) *int64 {
	if moment.IsZero() {
		return nil
	}

	milliseconds := moment.UnixMilli()

	return &milliseconds
}

/*
 * fsCause unwraps the operation and path that `os` wraps around every syscall
 * failure. Without it messages repeat themselves ("failed to read C:\a: open
 * C:\a: ..."), while `errors.Is(err, os.ErrNotExist)` keeps working because the
 * cause is still wrapped with %w by the caller.
 */
func fsCause(err error) error {
	var pathError *os.PathError

	if errors.As(err, &pathError) {
		return pathError.Err
	}

	var linkError *os.LinkError

	if errors.As(err, &linkError) {
		return linkError.Err
	}

	return err
}
