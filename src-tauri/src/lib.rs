use tauri::Manager;
use log::error;

mod finalization;
mod launcher;
mod system;
mod zip;

// Launcher name
const APP_NAME: &str = "kaede";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // If user tries to open the launcher when it is already opened,
            // then focus the already opened window.
            let _ = app
                .get_webview_window("main")
                .expect("no main window found - tauri single instance plugin")
                .set_focus();
        }))
        .plugin(tauri_plugin_shellx::init(true))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // Just so you know:
            //
            // Initially, checking whether the application is in a portable mode or not
            // was made by reading the window label to find a 'Portable' string
            //
            // Those chained calls took only '225.60µs' on my laptop though,
            // not as slow as I thought at first.
            //
            // Nevertheless, I was enlightened by Prism Launcher
            // which uses 'portable.txt' to make the launcher portable
            let portable = launcher::is_portable();

            let mut path;

            if portable {
                // Resolves to the launcher executable file directory
                path = std::env::current_exe().unwrap().parent().unwrap().to_path_buf();
            } else {
                // Resolves to '${dataDir}/${bundleIdentifier}'
                path = app.path().app_data_dir()?;
            }

            path.push("logs");

            // Creates the 'logs' directory if it doesn't exist
            let _ = std::fs::create_dir_all(&path)?;

            // Prepare the log file.
            //
            // Rewriting this from TypeScript to Rust lead to way faster code execution:
            // (Note: 906 files in the 'logs' directory)
            // - TypeScript took 80 ms on average.
            // - Rust       took  3 ms on average (holy fuck).
            //
            // Do not blame JavaScript though, because Tauri API
            // is time-wise expensive to invoke from JavaScript.
            // 90% of the time JavaScript seemed to just wait for Tauri commands resolving.
            //
            // Also:
            // The logging plugin locks the 'latest.log' file once it initializes,
            // so deleting that file while application is still working will lead to errors.
            //
            // Clearly, at this point of code Tauri logging plugin has NOT been loaded yet.
            // This information means that the log file can be manipulated in any way.
            //
            // But in JavaScript, the logging plugin has already been loaded.
            // Thus, the logging preparation strategy provided below will fail,
            // requiring the JavaScript code to copy the contents from the log file into another
            // instead of just renaming that file. Of course, copying takes more time.
            if let Err(error) = launcher::prepare_log_file(&path, APP_NAME) {
                error!("Failed to prepare the log file: {}", error);
            }

            // Handle logging targets differently based on build mode
            let logging_builder = if cfg!(debug_assertions) {
                // Debug mode
                tauri_plugin_log::Builder::default()
            } else {
                // Release mode
                // Clear any default output targets, such as 'stdout', etc.
                tauri_plugin_log::Builder::new().clear_targets()
            };

            app.handle().plugin(
                logging_builder
                    // Make a new output target that will save logs in a log file
                    .target(tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::Folder {
                            path: path,
                            file_name: Some(format!("latest")),
                        },
                    ))
                    // Make a custom logs format
                    .format(|out, message, record| {
                        let now = time::OffsetDateTime::now_utc();
                        // Default tauri logging format does not include milliseconds
                        let formatted_time = format!("{:02}:{:02}:{:02}.{:03}",
                            now.hour(), now.minute(), now.second(), now.millisecond());

                        out.finish(format_args!(
                            "{} | {} | {} | {}",
                            formatted_time,
                            record.level(),
                            record.target(),
                            message,
                        ))
                    })
                    // Keep the log file size at 8 MB
                    .max_file_size(8_388_608)
                    // Keep the recent log lines if the file size exceeds 8 MBs
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                    .build(),
            )?;

            Ok(())
        })
        // Register custom Tauri commands
        .invoke_handler(tauri::generate_handler![
            finalization::finalize_initialization,
            finalization::get_java_major,
            launcher::get_initial_state,
            launcher::get_missing_files,
            launcher::verify_file_paths,
            system::get_system_memory,
            system::get_cpu_usage,
            zip::unzip_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
