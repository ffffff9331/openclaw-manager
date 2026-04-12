use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs::create_dir_all;
use std::path::PathBuf;
use std::process::Command;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const GATEWAY_SERVICE_LABEL: &str = "ai.openclaw.gateway";

fn get_log_dir() -> PathBuf {
    let home = env::var("HOME").unwrap_or_else(|_| "/Users/fan".to_string());
    let log_dir = PathBuf::from(format!("{}/.openclaw/app-logs", home));
    let _ = create_dir_all(&log_dir);
    log_dir
}

fn get_default_dir() -> PathBuf {
    env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            if let Ok(entries) = std::fs::read_dir("/Users") {
                for entry in entries.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                        if name != "Shared" && name != "Guest" {
                            return PathBuf::from(format!("/Users/{}", name));
                        }
                    }
                }
            }
            PathBuf::from("/Users/fan")
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

fn build_shell_path() -> String {
    let home_dir = env::var("HOME").unwrap_or_else(|_| "/Users/fan".to_string());
    let mut full_path = env::var("PATH").unwrap_or_else(|_| String::new());
    if !full_path.contains("/opt/homebrew/bin") {
        full_path = format!("/opt/homebrew/bin:{}", full_path);
    }

    let common_paths = format!(
        "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:{}:{}:{}/.npm-global/bin:{}/.local/bin:{}/.volta/bin:{}/.asdf/shims:{}/.fnm/aliases/default/bin",
        home_dir,
        format!("{}/bin", home_dir),
        home_dir,
        home_dir,
        home_dir,
        home_dir,
        home_dir
    );

    for p in common_paths.split(':') {
        if !full_path.contains(p) && !p.is_empty() {
            full_path.push(':');
            full_path.push_str(p);
        }
    }

    full_path
}

fn run_shell_command(command: &str) -> std::io::Result<std::process::Output> {
    Command::new("zsh")
        .args(["-lc", command])
        .current_dir(get_default_dir())
        .env("PATH", build_shell_path())
        .output()
}

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

fn unwrap_output(output: std::io::Result<std::process::Output>) -> Result<String, String> {
    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            if out.status.success() {
                Ok(if stdout.is_empty() { "ok".to_string() } else { stdout })
            } else if !stderr.is_empty() {
                Err(stderr)
            } else if !stdout.is_empty() {
                Err(stdout)
            } else {
                Err(format!("命令退出码: {:?}", out.status.code()))
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

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

#[tauri::command]
fn get_env() -> String {
    format!(
        "PATH={}\nHOME={}",
        env::var("PATH").unwrap_or_default(),
        env::var("HOME").unwrap_or_default()
    )
}

fn build_command_result(success: bool, output: String, error: Option<String>) -> CommandResult {
    CommandResult { success, output, error }
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
                "PATH={}\nHOME={}",
                env::var("PATH").unwrap_or_default(),
                env::var("HOME").unwrap_or_default()
            ),
            None,
        );
    }

    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return build_command_result(false, String::new(), Some("Empty command".to_string()));
    }

    let output = if cfg!(target_os = "macos") || cfg!(target_os = "linux") {
        run_shell_command(command)
    } else {
        Command::new("cmd").args(["/C", command]).output()
    };

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
                build_command_result(true, stdout, if stderr.is_empty() { None } else { Some(stderr) })
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
            Some("Gateway 生命周期动作必须走专用控制桥，不能通过通用 dispatch_command 执行".to_string()),
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
            Some("Gateway 生命周期动作必须走专用控制桥，不能通过通用 detached dispatch 执行".to_string()),
        );
    }

    match dispatch_detached_shell_command(&command) {
        Ok(_) => build_command_result(true, "命令已投递".to_string(), None),
        Err(e) => build_command_result(false, String::new(), Some(e)),
    }
}

#[tauri::command]
fn run_command(command: String) -> CommandResult {
    execute_compat_command(&command)
}

#[tauri::command]
fn get_gateway_status() -> GatewayStatus {
    let output = run_shell_command("openclaw gateway status --json");

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            if let Ok(parsed) = serde_json::from_str::<GatewayStatus>(&stdout) {
                parsed
            } else {
                GatewayStatus {
                    running: stdout.contains("\"running\":true"),
                    port: if stdout.contains("18789") { Some(18789) } else { None },
                    uptime: None,
                }
            }
        }
        _ => GatewayStatus {
            running: false,
            port: None,
            uptime: None,
        },
    }
}

fn dispatch_gateway_action(action: &str) -> Result<String, String> {
    let helper = format!(
        "{}/.openclaw/workspace/openclaw-manager/scripts/gateway_control.sh {}",
        env::var("HOME").unwrap_or_else(|_| "/Users/fan".to_string()),
        action
    );

    dispatch_detached_shell_command(&helper).map(|_| match action {
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
        _ => "echo 'Unknown check type'",
    };

    match run_shell_command(command) {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if stdout.is_empty() { stderr } else { stdout }
        }
        Err(e) => e.to_string(),
    }
}

