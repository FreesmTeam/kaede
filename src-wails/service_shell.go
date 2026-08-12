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
	"bytes"
	"errors"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

/*
 * ShellService gathers the plugin endpoints that ask the desktop for something:
 * `plugin:dialog|message`, `plugin:dialog|confirm`, `plugin:dialog|ask`,
 * `plugin:dialog|open`, `plugin:opener|open_url`,
 * `plugin:opener|reveal_item_in_dir`, `plugin:clipboard-manager|write_text`,
 * `plugin:window|show` and `plugin:shellx|execute`.
 *
 * Everything native goes through the `native*` helpers, so this file stays
 * portable: only `RevealItemInDir` and `Execute` reach the operating system, and
 * they do it with `os/exec` rather than with a platform API.
 */
type ShellService struct{}

// ShellExecuteStatus is the exit status of `plugin:shellx|execute`. Both numbers
// are nullable, because a process that a signal killed has no exit code and one
// that exited normally has no signal.
type ShellExecuteStatus struct {
	Code    *int `json:"code"`
	Signal  *int `json:"signal"`
	Success bool `json:"success"`
}

// ShellExecuteResult is what `plugin:shellx|execute` resolves with.
type ShellExecuteResult struct {
	Status ShellExecuteStatus `json:"status"`
	Stdout string             `json:"stdout"`
	Stderr string             `json:"stderr"`
}

// Message is the counterpart of `plugin:dialog|message`.
func (s *ShellService) Message(title string, message string, kind string) error {
	return nativeMessageDialog(kind, title, message)
}

// Confirm is the counterpart of `plugin:dialog|confirm` and
// `plugin:dialog|ask`, which differ only in the labels the frontend passes.
func (s *ShellService) Confirm(
	title string,
	message string,
	kind string,
	okLabel string,
	cancelLabel string,
) (bool, error) {
	return nativeConfirmDialog(kind, title, message, okLabel, cancelLabel)
}

/*
 * PickFiles is the counterpart of `plugin:dialog|open`.
 *
 * `filters` maps a display name onto a pattern, the shape the Wails dialog
 * expects. Nothing picked comes back as no paths at all, which is the `null`
 * the plugin resolved with when the user dismissed the dialog.
 */
func (s *ShellService) PickFiles(
	title string,
	directory string,
	multiple bool,
	directories bool,
	filters map[string]string,
) ([]string, error) {
	return nativeOpenFileDialog(title, directory, multiple, directories, filters)
}

// OpenURL is the counterpart of `plugin:opener|open_url`.
func (s *ShellService) OpenURL(url string) error {
	return nativeOpenURL(url)
}

/*
 * RevealItemInDir is the counterpart of `plugin:opener|reveal_item_in_dir`.
 *
 * Tauri called a platform API that both opens the file manager and selects the
 * item. There is no portable equivalent, so the item is revealed by the file
 * managers that accept it on the command line and the containing directory is
 * opened everywhere else — the user still lands where the launcher meant to
 * send them, just without the selection.
 */
func (s *ShellService) RevealItemInDir(path string) error {
	if path == "" {
		return errors.New("there is no path to reveal")
	}

	absolute, err := filepath.Abs(path)

	if err != nil {
		// A path the operating system cannot resolve is still worth trying as it
		// was given.
		absolute = path
	}

	if command := shellRevealCommand(absolute); command != nil {
		if err := shellStartDetached(command); err == nil {
			return nil
		}
	}

	parent := filepath.Dir(absolute)

	if parent == "" {
		parent = absolute
	}

	return nativeOpenPath(parent)
}

// WriteClipboardText is the counterpart of
// `plugin:clipboard-manager|write_text`.
func (s *ShellService) WriteClipboardText(text string) error {
	return nativeClipboardWriteText(text)
}

// ShowWindow is the counterpart of `plugin:window|show`. The window starts
// hidden, and the frontend reveals it once it has finished initialising.
func (s *ShellService) ShowWindow() error {
	return nativeShowMainWindow()
}

/*
 * Execute is the counterpart of `plugin:shellx|execute`: it runs a program to
 * completion and reports its output.
 *
 * A program that could not be started rejects, because that is a mistake in the
 * call rather than a result of it. A program that ran and failed resolves with
 * `success: false`, which is what the frontend inspects.
 */
func (s *ShellService) Execute(program string, args []string) (ShellExecuteResult, error) {
	if program == "" {
		return ShellExecuteResult{}, errors.New("there is no program to execute")
	}

	var stdout, stderr bytes.Buffer

	command := exec.Command(program, args...)
	command.Stdout = &stdout
	command.Stderr = &stderr

	err := command.Run()

	var exitErr *exec.ExitError

	if err != nil && !errors.As(err, &exitErr) {
		return ShellExecuteResult{}, err
	}

	result := ShellExecuteResult{
		Status: ShellExecuteStatus{Success: err == nil},
		Stdout: stdout.String(),
		Stderr: stderr.String(),
	}

	/*
	 * A process that a signal killed reports -1 here, and the signal number
	 * itself is only reachable through `syscall.WaitStatus`, which differs per
	 * platform. `signal` therefore stays null, exactly as it is in the browser
	 * replica, and the frontend keeps reading `code` and `success`.
	 */
	if code := command.ProcessState.ExitCode(); code >= 0 {
		result.Status.Code = &code
	}

	return result, nil
}

/*
 * shellRevealCommand builds the command that reveals an item, or nil where no
 * such command exists.
 *
 * On Linux that is every desktop: selecting an item means talking to the file
 * manager over D-Bus, and the parent directory is the honest fallback.
 */
func shellRevealCommand(path string) *exec.Cmd {
	switch runtime.GOOS {
	case "windows":
		/*
		 * Explorer wants the switch and the path glued into one argument. Go
		 * escapes every argument it passes, and it only adds quotes when one
		 * contains a space or a tab — which here would wrap the switch as well
		 * and leave Explorer with something it does not parse. Avoiding that
		 * needs a raw command line, which is a Windows-only field this build
		 * cannot reach, so such paths fall back to their parent directory.
		 */
		if strings.ContainsAny(path, " \t\"") {
			return nil
		}

		return exec.Command("explorer.exe", "/select,"+path)
	case "darwin":
		return exec.Command("open", "-R", path)
	default:
		return nil
	}
}

/*
 * shellStartDetached starts a command and reaps it in the background.
 *
 * Only the start is reported: Explorer exits with 1 even when it has done what
 * it was asked, so waiting for the status would send every successful reveal
 * down the fallback path and open a second window.
 */
func shellStartDetached(command *exec.Cmd) error {
	if err := command.Start(); err != nil {
		return err
	}

	go func() {
		_ = command.Wait()
	}()

	return nil
}
