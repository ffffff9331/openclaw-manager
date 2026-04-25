use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs::create_dir_all;
use std::path::PathBuf;
use std::process::Command;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const GATEWAY_SERVICE_LABEL: &str = "ai.openclaw.gateway";

// ─── 跨平台基础工具 ───

fn get_home_dir() -> String {
    env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| {
            if cfg!(windows) {
                format!(
                    "C:\\Users\\{}",
                    env::var("USERNAME").unwrap_or_else(|_| "user".into())
                )
            } else {
                "/Users/fan".into()
            }
        })
}

fn get_log_dir() -> PathBuf {
    let home = get_home_dir();
    let log_dir = PathBuf::from(&home).join(".openclaw").join("app-logs");
    let _ = create_dir_all(&log_dir);
    log_dir
}

fn get_default_dir() -> PathBuf {
    PathBuf::from(get_home_dir())
}

fn get_openclaw_dir() -> PathBuf {
    PathBuf::from(get_home_dir()).join(".openclaw")
}

fn get_state_dir() -> PathBuf {
    get_openclaw_dir()
        .join("manager-runtime")
        .join("gateway-control")
        .join("state")
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

// ─── 跨平台 PATH 构建 ───

#[cfg(not(target_os = "windows"))]
fn build_shell_path() -> String {
    let home_dir = get_home_dir();
    let mut full_path = env::var("PATH").unwrap_or_default();
    if !full_path.contains("/opt/homebrew/bin") {
        full_path = format!("/opt/homebrew/bin:{}", full_path);
    }

    let common_paths = format!(
        "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:{home}/bin:{home}/.npm-global/bin:{home}/.local/bin:{home}/.volta/bin:{home}/.asdf/shims:{home}/.fnm/aliases/default/bin",
        home = home_dir
    );

    for p in common_paths.split(':') {
        if !full_path.contains(p) && !p.is_empty() {
            full_path.push(':');
            full_path.push_str(p);
        }
    }

    full_path
}

#[cfg(target_os = "windows")]
fn build_shell_path() -> String {
    let mut full_path = env::var("PATH").unwrap_or_default();
    let home = get_home_dir();
    let appdata = env::var("APPDATA").unwrap_or_else(|_| format!("{}\\AppData\\Roaming", home));
    let localappdata =
        env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{}\\AppData\\Local", home));
    let program_files = env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());

    let extra_paths = [
        format!("{}\\npm", appdata),
        format!("{}\\Programs\\nodejs", localappdata),
        format!("{}\\fnm_multishells", localappdata),
        format!("{}\\volta\\bin", localappdata),
        format!("{}\\nodejs", program_files),
        format!("{}\\Git\\cmd", program_files),
    ];

    for p in &extra_paths {
        if !full_path.contains(p.as_str()) {
            full_path.push(';');
            full_path.push_str(p);
        }
    }

    full_path
}

// ─── 跨平台命令执行 ───

#[cfg(not(target_os = "windows"))]
fn run_shell_command(command: &str) -> std::io::Result<std::process::Output> {
    Command::new("zsh")
        .args(["-lc", command])
        .current_dir(get_default_dir())
        .env("PATH", build_shell_path())
        .output()
}

#[cfg(target_os = "windows")]
fn run_shell_command(command: &str) -> std::io::Result<std::process::Output> {
    Command::new("cmd")
        .args(["/C", command])
        .current_dir(get_default_dir())
        .env("PATH", build_shell_path())
        .output()
}

