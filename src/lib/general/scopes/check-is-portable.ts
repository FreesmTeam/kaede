import { invoke } from "@tauri-apps/api/core";

export async function checkIsPortable(): Promise<boolean> {
  try {
    return await invoke("is_portable");
  } catch {
    return false;
  }
}