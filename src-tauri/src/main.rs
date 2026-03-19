// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{OpenOptions, create_dir_all};
use std::io::Write;
use std::path::PathBuf;
use simplelog::{CombinedLogger, WriteLogger, LevelFilter, Config, TerminalMode};
use log::{info, error, warn};

fn main() {
    // 初始化日志系统
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/fan".to_string());
    let log_dir = PathBuf::from(format!("{}/.openclaw/app-logs", home));
    let _ = create_dir_all(&log_dir);
    
    let log_file_path = log_dir.join("app.log");
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
        .expect("Failed to open log file");
    
    let _ = CombinedLogger::init(vec![
        WriteLogger::new(LevelFilter::Info, Config::default(), log_file),
    ]);
    
    info!("OpenClaw Manager 启动");
    
    tauri_app_lib::run()
}
