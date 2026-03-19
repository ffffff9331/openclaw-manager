use serde::{Deserialize, Serialize};
use std::process::Command;
use std::env;
use std::path::PathBuf;
use std::fs::{OpenOptions, create_dir_all, read_to_string};
use std::io::Write;
use simplelog::{CombinedLogger, WriteLogger, LevelFilter, Config};
use log::{info, error, warn};

// 获取日志目录
fn get_log_dir() -> PathBuf {
    let home = env::var("HOME").unwrap_or_else(|_| "/Users/fan".to_string());
    let log_dir = PathBuf::from(format!("{}/.openclaw/app-logs", home));
    let _ = create_dir_all(&log_dir);
    log_dir
}

// 获取默认工作目录（用户主目录）
fn get_default_dir() -> PathBuf {
    env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            // 回退：尝试从 /Users 目录下的用户名推断
            if let Ok(entries) = std::fs::read_dir("/Users") {
                for entry in entries.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                        if name != "Shared" && name != "Guest" {
                            return PathBuf::from(format!("/Users/{}", name));
                        }
                    }
                }
            }
            PathBuf::from("/Users/fan")  // 最终回退
        })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub uptime: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

// 调试用：返回 PATH
#[tauri::command]
fn get_env() -> String {
    format!("PATH={}\nHOME={}", 
        env::var("PATH").unwrap_or_default(),
        env::var("HOME").unwrap_or_default())
}

// 执行 shell 命令
#[tauri::command]
fn run_command(command: String) -> CommandResult {
    // 调试：如果命令是 DEBUG_PATH，返回 PATH
    if command == "DEBUG_PATH" {
        return CommandResult {
            success: true,
            output: format!("PATH={}\nHOME={}", 
                env::var("PATH").unwrap_or_default(),
                env::var("HOME").unwrap_or_default()),
            error: None,
        };
    }

    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return CommandResult {
            success: false,
            output: String::new(),
            error: Some("Empty command".to_string()),
        };
    }

    // 动态获取用户 PATH，不遗漏任何 npm/bun/volta 安装的全局命令
    let home_dir = env::var("HOME").unwrap_or_else(|_| "/Users/fan".to_string());
    let full_path = env::var("PATH").unwrap_or_else(|_| {
        format!(
            "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:{}:{}:{}/.npm-global/bin:{}/.local/bin",
            home_dir,
            format!("{}/bin", home_dir),
            home_dir,
            home_dir
        )
    });
    
    let output = if cfg!(target_os = "macos") || cfg!(target_os = "linux") {
        Command::new("zsh")
            .args(["-c", &command])
            .current_dir(&home_dir)
            .env("PATH", full_path)
            .output()
    } else {
        Command::new("cmd")
            .args(["/C", &command])
            .output()
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            
            // 记录命令执行日志
            if out.status.success() {
                info!("CMD OK: {}", &command[..command.len().min(100)]);
            } else {
                warn!("CMD FAIL: {} - {}", &command[..command.len().min(100)], stderr.chars().take(100).collect::<String>());
            }
            
            if out.status.success() {
                CommandResult {
                    success: true,
                    output: stdout,
                    error: if stderr.is_empty() { None } else { Some(stderr) },
                }
            } else {
                CommandResult {
                    success: false,
                    output: stdout,
                    error: Some(stderr),
                }
            }
        }
        Err(e) => CommandResult {
            success: false,
            output: String::new(),
            error: Some(e.to_string()),
        },
    }
}

// 获取 Gateway 状态
#[tauri::command]
fn get_gateway_status() -> GatewayStatus {
    // 检查 Gateway 进程是否运行
    let check_cmd = if cfg!(target_os = "macos") {
        "pgrep -f 'openclaw gateway' | head -1"
    } else {
        "tasklist | findstr gateway"
    };

    let output = Command::new("zsh")
        .args(["-c", check_cmd])
        .current_dir(get_default_dir())
        .output();

    let running = match output {
        Ok(out) => !out.stdout.is_empty(),
        Err(_) => false,
    };

    if running {
        // 获取端口和 PID
        let port_output = Command::new("zsh")
            .args(["-c", "lsof -i :18789 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1"])
            .current_dir(get_default_dir())
            .output();

        let (port, pid) = match port_output {
            Ok(out) => {
                let pid = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !pid.is_empty() {
                    (Some(18789), pid)
                } else {
                    (None, String::new())
                }
            }
            Err(_) => (None, String::new()),
        };

        // 获取运行时长
        let uptime = if !pid.is_empty() {
            let uptime_output = Command::new("zsh")
                .args(["-c", &format!("ps -o etime= -p {}", pid)])
                .current_dir(get_default_dir())
                .output();
            match uptime_output {
                Ok(out) => {
                    let time = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !time.is_empty() { Some(time) } else { None }
                }
                Err(_) => None,
            }
        } else {
            None
        };

        GatewayStatus { running: true, port, uptime }
    } else {
        GatewayStatus { running: false, port: None, uptime: None }
    }
}