#[cfg(not(target_os = "windows"))]
fn dispatch_detached_shell_command(command: &str) -> Result<(), String> {
    let detached = format!("(nohup {} >/dev/null 2>&1 &)", command);
    Command::new("zsh")
        .args(["-lc", &detached])
        .current_dir(get_default_dir())
        .env("PATH", build_shell_path())
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn dispatch_detached_shell_command(command: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const DETACHED_PROCESS: u32 = 0x00000008;

    Command::new("cmd")
        .args(["/C", &format!("start /B {}", command)])
        .current_dir(get_default_dir())
        .env("PATH", build_shell_path())
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn escape_for_wsl_double_quotes(command: &str) -> String {
    command
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('$', "\\$")
        .replace('`', "\\`")
}

#[cfg(target_os = "windows")]
fn build_wsl_shell_command(command: &str) -> String {
    let escaped = escape_for_wsl_double_quotes(command);
    format!(
        "export PATH=\"$HOME/.local/bin:$HOME/bin:$HOME/.npm-global/bin:$HOME/.volta/bin:$HOME/.asdf/shims:/usr/local/bin:/usr/bin:/bin:$PATH\"; \
         [ -f /etc/profile ] && . /etc/profile >/dev/null 2>&1; \
         [ -f \"$HOME/.profile\" ] && . \"$HOME/.profile\" >/dev/null 2>&1; \
         [ -f \"$HOME/.bash_profile\" ] && . \"$HOME/.bash_profile\" >/dev/null 2>&1; \
         [ -f \"$HOME/.bashrc\" ] && . \"$HOME/.bashrc\" >/dev/null 2>&1; \
         exec {escaped}",
    )
}

#[cfg(target_os = "windows")]
fn run_wsl_command(command: &str) -> std::io::Result<std::process::Output> {
    let wrapped = build_wsl_shell_command(command);
    Command::new("wsl.exe")
        .args(["-e", "bash", "-lic", &wrapped])
        .output()
}

#[cfg(target_os = "windows")]
fn dispatch_detached_wsl_command(command: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const DETACHED_PROCESS: u32 = 0x00000008;

    let wrapped = build_wsl_shell_command(command);
    Command::new("wsl.exe")
        .args(["-e", "bash", "-lic", &wrapped])
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "windows"))]
fn run_wsl_command(command: &str) -> std::io::Result<std::process::Output> {
    run_shell_command(command)
}

// ─── 跨平台文件尾部读取 ───

fn read_file_tail(path: &std::path::Path, lines: u32) -> String {
    if !path.exists() {
        return String::new();
    }

    // 优先用纯 Rust 读取，不依赖 tail/zsh
    match std::fs::read_to_string(path) {
        Ok(content) => {
            let all_lines: Vec<&str> = content.lines().collect();
            let start = if all_lines.len() > lines as usize {
                all_lines.len() - lines as usize
            } else {
                0
            };
            all_lines[start..].join("\n")
        }
        Err(e) => format!("读取失败: {}", e),
    }
}

// ─── macOS LaunchAgent 工具（仅 macOS 编译）───

#[cfg(target_os = "macos")]
fn current_launchctl_target() -> String {
    let uid_output = Command::new("id").args(["-u"]).output();
    let uid = uid_output
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    if uid.is_empty() {
        GATEWAY_SERVICE_LABEL.to_string()
    } else {
        format!("gui/{}/{}", uid, GATEWAY_SERVICE_LABEL)
    }
}

// ─── Tauri 命令 ───

#[tauri::command]
fn get_env() -> String {
    format!(
        "PATH={}\nHOME={}\nOS={}",
        env::var("PATH").unwrap_or_default(),
        get_home_dir(),
        env::consts::OS
    )
}

fn build_command_result(success: bool, output: String, error: Option<String>) -> CommandResult {
    CommandResult {
        success,
        output,
        error,
    }
}

fn is_read_only_command(command: &str) -> bool {
    let normalized = command.trim();
    normalized.starts_with("openclaw config get")
        || normalized.starts_with("openclaw status")
        || normalized.starts_with("openclaw gateway status")
        || normalized.starts_with("openclaw logs")
        || normalized.starts_with("openclaw cron status")
        || normalized.starts_with("openclaw cron list")
        || normalized.starts_with("openclaw cron runs")
        || normalized.starts_with("openclaw --version")
        || normalized.starts_with("node --version")
        || normalized.starts_with("curl ")
        || normalized.starts_with("sw_vers ")
        || normalized == "ver"
        || normalized.starts_with("systeminfo")
        || normalized.starts_with("docker ps ")
        || normalized.starts_with("docker port ")
        || normalized.starts_with("docker exec ") && is_docker_exec_read_only(normalized)
}

fn is_docker_exec_read_only(command: &str) -> bool {
    // docker exec <container> openclaw --version
    // docker exec <container> openclaw gateway status --json
    let after_exec = command.strip_prefix("docker exec ").unwrap_or("");
    // skip container name (first token after "docker exec ")
    let after_container = after_exec
        .split_whitespace()
        .skip(1)
        .collect::<Vec<_>>()
        .join(" ");
    after_container.starts_with("openclaw --version")
        || after_container.starts_with("openclaw gateway status")
        || after_container.starts_with("openclaw status")
        || after_container.starts_with("openclaw logs")
}

fn is_gateway_lifecycle_command(command: &str) -> bool {
    let normalized = command.trim();
    normalized == "openclaw gateway start"
        || normalized == "openclaw gateway stop"
        || normalized == "openclaw gateway restart"
}

