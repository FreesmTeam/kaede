use std::sync::Mutex;
use sysinfo::System;

static SYS_CPU: Mutex<Option<System>> = Mutex::new(None);

#[tauri::command]
pub fn get_system_memory() -> (u64, u64) {
    let mut sys = System::new();

    sys.refresh_memory();

    let used_memory = sys.used_memory();
    let total_memory = sys.total_memory();

    return (used_memory, total_memory);
}

#[tauri::command]
pub fn get_cpu_usage() -> f32 {
    let mut guard = SYS_CPU.lock().unwrap();

    let lazy_sys = guard.get_or_insert_with(|| {
        let mut refreshed_sys = System::new();

        refreshed_sys.refresh_cpu_usage();
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);

        refreshed_sys
    });

    lazy_sys.refresh_cpu_usage();
    lazy_sys.global_cpu_usage()
}
