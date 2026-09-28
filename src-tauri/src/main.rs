fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Initialize library module (SQLite + legacy import) on startup
    if let Ok(()) = library::init() {
      // Library initialized successfully - data is now in SQLite
    }
}