fn execute_sync_command(command: &str, log_prefix: &str) -> CommandResult {
    if command == "DEBUG_PATH" {
        return build_command_result(
            true,
            format!(
                "PATH={}\nHOME={}\nOS={}",
                env::var("PATH").unwrap_or_default(),
                get_home_dir(),
                env::consts::OS
            ),
            None,
        );
    }

    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return build_command_result(false, String::new(), Some("Empty command".to_string()));
    }

    let output = run_shell_command(command);

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();

            if out.status.success() {
                info!("{} OK: {}", log_prefix, &command[..command.len().min(100)]);
            } else {
                warn!(
                    "{} FAIL: {} - {}",
                    log_prefix,
                    &command[..command.len().min(100)],
                    stderr.chars().take(100).collect::<String>()
                );
            }

            if out.status.success() {
                build_command_result(
                    true,
                    stdout,
                    if stderr.is_empty() {
                        None
                    } else {
                        Some(stderr)
                    },
                )
            } else {
                build_command_result(false, stdout, Some(stderr))
            }
        }
        Err(e) => build_command_result(false, String::new(), Some(e.to_string())),
    }
}

fn execute_read_command(command: &str) -> CommandResult {
    execute_sync_command(command, "READ")
}

fn execute_dispatch_command(command: &str) -> CommandResult {
    execute_sync_command(command, "DISPATCH")
}

fn execute_compat_command(command: &str) -> CommandResult {
    execute_sync_command(command, "COMPAT")
}

#[tauri::command]
fn read_command(command: String) -> CommandResult {
    if !is_read_only_command(&command) {
        return build_command_result(
            false,
            String::new(),
            Some("该命令不是只读请求，请改走 dispatch 接口".to_string()),
        );
    }
    execute_read_command(&command)
}

#[tauri::command]
fn dispatch_command(command: String) -> CommandResult {
    if is_gateway_lifecycle_command(&command) {
        return build_command_result(
            false,
            String::new(),
            Some(
                "Gateway 生命周期动作必须走专用控制桥，不能通过通用 dispatch_command 执行"
                    .to_string(),
            ),
        );
    }
    execute_dispatch_command(&command)
}

#[tauri::command]
fn dispatch_detached_command(command: String) -> CommandResult {
    if is_gateway_lifecycle_command(&command) {
        return build_command_result(
            false,
            String::new(),
            Some(
                "Gateway 生命周期动作必须走专用控制桥，不能通过通用 detached dispatch 执行"
                    .to_string(),
            ),
        );
    }

    match dispatch_detached_shell_command(&command) {
        Ok(_) => build_command_result(true, "命令已投递".to_string(), None),
        Err(e) => build_command_result(false, String::new(), Some(e)),
    }
}

#[tauri::command]
fn read_wsl_command(command: String) -> CommandResult {
    if !is_read_only_command(&command) {
        return build_command_result(
            false,
            String::new(),
            Some("该 WSL2 命令不是只读请求，请改走 dispatch 接口".to_string()),
        );
    }
    execute_wsl_command(&command, "WSL_READ")
}

#[tauri::command]
fn dispatch_wsl_command(command: String) -> CommandResult {
    execute_wsl_command(&command, "WSL_DISPATCH")
}

fn execute_wsl_command(command: &str, log_prefix: &str) -> CommandResult {
    match run_wsl_command(command) {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                info!("{} OK: {}", log_prefix, &command[..command.len().min(100)]);
                build_command_result(
                    true,
                    stdout,
                    if stderr.is_empty() {
                        None
                    } else {
                        Some(stderr)
                    },
                )
            } else {
                warn!(
                    "{} FAIL: {} - {}",
                    log_prefix,
                    &command[..command.len().min(100)],
                    stderr.chars().take(100).collect::<String>()
                );
                build_command_result(
                    false,
                    stdout,
                    Some(if stderr.is_empty() {
                        format!("WSL2 命令退出码: {:?}", out.status.code())
                    } else {
                        stderr
                    }),
                )
            }
        }
        Err(e) => build_command_result(
            false,
            String::new(),
            Some(format!("WSL2 命令执行失败: {}", e)),
        ),
    }
}

fn parse_gateway_status_stdout(stdout: &str) -> Option<GatewayStatus> {
    if let Ok(parsed) = serde_json::from_str::<GatewayStatus>(stdout) {
        return Some(parsed);
    }

    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(GatewayStatus {
        running: trimmed.contains("\"running\":true")
            || trimmed.contains("\"status\":\"running\"")
            || trimmed.contains("\"state\":\"active\""),
        port: if trimmed.contains("18789") {
            Some(18789)
        } else {
            None
        },
        uptime: None,
    })
}