#[tauri::command]
fn read_gateway_logs(lines: u32) -> String {
    match run_shell_command(&format!("openclaw logs --limit {}", lines)) {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if stdout.trim().is_empty() { stderr } else { stdout }
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

    let output = Command::new("zsh")
        .args(["-c", &format!("tail -n {} \"{}\"", lines, log_file.display())])
        .output();

    match output {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(e) => format!("读取失败: {}", e),
    }
}

#[tauri::command]
fn read_doctor_result(lines: u32) -> String {
    let log_file = PathBuf::from("/tmp/openclaw-manager-doctor.log");

    if !log_file.exists() {
        return "暂无诊断结果，请先运行一次诊断。".to_string();
    }

    let output = Command::new("zsh")
        .args(["-c", &format!("tail -n {} \"{}\"", lines, log_file.display())])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            if stdout.trim().is_empty() {
                "诊断结果文件为空，任务可能仍在执行中。".to_string()
            } else {
                stdout
            }
        }
        Err(e) => format!("读取诊断结果失败: {}", e),
    }
}

#[tauri::command]
fn read_gateway_control_state() -> String {
    let home = env::var("HOME").unwrap_or_else(|_| "/Users/fan".to_string());
    let state_dir = PathBuf::from(format!(
        "{}/.openclaw/manager-runtime/gateway-control/state",
        home
    ));
    let launch_agent_plist = PathBuf::from(format!(
        "{}/Library/LaunchAgents/ai.openclaw.gateway-control.plist",
        home
    ));
    let launch_agent_label = "gui/".to_string() + &current_launchctl_target().split('/').nth(1).unwrap_or("") + "/ai.openclaw.gateway-control";

    let read_state = |name: &str| -> String {
        let path = state_dir.join(name);
        std::fs::read_to_string(path)
            .map(|s| s.trim().to_string())
            .unwrap_or_default()
    };

    let launch_agent_loaded = Command::new("launchctl")
        .args(["print", &launch_agent_label])
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false);

    let last_launch_agent_action = read_state("last-launch-agent-action.txt");
    let last_launch_agent_action_name = last_launch_agent_action
        .split_whitespace()
        .last()
        .unwrap_or("");
    let launch_agent_log_path = if last_launch_agent_action_name.is_empty() {
        "/tmp/openclaw-manager-launchagent-action.log".to_string()
    } else {
        format!("/tmp/openclaw-manager-launchagent-{}.log", last_launch_agent_action_name)
    };
    let launch_agent_log = Command::new("zsh")
        .args(["-lc", &format!("tail -n 20 '{}' 2>/dev/null || true", launch_agent_log_path)])
        .output()
        .ok()
        .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
        .unwrap_or_default();
    let launch_agent_error = launch_agent_log
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("")
        .to_string();

    let (launch_agent_error_kind, launch_agent_recovery_hint) = if launch_agent_error.contains("No such file")
        || launch_agent_error.contains("not-installed")
    {
        (
            "plist-missing".to_string(),
            "先执行“安装 LaunchAgent”，再尝试加载。".to_string(),
        )
    } else if launch_agent_error.contains("bootstrap failed")
        || launch_agent_error.contains("Bootstrap failed")
    {
        (
            "bootstrap-failed".to_string(),
            "检查 plist 内容与 label 是否正确，再重试加载。".to_string(),
        )
    } else if launch_agent_error.contains("Input/output error")
        || launch_agent_error.contains("Operation not permitted")
        || launch_agent_error.contains("Permission denied")
    {
        (
            "permission-or-io".to_string(),
            "检查 launchctl 权限、用户域与文件读写权限。".to_string(),
        )
    } else if launch_agent_error.contains("already loaded")
        || launch_agent_error.contains("service already loaded")
    {
        (
            "already-loaded".to_string(),
            "可直接重试 kickstart，或先卸载再加载。".to_string(),
        )
    } else if launch_agent_error.contains("Could not find service")
        || launch_agent_error.contains("not loaded")
    {
        (
            "not-loaded".to_string(),
            "先确认已安装，再执行加载。".to_string(),
        )
    } else if launch_agent_error.trim().is_empty() {
        ("".to_string(), "".to_string())
    } else {
        (
            "unknown".to_string(),
            "查看最近 LaunchAgent 日志摘要，按日志内容继续排查。".to_string(),
        )
    };

    let launch_agent_status = if launch_agent_loaded {
        "loaded".to_string()
    } else if launch_agent_plist.exists() {
        "installed-not-loaded".to_string()
    } else {
        "not-installed".to_string()
    };

    let read_history = || -> Vec<serde_json::Value> {
        let history_path = state_dir.join("launch-agent-history.log");
        std::fs::read_to_string(history_path)
            .unwrap_or_default()
            .lines()
            .rev()
            .take(10)
            .filter_map(|line| {
                let mut parts = line.split_whitespace();
                let at = parts.next()?.to_string();
                let action = parts.next().unwrap_or("").to_string();
                let state = parts.next().unwrap_or("").to_string();
                Some(serde_json::json!({
                    "at": at,
                    "action": action,
                    "state": state
                }))
            })
            .collect()
    };

    let duration_sec = {
        let started = read_state("last-launch-agent-started-at.txt");
        let finished = read_state("last-launch-agent-finished-at.txt");
        if started.is_empty() || finished.is_empty() {
            None
        } else {
            match (
                chrono::DateTime::parse_from_rfc3339(&started),
                chrono::DateTime::parse_from_rfc3339(&finished),
            ) {
                (Ok(started_at), Ok(finished_at)) => Some((finished_at - started_at).num_seconds()),
                _ => None,
            }
        }
    };

    serde_json::json!({
        "lastDispatch": read_state("last-dispatch.txt"),
        "lastRequest": read_state("last-request.txt"),
        "lastResult": read_state("last-result.txt"),
        "lastLaunchAgentState": read_state("last-launch-agent-state.txt"),
        "lastLaunchAgentStartedAt": read_state("last-launch-agent-started-at.txt"),
        "lastLaunchAgentFinishedAt": read_state("last-launch-agent-finished-at.txt"),
        "lastLaunchAgentDurationSec": duration_sec,
        "lastLaunchAgentLog": launch_agent_log,
        "lastLaunchAgentError": launch_agent_error,
        "lastLaunchAgentErrorKind": launch_agent_error_kind,
        "lastLaunchAgentRecoveryHint": launch_agent_recovery_hint,
        "launchAgentHistory": read_history(),
        "launchAgentPlistExists": launch_agent_plist.exists(),
        "launchAgentLoaded": launch_agent_loaded,
        "launchAgentStatus": launch_agent_status
    })
    .to_string()
}

