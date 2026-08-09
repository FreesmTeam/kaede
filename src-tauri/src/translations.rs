use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio::task::JoinSet;

#[derive(Serialize)]
pub struct ItemInfo {
    pub code: String,
    pub name: String,
}

// Translations have the following structure.
// - Info
//   - Code (the language code, e.g., ru)
//   - Name (the language label, e.g., Русский)
//   - ...
// - Messages
//   - ...
#[derive(Deserialize)]
struct JsonFile {
    #[serde(rename = "Info")]
    info: Option<JsonFileInfo>,
}

#[derive(Deserialize)]
struct JsonFileInfo {
    #[serde(rename = "Code")]
    code: Option<String>,
    #[serde(rename = "Name")]
    name: Option<String>,
}

#[tauri::command]
pub async fn get_locales(directory: String) -> Result<Vec<ItemInfo>, String> {
    let mut entries = fs::read_dir(&directory)
        .await
        .map_err(|e| format!("Failed to read directory '{}': {}", directory, e))?;

    let mut file_paths = Vec::new();

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read directory entry: {}", e))?
    {
        let is_file = entry
            .file_type()
            .await
            .map(|ft| ft.is_file())
            .unwrap_or(false);

        if !is_file {
            continue;
        }

        let path = entry.path();

        let is_json = path
            .extension()
            .map(|ext| ext.eq_ignore_ascii_case("json"))
            .unwrap_or(false);

        if !is_json {
            continue;
        }

        file_paths.push(path);
    }

    let expected_capacity = file_paths.len();

    let mut set = JoinSet::new();

    for path in file_paths {
        set.spawn(async move {
            let content = fs::read_to_string(&path).await.ok()?;

            let parsed: JsonFile = serde_json::from_str(&content).ok()?;

            let info = parsed.info?;
            let code = info.code?;
            let name = info.name?;

            Some(ItemInfo { code, name })
        });
    }

    let mut items = Vec::with_capacity(expected_capacity);

    while let Some(res) = set.join_next().await {
        if let Ok(Some(item)) = res {
            items.push(item);
        }
    }

    Ok(items)
}
