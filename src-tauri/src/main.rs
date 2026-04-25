// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use simplelog::{CombinedLogger, Config, LevelFilter, WriteLogger};
use std::fs::{create_dir_all, OpenOptions};
use std::path::PathBuf;

fn get_home_dir() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn init_file_logger() {
    let log_dir = get_home_dir().join(".openclaw").join("app-logs");
    if create_dir_all(&log_dir).is_err() {
        return;
    }

    let log_file_path = log_dir.join("app.log");
    let Ok(log_file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
    else {
        return;
    };

    let _ = CombinedLogger::init(vec![WriteLogger::new(
        LevelFilter::Info,
        Config::default(),
        log_file,
    )]);
}

fn main() {
    init_file_logger();
    info!("OpenClaw Manager 启动");
    tauri_app_lib::run()
}
