fn main() {
    let attributes = tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new()
            .commands(&["bootstrap_capability_broker", "capability_call"]),
    );
    tauri_build::try_build(attributes).expect("failed to build Tauri application manifest");
}
