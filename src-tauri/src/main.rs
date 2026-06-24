#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Rust 二进制入口，委托库入口启动 Tauri 应用。
fn main() {
    monthly_salary_cat_lib::run()
}