fn read_gateway_status_via(
    command_runner: fn(&str) -> std::io::Result<std::process::Output>,
) -> Option<GatewayStatus> {
    match command_runner("openclaw gateway status --json") {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            parse_gateway_status_stdout(&stdout)
        }
        _ => None,
    }
}

#[tauri::command]
fn run_command(command: String) -> CommandResult {
    if is_gateway_lifecycle_command(&command) {
        return build_command_result(
            false,
            String::new(),
            Some("Gateway 生命周期动作必须走专用控制桥，不能通过通用 run_command 执行".to_string()),
        );
    }
    execute_compat_command(&command)
}

#[tauri::command]
fn get_gateway_status() -> GatewayStatus {
    if let Some(status) = read_gateway_status_via(run_shell_command) {
        return status;
    }

    #[cfg(target_os = "windows")]
    if let Some(status) = read_gateway_status_via(run_wsl_command) {
        return status;
    }

    GatewayStatus {
        running: false,
        port: None,
        uptime: None,
    }
}

// ─── Gateway 控制（跨平台）───

#[cfg(not(target_os = "windows"))]
fn dispatch_gateway_action(action: &str) -> Result<String, String> {
    let helper = format!(
        "{}/.openclaw/workspace/openclaw-manager/scripts/gateway_control.sh {}",
        get_home_dir(),
        action
    );

    dispatch_detached_shell_command(&helper).map(|_| match action {
        "start" => "Gateway 启动请求已接受并入队".to_string(),
        "stop" => "Gateway 停止请求已接受并入队".to_string(),
        "restart" => "Gateway 重启请求已接受并入队".to_string(),
        _ => unreachable!(),
    })
}

#[cfg(target_os = "windows")]
fn dispatch_gateway_action(action: &str) -> Result<String, String> {
    let command = format!("openclaw gateway {}", action);

    let dispatcher = if run_shell_command("openclaw --version")
        .map(|out| out.status.success())
        .unwrap_or(false)
    {
        dispatch_detached_shell_command(&command)
    } else {
        dispatch_detached_wsl_command(&command)
    };

    dispatcher.map(|_| match action {
        "start" => "Gateway 启动请求已接受并入队".to_string(),
        "stop" => "Gateway 停止请求已接受并入队".to_string(),
        "restart" => "Gateway 重启请求已接受并入队".to_string(),
        _ => unreachable!(),
    })
}

#[tauri::command]
fn dispatch_gateway_restart() -> Result<String, String> {
    dispatch_gateway_action("restart")
}

#[tauri::command]
fn control_gateway(action: String) -> Result<String, String> {
    let result = dispatch_gateway_action(&action);

    match &result {
        Ok(message) => info!("GATEWAY {} OK: {}", action, message),
        Err(message) => warn!("GATEWAY {} FAIL: {}", action, message),
    }

    result
}

#[tauri::command]
fn run_doctor(check_type: String) -> String {
    let command = match check_type.as_str() {
        "health" => "openclaw doctor",
        "fix" => "openclaw doctor --fix",
        "deep" => "openclaw doctor --deep",
        "config" => "openclaw config --fix",
        _ => {
            if cfg!(windows) {
                "echo Unknown check type"
            } else {
                "echo 'Unknown check type'"
            }
        }
    };

    let output = run_shell_command(command);
    #[cfg(target_os = "windows")]
    let output = match output {
        Ok(out) if out.status.success() => Ok(out),
        _ => run_wsl_command(command),
    };

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

#[tauri::command]
fn read_gateway_logs(lines: u32) -> String {
    let command = format!("openclaw logs --limit {}", lines);
    let output = run_shell_command(&command);
    #[cfg(target_os = "windows")]
    let output = match output {
        Ok(out) if out.status.success() => Ok(out),
        _ => run_wsl_command(&command),
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if stdout.trim().is_empty() {
                stderr
            } else {
                stdout
            }
        }
        Err(e) => format!("读取 Gateway 日志失败: {}", e),
    }
}

#[tauri::command]
fn read_app_logs(lines: u32) -> String {
    let log_dir = get_log_dir();
    let log_file = log_dir.join("app.log");

    if !log_file.exists() {
        return "日志文件不存在".to_string();
    }

    read_file_tail(&log_file, lines)
}