// 控制 Gateway 启停
#[tauri::command]
fn control_gateway(action: String) -> Result<String, String> {
    let result = match action.as_str() {
        "start" => {
            // 使用 launchctl 启动服务
            let output = Command::new("launchctl")
                .args(["start", "ai.openclaw.gateway"])
                .output();
            match output {
                Ok(out) => {
                    if out.status.success() {
                        Ok("Gateway 已启动".to_string())
                    } else {
                        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                        // 尝试直接运行
                        let fallback = Command::new("openclaw")
                            .args(["gateway", "run"])
                            .spawn();
                        match fallback {
                            Ok(_) => Ok("Gateway 已启动 (前台运行)".to_string()),
                            Err(e) => Err(format!("{} - {}", stderr, e))
                        }
                    }
                }
                Err(e) => Err(e.to_string()),
            }
        }
        "stop" => {
            let output = Command::new("launchctl")
                .args(["stop", "ai.openclaw.gateway"])
                .output();
            match output {
                Ok(out) => {
                    if out.status.success() {
                        Ok("Gateway 已停止".to_string())
                    } else {
                        Err(String::from_utf8_lossy(&out.stderr).to_string())
                    }
                }
                Err(e) => Err(e.to_string()),
            }
        }
        "restart" => {
            // 先停止
            let _ = Command::new("launchctl")
                .args(["stop", "ai.openclaw.gateway"])
                .output();
            // 再启动
            let output = Command::new("launchctl")
                .args(["start", "ai.openclaw.gateway"])
                .output();
            match output {
                Ok(out) => {
                    if out.status.success() {
                        Ok("Gateway 已重启".to_string())
                    } else {
                        Err(String::from_utf8_lossy(&out.stderr).to_string())
                    }
                }
                Err(e) => Err(e.to_string()),
            }
        }
        _ => Err("无效的操作".to_string()),
    };
    
    result
}

// 运行诊断命令
#[tauri::command]
fn run_doctor(check_type: String) -> String {
    let command = match check_type.as_str() {
        "health" => "openclaw doctor",
        "fix" => "openclaw doctor --fix",
        "deep" => "openclaw doctor --deep",
        "config" => "openclaw config --fix",
        _ => "echo 'Unknown check type'",
    };

    let output = Command::new("zsh")
        .args(["-c", command])
        .current_dir(get_default_dir())
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if stdout.is_empty() {
                stderr
            } else {
                stdout
            }
        }
        Err(e) => e.to_string(),
    }
}

// 读取 App 日志
#[tauri::command]
fn read_app_logs(lines: u32) -> String {
    let log_dir = get_log_dir();
    let log_file = log_dir.join("app.log");
    
    if !log_file.exists() {
        return "日志文件不存在".to_string();
    }
    
    // 使用 tail 命令获取最后 N 行
    let output = Command::new("zsh")
        .args(["-c", &format!("tail -n {} \"{}\"", lines, log_file.display())])
        .output();
    
    match output {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(e) => format!("读取失败: {}", e),
    }
}

// 获取 App 版本
#[tauri::command]
fn get_app_version() -> String {
    // 从 tauri.conf.json 读取版本号
    let exe_path = env::current_exe().unwrap_or_default();
    let bundle_dir = exe_path.parent().and_then(|p| p.parent()).and_then(|p| p.parent());
    
    if let Some(bundle) = bundle_dir {
        let conf_path = bundle.join("tauri.conf.json");
        if conf_path.exists() {
            if let Ok(content) = read_to_string(&conf_path) {
                // 简单解析 version 字段
                if let Some(start) = content.find("\"version\"") {
                    if let Some(colon) = content[start..].find(':') {
                        if let Some(quote1) = content[start + colon..].find('"') {
                            if let Some(quote2) = content[start + colon + quote1 + 1..].find('"') {
                                let version = &content[start + colon + quote1 + 1..start + colon + quote1 + 1 + quote2];
                                return version.to_string();
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 回退到默认版本
    "1.1.0".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        // .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            run_command,
            get_env,
            get_gateway_status,
            control_gateway,
            run_doctor,
            read_app_logs,
            get_app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
