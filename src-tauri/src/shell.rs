//! Windows 进程托管:Job Object 保证 manager 整棵进程树随壳退出而消亡。
//! 壳被强杀/崩溃时 OS 关闭 job handle → KILL_ON_JOB_CLOSE 生效,server+bot 一并清理。

use std::ffi::OsStr;
use std::io::{self, Read, Write};
use std::mem;
use std::net::TcpStream;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    SetInformationJobObject, TerminateJobObject,
};
use windows_sys::Win32::System::Threading::{
    CreateProcessW, ResumeThread, STARTUPINFOW, CREATE_NO_WINDOW, CREATE_SUSPENDED,
    PROCESS_INFORMATION,
};

/// 持有一个 Job Object;Drop 即终止整棵进程树
pub struct JobGuard {
    job: HANDLE,
    #[allow(dead_code)] // 诊断/验收测试用:确认拉起的 manager PID
    pub pid: u32,
}

// HANDLE 只是本进程内的不透明指针值,仅经 Mutex 串行访问,绝不跨进程传递
unsafe impl Send for JobGuard {}
unsafe impl Sync for JobGuard {}

impl JobGuard {
    pub fn kill(&mut self) {
        let job = mem::replace(&mut self.job, std::ptr::null_mut());
        if !job.is_null() {
            unsafe {
                TerminateJobObject(job, 1);
                CloseHandle(job);
            }
        }
    }
}

impl Drop for JobGuard {
    fn drop(&mut self) {
        self.kill();
    }
}

/// 从壳 exe 所在目录向上找包含 manager.js 的应用根目录(打包态=安装目录,dev 态=仓库根)
pub fn find_app_root() -> Option<PathBuf> {
    let mut dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    for _ in 0..6 {
        if dir.join("manager.js").is_file() {
            return Some(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

/// 以挂起方式拉起 `node manager.js --shell`,挂进 job 后放行。
/// Assign 失败(壳自身已运行在外部 job,如 CI 调试)时降级为不带 job 直接运行。
pub fn spawn_manager(root: &Path) -> io::Result<JobGuard> {
    let node_exe = find_node(root);
    let manager_js = root.join("manager.js");

    let cmd = format!("\"{}\" \"{}\" --shell", node_exe.display(), manager_js.display());
    let mut cmdw: Vec<u16> = cmd.encode_utf16().chain(std::iter::once(0)).collect();
    let cwd = to_wstring(root.as_os_str());

    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return Err(io::Error::last_os_error());
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const core::ffi::c_void,
            mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if ok == 0 {
            let err = io::Error::last_os_error();
            CloseHandle(job);
            return Err(err);
        }

        let mut si: STARTUPINFOW = mem::zeroed();
        si.cb = mem::size_of::<STARTUPINFOW>() as u32;
        let mut pi: PROCESS_INFORMATION = mem::zeroed();

        let r = CreateProcessW(
            std::ptr::null(),
            cmdw.as_mut_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            0, // bInheritHandles = FALSE
            (CREATE_SUSPENDED | CREATE_NO_WINDOW) as u32,
            std::ptr::null(),
            cwd.as_ptr(),
            &si,
            &mut pi,
        );
        if r == 0 {
            let err = io::Error::last_os_error();
            CloseHandle(job);
            return Err(err);
        }

        let pid = pi.dwProcessId;
        let mut job_handle = job;
        if AssignProcessToJobObject(job, pi.hProcess) == 0 {
            // 降级:不挂 job,直接放行
            job_handle = std::ptr::null_mut();
            CloseHandle(job);
        }
        ResumeThread(pi.hThread);
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
        Ok(JobGuard { job: job_handle, pid })
    }
}

/// 轮询 127.0.0.1:3000-3009 首个返回 HTTP 200 的端口
pub fn wait_ready(timeout_secs: u64) -> Option<u16> {
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        for port in 3000..=3009 {
            if tcp_ok(port) {
                return Some(port);
            }
        }
        if Instant::now() >= deadline {
            return None;
        }
        thread::sleep(Duration::from_millis(500));
    }
}

fn tcp_ok(port: u16) -> bool {
    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(1500)));
    if stream.write_all(b"GET / HTTP/1.0\r\n\r\n").is_err() {
        return false;
    }
    let mut buf = [0u8; 64];
    match stream.read(&mut buf) {
        Ok(n) => n > 0 && buf[..n].windows(4).any(|w| w == b" 200"),
        Err(_) => false,
    }
}

/// 复用 manager.js 的 NODE_BIN 逻辑:便携 node 优先,否则系统 PATH
fn find_node(root: &Path) -> PathBuf {
    let portable = root.join("runtime").join("node").join("node.exe");
    if portable.is_file() {
        portable
    } else {
        PathBuf::from("node.exe")
    }
}

fn to_wstring(s: &OsStr) -> Vec<u16> {
    s.encode_wide().chain(std::iter::once(0)).collect()
}