#[tauri::command]
fn read_doctor_result(lines: u32) -> String {
    let log_dir = get_log_dir();
    let log_file = log_dir.join("doctor-result.log");

    if !log_file.exists() {
        return "Doctor 结果文件不存在".to_string();
    }

    read_file_tail(&log_file, lines)
}

// ─── Gateway 控制状态读取（跨平台）───

#[tauri::command]
fn read_gateway_control_state() -> String {
    let state_dir = get_state_dir();

    if !state_dir.exists() {
        return "{}".to_string();
    }

    let read_state_file = |name: &str| -> String {
        std::fs::read_to_string(state_dir.join(name))
            .unwrap_or_default()
            .trim()
            .to_string()
    };

    let history_path = state_dir.join("launch-agent-history.log");
    let history_entries: Vec<serde_json::Value> = if history_path.exists() {
        std::fs::read_to_string(&history_path)
            .unwrap_or_default()
            .lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(3, ' ').collect();
                if parts.len() >= 2 {
                    Some(serde_json::json!({
                        "at": parts[0],
                        "action": parts[1],
                        "state": parts.get(2).unwrap_or(&"")
                    }))
                } else {
                    None
                }
            })
            .collect()
    } else {
        vec![]
    };

    #[cfg(target_os = "macos")]
    let (plist_exists, la_loaded, la_status) = {
        let plist_path = format!(
            "{}/Library/LaunchAgents/{}.plist",
            get_home_dir(),
            GATEWAY_SERVICE_LABEL
        );
        let exists = std::path::Path::new(&plist_path).exists();
        let target = current_launchctl_target();
        let loaded_output = Command::new("launchctl").args(["print", &target]).output();
        let loaded = loaded_output.map(|o| o.status.success()).unwrap_or(false);
        let status = if loaded { "loaded" } else { "not-loaded" };
        (exists, loaded, status.to_string())
    };

    #[cfg(not(target_os = "macos"))]
    let (plist_exists, la_loaded, la_status) = { (false, false, "not-applicable".to_string()) };

    let state = serde_json::json!({
        "lastDispatch": read_state_file("last-dispatch.txt"),
        "lastRequest": read_state_file("last-request.txt"),
        "lastResult": read_state_file("last-result.txt"),
        "lastLaunchAgentAction": read_state_file("last-launch-agent-action.txt"),
        "lastLaunchAgentResult": read_state_file("last-launch-agent-result.txt"),
        "lastLaunchAgentState": read_state_file("last-launch-agent-state.txt"),
        "lastLaunchAgentStartedAt": read_state_file("last-launch-agent-started-at.txt"),
        "lastLaunchAgentFinishedAt": read_state_file("last-launch-agent-finished-at.txt"),
        "lastLaunchAgentLog": read_state_file("last-launch-agent-log.txt"),
        "lastLaunchAgentError": read_state_file("last-launch-agent-error.txt"),
        "lastLaunchAgentErrorKind": read_state_file("last-launch-agent-error-kind.txt"),
        "lastLaunchAgentRecoveryHint": read_state_file("last-launch-agent-recovery-hint.txt"),
        "launchAgentHistory": history_entries,
        "launchAgentPlistExists": plist_exists,
        "launchAgentLoaded": la_loaded,
        "launchAgentStatus": la_status,
    });

    serde_json::to_string(&state).unwrap_or_else(|_| "{}".to_string())
}

// ─── LaunchAgent 管理（macOS 专属，其他平台返回不支持）───

#[tauri::command]
fn manage_gateway_launch_agent(action: String) -> Result<String, String> {
    if cfg!(not(target_os = "macos")) {
        return Err("LaunchAgent 管理仅在 macOS 上可用；Windows 请使用 openclaw gateway start/stop 直接控制。".to_string());
    }

    manage_gateway_launch_agent_macos(action)
}

