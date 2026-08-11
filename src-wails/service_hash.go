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
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"os"
)

/*
 * HashService is the counterpart of `hashes.rs`.
 *
 * `hash_sha256` and `hash_md5` were raw-body commands: they read the IPC body
 * through `tauri::ipc::Request` and rejected a JSON payload outright. Wails has
 * no raw-body IPC, so the bytes arrive as base64 instead and a malformed
 * payload surfaces as a decoding error rather than as the plugin's
 * "Expected a raw bytes payload" string.
 */
type HashService struct{}

/*
 * hashBufferSize matches the 64 KiB window the Rust implementation streamed
 * through. Minecraft client jars and native archives run through here, and none
 * of them should ever be resident in memory just to be hashed.
 */
const hashBufferSize = 64 * 1024

// Sha256 is the counterpart of `hash_sha256`, over a base64 payload.
func (h *HashService) Sha256(contents string) (string, error) {
	decoded, err := decodeBytes(contents)

	if err != nil {
		return "", fmt.Errorf("failed to decode the contents to hash: %w", err)
	}

	digest := sha256.Sum256(decoded)

	return hex.EncodeToString(digest[:]), nil
}

// Md5 is the counterpart of `hash_md5`, over a base64 payload. Nothing security
// related depends on it: it only derives offline UUIDs from a nickname.
func (h *HashService) Md5(contents string) (string, error) {
	decoded, err := decodeBytes(contents)

	if err != nil {
		return "", fmt.Errorf("failed to decode the contents to hash: %w", err)
	}

	digest := md5.Sum(decoded)

	return hex.EncodeToString(digest[:]), nil
}

// Sha1File is the counterpart of `hash_sha1_file`. It exists so that generated
// patches can carry the true SHA-1 of an artifact that is already on disk.
func (h *HashService) Sha1File(path string) (string, error) {
	return hashStreamFile(path, sha1.New())
}

/*
 * hashStreamFile feeds a file through digest in 64 KiB reads and returns the
 * lowercase hex sum, mirroring Rust's `sha1_file` loop. The read loop is
 * written out instead of using io.Copy because `*os.File` implements WriteTo,
 * which would quietly substitute its own buffer for this one.
 */
func hashStreamFile(path string, digest hash.Hash) (string, error) {
	file, err := os.Open(path)

	if err != nil {
		return "", fmt.Errorf("failed to hash %s: %w", path, hashCause(err))
	}

	defer file.Close()

	buffer := make([]byte, hashBufferSize)

	for {
		read, err := file.Read(buffer)

		if read > 0 {
			// hash.Hash never fails to absorb a write, by contract.
			digest.Write(buffer[:read])
		}

		if err == io.EOF {
			break
		}

		if err != nil {
			return "", fmt.Errorf("failed to hash %s: %w", path, hashCause(err))
		}
	}

	return hex.EncodeToString(digest.Sum(nil)), nil
}

// hashCause drops the operation and path that `os` prefixes onto syscall
// failures, so the message names the file once.
func hashCause(err error) error {
	var pathError *os.PathError

	if errors.As(err, &pathError) {
		return pathError.Err
	}

	return err
}
