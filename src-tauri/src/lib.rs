use log::error;
use tauri::{Manager, webview::PageLoadEvent};

mod downloads;
mod extensions;
mod finalization;
mod hashes;
#[cfg(test)]
mod ipc_acl_smoke;
mod launcher;
mod plugin_broker;
mod zip;

// Launcher name
const APP_NAME: &str = "kaede";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // If user tries to open the launcher when it is already opened,
            // then focus the already opened window.
            let _ = app
                .get_webview_window("main")
                .expect("no main window found - tauri single instance plugin")
                .set_focus();
        }))
        .plugin(tauri_plugin_shellx::init(false))
        .plugin(tauri_plugin_dialog::init())
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Started {
                plugin_broker::reset_for_page_load(webview);
            }
        })
        .setup(|app| {
            let runtime_paths =
                launcher::select_runtime_paths(app.handle()).map_err(std::io::Error::other)?;
            let main_window = app.get_webview_window("main").ok_or_else(|| {
                std::io::Error::other("main window is not available during setup")
            })?;
            main_window.set_title(launcher::window_title(&runtime_paths))?;
            let path = runtime_paths.base_directory.join("logs");
            app.manage(plugin_broker::BrokerState::new_for_runtime(runtime_paths)?);

            // Creates the 'logs' directory if it doesn't exist
            std::fs::create_dir_all(&path)?;

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
                error!("Failed to prepare the log file: {error}");
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
                    // Do not log connection setup noise from the HTTP client.
                    .filter(|metadata| metadata.target() != "reqwest::connect")
                    // Do not persist trace-level dependency logs.
                    .level(log::LevelFilter::Debug)
                    // Make a new output target that will save logs in a log file
                    .target(tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::Folder {
                            path,
                            file_name: Some("latest".to_owned()),
                        },
                    ))
                    // Make a custom logs format
                    .format(|out, message, record| {
                        let now = time::OffsetDateTime::now_utc();
                        // Default tauri logging format does not include milliseconds
                        let formatted_time = format!(
                            "{:02}:{:02}:{:02}.{:03}",
                            now.hour(),
                            now.minute(),
                            now.second(),
                            now.millisecond()
                        );

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
            plugin_broker::commands::bootstrap_capability_broker,
            plugin_broker::commands::capability_call,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