#[tauri::command]
fn manage_gateway_launch_agent(action: String) -> Result<String, String> {
    let home = env::var("HOME").unwrap_or_else(|_| "/Users/fan".to_string());
    let state_dir = PathBuf::from(format!(
        "{}/.openclaw/manager-runtime/gateway-control/state",
        home
    ));
    let source = format!("{}/.openclaw/workspace/openclaw-manager/scripts/ai.openclaw.gateway-control.plist", home);
    let target = format!("{}/Library/LaunchAgents/ai.openclaw.gateway-control.plist", home);
    let uid = current_launchctl_target()
        .split('/')
        .nth(1)
        .unwrap_or("501")
        .to_string();
    let domain = format!("gui/{}", uid);

    let command = match action.as_str() {
        "install" => format!("mkdir -p '{home}/Library/LaunchAgents' && cp '{source}' '{target}'", home = home, source = source, target = target),
        "load" => format!("launchctl bootstrap {domain} '{target}' || launchctl kickstart -k {domain}/ai.openclaw.gateway-control", domain = domain, target = target),
        "unload" => format!("launchctl bootout {domain} '{target}' || launchctl kill SIGTERM {domain}/ai.openclaw.gateway-control", domain = domain, target = target),
        "remove" => format!("rm -f '{target}'", target = target),
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
    let _ = std::fs::write(state_dir.join("last-launch-agent-started-at.txt"), now.clone());
    let _ = std::fs::write(state_dir.join("last-launch-agent-finished-at.txt"), "");
    let _ = std::fs::write(
        state_dir.join("last-launch-agent-result.txt"),
        format!("{} accepted", now),
    );

    let wrapped_command = format!(
        "zsh -lc 'printf \"%s\\n\" \"running\" > \"{state}/last-launch-agent-state.txt\"; {command} > /tmp/openclaw-manager-launchagent-{action}.log 2>&1; code=$?; if [ $code -eq 0 ]; then printf \"%s success\\n\" \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > \"{state}/last-launch-agent-result.txt\"; printf \"%s\\n\" \"success\" > \"{state}/last-launch-agent-state.txt\"; else printf \"%s failed\\n\" \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > \"{state}/last-launch-agent-result.txt\"; printf \"%s\\n\" \"failed\" > \"{state}/last-launch-agent-state.txt\"; fi; printf \"%s\\n\" \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > \"{state}/last-launch-agent-finished-at.txt\"'",
        command = command.replace("'", "'\\''"),
        action = action,
        state = state_dir.display()
    );

    dispatch_detached_shell_command(&wrapped_command).map(|_| action_message)
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if app.get_webview_window("main").is_none() {
                let _window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
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
            dispatch_command,
            dispatch_detached_command,
            get_env,
            get_gateway_status,
            dispatch_gateway_restart,
            control_gateway,
            run_doctor,
            read_gateway_logs,
            read_app_logs,
            read_gateway_control_state,
            get_app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