#[cfg(target_os = "macos")]
fn manage_gateway_launch_agent_macos(action: String) -> Result<String, String> {
    let state_dir = get_state_dir();
    let _ = create_dir_all(&state_dir);

    let home = get_home_dir();
    let target = format!(
        "{}/Library/LaunchAgents/{}.plist",
        home, GATEWAY_SERVICE_LABEL
    );
    let domain = format!("gui/{}", {
        let uid_output = Command::new("id").args(["-u"]).output();
        uid_output
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default()
    });

    let command = match action.as_str() {
        "install" => {
            let plist_content = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/openclaw</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>{home}/.openclaw/app-logs/gateway-launch.log</string>
    <key>StandardErrorPath</key>
    <string>{home}/.openclaw/app-logs/gateway-launch-error.log</string>
</dict>
</plist>"#,
                label = GATEWAY_SERVICE_LABEL,
                home = home
            );
            let _ = std::fs::write(&target, plist_content);
            "echo 'plist installed'".to_string()
        }
        "load" => {
            format!(
            "launchctl bootstrap {domain} '{target}' || launchctl kickstart -k {domain}/{label}",
            domain = domain, target = target, label = GATEWAY_SERVICE_LABEL
        )
        }
        "unload" => format!(
            "launchctl bootout {domain} '{target}' || launchctl kill SIGTERM {domain}/{label}",
            domain = domain,
            target = target,
            label = GATEWAY_SERVICE_LABEL
        ),
        "remove" => format!("rm -f '{}'", target),
        _ => return Err("无效的 LaunchAgent 操作".to_string()),
    };

    let action_message = match action.as_str() {
        "install" => "Gateway LaunchAgent 安装请求已投递".to_string(),
        "load" => "Gateway LaunchAgent 加载请求已投递".to_string(),
        "unload" => "Gateway LaunchAgent 卸载请求已投递".to_string(),
        "remove" => "Gateway LaunchAgent 删除请求已投递".to_string(),
        _ => unreachable!(),
    };

    let now = chrono::Utc::now().to_rfc3339();
    let history_path = state_dir.join("launch-agent-history.log");
    let mut history = std::fs::read_to_string(&history_path).unwrap_or_default();
    history.push_str(&format!("{} {} accepted\n", now, action));
    let _ = std::fs::write(&history_path, history);
    let _ = std::fs::write(
        state_dir.join("last-launch-agent-action.txt"),
        format!("{} {}", now, action),
    );
    let _ = std::fs::write(state_dir.join("last-launch-agent-state.txt"), "queued");
    let _ = std::fs::write(
        state_dir.join("last-launch-agent-started-at.txt"),
        now.clone(),
    );
    let _ = std::fs::write(state_dir.join("last-launch-agent-finished-at.txt"), "");
    let _ = std::fs::write(
        state_dir.join("last-launch-agent-result.txt"),
        format!("{} accepted", now),
    );

    if action != "install" {
        let wrapped_command = format!(
            "zsh -lc 'printf \"%s\\n\" \"running\" > \"{state}/last-launch-agent-state.txt\"; {command} > /tmp/openclaw-manager-launchagent-{action}.log 2>&1; code=$?; if [ $code -eq 0 ]; then printf \"%s success\\n\" \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > \"{state}/last-launch-agent-result.txt\"; printf \"%s\\n\" \"success\" > \"{state}/last-launch-agent-state.txt\"; else printf \"%s failed\\n\" \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > \"{state}/last-launch-agent-result.txt\"; printf \"%s\\n\" \"failed\" > \"{state}/last-launch-agent-state.txt\"; fi; printf \"%s\\n\" \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > \"{state}/last-launch-agent-finished-at.txt\"'",
            command = command.replace('\'', "'\\''"),
            action = action,
            state = state_dir.display()
        );
        dispatch_detached_shell_command(&wrapped_command).map(|_| action_message)
    } else {
        let _ = std::fs::write(state_dir.join("last-launch-agent-state.txt"), "success");
        let _ = std::fs::write(
            state_dir.join("last-launch-agent-result.txt"),
            format!("{} success", now),
        );
        let _ = std::fs::write(
            state_dir.join("last-launch-agent-finished-at.txt"),
            chrono::Utc::now().to_rfc3339(),
        );
        Ok(action_message)
    }
}

#[cfg(not(target_os = "macos"))]
fn manage_gateway_launch_agent_macos(_action: String) -> Result<String, String> {
    Err("LaunchAgent 管理仅在 macOS 上可用".to_string())
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if app.get_webview_window("main").is_none() {
                let _window =
                    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                        .title("🦞 OpenClaw 管理助手")
                        .inner_size(900.0, 650.0)
                        .min_inner_size(700.0, 500.0)
                        .center()
                        .resizable(true)
                        .build()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_command,
            read_command,
            read_wsl_command,
            dispatch_command,
            dispatch_wsl_command,
            dispatch_detached_command,
            get_env,
            get_gateway_status,
            dispatch_gateway_restart,
            control_gateway,
            run_doctor,
            read_gateway_logs,
            read_app_logs,
            read_doctor_result,
            read_gateway_control_state,
            manage_gateway_launch_agent,
            get_app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
