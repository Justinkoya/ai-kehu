mod shell;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, RunEvent, Url, WindowEvent};

struct Backend(Mutex<Option<shell::JobGuard>>);

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// 兜底:个别环境窗口会被置为隐藏/最小化/移出屏幕,强制恢复并居中
fn ensure_visible(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.center();
        let _ = w.set_focus();
    }
}

fn log_debug(msg: &str) {
    use std::io::Write;
    let mut path = std::env::temp_dir();
    path.push("aikehu-shell-debug.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = f.write_all(msg.as_bytes());
        let _ = f.write_all(b"\n");
    }
}

fn navigate_port(app: &AppHandle, port: u16) {
    if let Some(w) = app.get_webview_window("main") {
        if let Ok(url) = Url::parse(&format!("http://127.0.0.1:{port}")) {
            let _ = w.navigate(url);
        }
    }
    // WebView2 加载期间可能挪动/重设窗口,稍后强制回正
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(2));
        ensure_visible(&handle);
    });
}

fn loading_error(app: &AppHandle, msg: &str) {
    if let Some(w) = app.get_webview_window("main") {
        let js = format!(
            "document.getElementById('status').textContent = '{}'",
            msg.replace('\\', "\\\\").replace('\'', "\\'")
        );
        let _ = w.eval(&js);
    }
}

fn kill_backend(app: &AppHandle) {
    let st = app.state::<Backend>();
    let mut guard = st.inner().0.lock().unwrap();
    if let Some(g) = guard.as_mut() {
        g.kill();
    }
    *guard = None;
}

/// 打包态(root 下有 app/server.js)拉起 manager;dev 态直接加载已就绪的 3000。
fn start_backend(app: &AppHandle, root: &PathBuf) {
    if root.join("app").join("server.js").is_file() {
        let st = app.state::<Backend>();
        let mut guard = st.inner().0.lock().unwrap();
        if guard.is_none() {
            match shell::spawn_manager(root) {
                Ok(g) => *guard = Some(g),
                Err(e) => {
                    loading_error(app, "后端启动失败,请查看 data/logs");
                    eprintln!("spawn manager failed: {e}");
                }
            }
        }
    }

    let handle = app.clone();
    std::thread::spawn(move || match shell::wait_ready(90) {
        Some(port) => navigate_port(&handle, port),
        None => loading_error(&handle, "启动超时,请查看 data/logs 下的日志"),
    });
}

pub fn run() {
    let start_minimized = std::env::args().any(|a| a == "--start-minimized");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .manage(Backend(Mutex::new(None)))
        .setup(move |app| {
            let handle = app.handle().clone();
            if let Some(root) = shell::find_app_root() {
                start_backend(&handle, &root);
            }

            let show = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>)?;
            let restart = MenuItem::with_id(app, "restart", "重启", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &restart, &quit])?;

            let mut tray = TrayIconBuilder::with_id("tray")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main(app),
                    "restart" => {
                        kill_backend(app);
                        if let Some(root) = shell::find_app_root() {
                            start_backend(app, &root);
                        }
                    }
                    "quit" => {
                        kill_backend(app);
                        app.exit(0);
                    }
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            let _tray = tray.build(app)?;

            if start_minimized {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            } else {
                ensure_visible(&handle);
            }
            if let Some(w) = app.get_webview_window("main") {
                log_debug(&format!("setup 完成: pos={:?} size={:?}", w.outer_position(), w.outer_size()));
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
            if let WindowEvent::Moved(p) = event {
                log_debug(&format!("Moved {p:?}"));
            }
            if let WindowEvent::Resized(s) = event {
                log_debug(&format!("Resized {s:?}"));
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                kill_backend(app);
            }
        });
}
