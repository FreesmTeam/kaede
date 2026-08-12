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
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
)

/*
 * Thin wrappers over the Wails native surface.
 *
 * Everything that touches `pkg/application` lives in main.go, wire.go and this
 * file. Service files stay pure Go, which keeps them portable and lets them be
 * type-checked for every target rather than only the one Wails can build here.
 */

// errNoApplication is returned when a native call happens before startup.
var errNoApplication = errors.New("the application is not running")

// newMessageDialog picks the dialog flavour matching a Tauri dialog "kind".
func newMessageDialog(app *application.App, kind string) *application.MessageDialog {
	switch kind {
	case "error":
		return app.Dialog.Error()
	case "warning":
		return app.Dialog.Warning()
	case "question":
		return app.Dialog.Question()
	default:
		return app.Dialog.Info()
	}
}

// nativeMessageDialog is the counterpart of `plugin:dialog|message`.
func nativeMessageDialog(kind string, title string, message string) error {
	app := currentApplication()

	if app == nil {
		return errNoApplication
	}

	dialog := newMessageDialog(app, kind).SetTitle(title).SetMessage(message)
	dialog.AddButton("OK").SetAsDefault()
	dialog.Show()

	return nil
}

/*
 * nativeConfirmDialog is the counterpart of `plugin:dialog|confirm` and
 * `plugin:dialog|ask`. Wails reports the choice through button callbacks that
 * fire while the modal is up, so the result is collected in a buffered channel
 * and read without blocking once the dialog has been dismissed.
 */
func nativeConfirmDialog(kind string, title string, message string, okLabel string, cancelLabel string) (bool, error) {
	app := currentApplication()

	if app == nil {
		return false, errNoApplication
	}

	answers := make(chan bool, 1)
	dialog := newMessageDialog(app, kind).SetTitle(title).SetMessage(message)

	dialog.AddButton(okLabel).OnClick(func() {
		answers <- true
	}).SetAsDefault()

	dialog.AddButton(cancelLabel).OnClick(func() {
		answers <- false
	}).SetAsCancel()

	dialog.Show()

	select {
	case confirmed := <-answers:
		return confirmed, nil
	default:
		// The modal was dismissed without a button, which counts as a refusal.
		return false, nil
	}
}

// nativeOpenFileDialog is the counterpart of `plugin:dialog|open`.
func nativeOpenFileDialog(
	title string,
	directory string,
	multiple bool,
	directories bool,
	filters map[string]string,
) ([]string, error) {
	app := currentApplication()

	if app == nil {
		return nil, errNoApplication
	}

	dialog := app.Dialog.OpenFile().
		CanChooseFiles(!directories).
		CanChooseDirectories(directories).
		ShowHiddenFiles(true)

	if title != "" {
		dialog.SetTitle(title)
	}

	if directory != "" {
		dialog.SetDirectory(directory)
	}

	for displayName, pattern := range filters {
		dialog.AddFilter(displayName, pattern)
	}

	if multiple {
		return dialog.PromptForMultipleSelection()
	}

	selection, err := dialog.PromptForSingleSelection()

	if err != nil {
		return nil, err
	}

	if selection == "" {
		return nil, nil
	}

	return []string{selection}, nil
}

// nativeClipboardWriteText is the counterpart of
// `plugin:clipboard-manager|write_text`.
func nativeClipboardWriteText(text string) error {
	app := currentApplication()

	if app == nil {
		return errNoApplication
	}

	if !app.Clipboard.SetText(text) {
		return errors.New("failed to write to the clipboard")
	}

	return nil
}

// nativeOpenURL is the counterpart of `plugin:opener|open_url`.
func nativeOpenURL(url string) error {
	app := currentApplication()

	if app == nil {
		return errNoApplication
	}

	return app.Browser.OpenURL(url)
}

// nativeOpenPath asks the desktop environment to open a file or a directory.
// It backs `plugin:opener|reveal_item_in_dir`.
func nativeOpenPath(path string) error {
	app := currentApplication()

	if app == nil {
		return errNoApplication
	}

	return app.Browser.OpenFile(path)
}

// nativeShowMainWindow is the counterpart of `plugin:window|show`. The window
// is created hidden, exactly like the Tauri build, and the frontend reveals it
// once initialization has finished.
func nativeShowMainWindow() error {
	app := currentApplication()

	if app == nil {
		return errNoApplication
	}

	window, found := app.Window.Get(windowLabel)

	if !found {
		return errors.New("the main window does not exist")
	}

	window.Show()

	return nil
}
