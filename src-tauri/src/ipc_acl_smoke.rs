use crate::plugin_broker::{BrokerState, commands};
use serde_json::{Value, json};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{INVOKE_KEY, MockRuntime, get_ipc_response};
use tauri::webview::InvokeRequest;
use tauri::{WebviewWindow, WebviewWindowBuilder};

fn invoke(
    webview: &WebviewWindow<MockRuntime>,
    command: &str,
    body: Value,
) -> Result<Value, Value> {
    get_ipc_response(
        webview,
        InvokeRequest {
            cmd: command.to_owned(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: if cfg!(any(windows, target_os = "android")) {
                "http://tauri.localhost"
            } else {
                "tauri://localhost"
            }
            .parse()
            .expect("test invoke URL should be valid"),
            body: InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_owned(),
        },
    )
    .map(|response| {
        response
            .deserialize()
            .expect("IPC success response should be JSON")
    })
}

fn assert_acl_denied(
    webview: &WebviewWindow<MockRuntime>,
    command: &str,
    body: Value,
    diagnostic_name: &str,
) {
    let error = match invoke(webview, command, body) {
        Ok(response) => panic!("{command} unexpectedly succeeded: {response}"),
        Err(error) => error,
    };
    let message = error
        .as_str()
        .unwrap_or_else(|| panic!("{command} returned a non-ACL error shape: {error}"));
    assert!(
        message.contains("not allowed") && message.contains(diagnostic_name),
        "{command} should fail in RuntimeAuthority before deserialization/dispatch; actual response: {error}"
    );
}

#[test]
fn obtained_main_window_is_confined_to_broker_acl() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock should be after the Unix epoch")
        .as_nanos();
    let decisions_path = std::env::temp_dir()
        .join(format!("kaede-tauri-acl-{}-{nonce}", std::process::id()))
        .join("capability-decisions.json");
    let nonexistent_path = decisions_path.with_file_name("does-not-exist");
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_shellx::init(false))
        .manage(BrokerState::new(decisions_path).expect("broker state should initialize"))
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap_capability_broker,
            commands::capability_call,
        ])
        .build(tauri::generate_context!())
        .expect("mock Tauri application should build from the production context");
    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("main test webview should build");

    let denied_commands = [
        (
            "plugin:fs|read_text_file",
            json!({ "path": nonexistent_path }),
            "fs.read_text_file",
        ),
        (
            "plugin:shellx|execute",
            json!({
                "program": "__kaede_acl_smoke_nonexistent_program__",
                "args": [],
                "options": {}
            }),
            "shellx.execute",
        ),
        (
            "plugin:process|exit",
            json!({ "code": "not-an-integer" }),
            "process.exit",
        ),
        (
            "get_launched_state",
            json!({ "invalid": true }),
            "get_launched_state",
        ),
        (
            "get_executable_directory",
            json!({ "invalid": true }),
            "get_executable_directory",
        ),
        (
            "get_missing_files",
            json!({ "paths": "not-an-array" }),
            "get_missing_files",
        ),
        (
            "verify_file_paths",
            json!({ "paths": "not-an-array" }),
            "verify_file_paths",
        ),
        (
            "get_system_memory",
            json!({ "invalid": true }),
            "get_system_memory",
        ),
        ("hash_md5", json!([0, 1, 2]), "hash_md5"),
        ("hash_sha256", json!([0, 1, 2]), "hash_sha256"),
        (
            "get_process_memory",
            json!({ "invalid": true }),
            "get_process_memory",
        ),
        (
            "unzip_file",
            json!({ "archive": null, "targetDirectory": null }),
            "unzip_file",
        ),
        (
            "concurrently_download",
            json!({ "entries": [], "concurrency": 1, "label": "test", "cancelId": "test" }),
            "concurrently_download",
        ),
        (
            "cancel_downloads",
            json!({ "cancelId": "test" }),
            "cancel_downloads",
        ),
        ("stream_logs", json!({}), "stream_logs"),
        ("stop_log_stream", json!({}), "stop_log_stream"),
    ];
    for (command, body, diagnostic_name) in denied_commands {
        assert_acl_denied(&webview, command, body, diagnostic_name);
    }

    let bootstrap = invoke(&webview, "bootstrap_capability_broker", json!({}))
        .unwrap_or_else(|error| panic!("broker bootstrap should execute successfully: {error}"));
    let session = bootstrap
        .get("session")
        .and_then(Value::as_str)
        .filter(|session| !session.is_empty())
        .unwrap_or_else(|| panic!("bootstrap should return a non-empty session: {bootstrap}"))
        .to_owned();
    assert!(
        bootstrap.get("generation").is_some_and(Value::is_u64),
        "bootstrap should return a numeric generation: {bootstrap}"
    );

    let snapshot = invoke(
        &webview,
        "capability_call",
        json!({
            "session": session,
            "request": { "kind": "host_runtime_snapshot" }
        }),
    )
    .unwrap_or_else(|error| panic!("host runtime snapshot should execute: {error}"));
    assert_eq!(
        snapshot.get("kind"),
        Some(&json!("runtime_snapshot")),
        "capability call should return a runtime snapshot: {snapshot}"
    );
    assert_eq!(
        snapshot.get("runtimeKind"),
        Some(&json!("desktop")),
        "runtime snapshot should identify the desktop runtime: {snapshot}"
    );

    let second_bootstrap = invoke(&webview, "bootstrap_capability_broker", json!({}))
        .expect_err("a second bootstrap on the same page must be denied");
    assert_eq!(
        second_bootstrap,
        json!({
            "kind": "unauthorized",
            "message": "host was already bootstrapped"
        }),
        "second bootstrap should surface HostAlreadyBootstrapped"
    );
}
