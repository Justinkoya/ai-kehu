import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

// 开机自启 = 在 Windows 启动目录放一个指向 start-bot.bat 的最小化快捷方式
const STARTUP_DIR = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "Microsoft",
  "Windows",
  "Start Menu",
  "Programs",
  "Startup"
);
const SHORTCUT_NAME = "ai-kehu-bot.lnk";
const SHORTCUT_PATH = path.join(STARTUP_DIR, SHORTCUT_NAME);
const REPO_DIR = process.cwd();
const TARGET_BAT = path.join(REPO_DIR, "start-bot.bat");

function psQuote(p: string): string {
  return "'" + p.replace(/'/g, "''") + "'";
}

export async function GET() {
  return NextResponse.json({ enabled: fs.existsSync(SHORTCUT_PATH) });
}

export async function PUT(req: Request) {
  try {
    const { enabled } = (await req.json()) as { enabled?: boolean };
    if (enabled) {
      if (!fs.existsSync(TARGET_BAT)) {
        return NextResponse.json({ error: "未找到 start-bot.bat,无法设置开机自启" }, { status: 500 });
      }
      await execFileAsync("powershell", [
        "-NoProfile",
        "-Command",
        [
          "$w = New-Object -ComObject WScript.Shell",
          `$s = $w.CreateShortcut(${psQuote(SHORTCUT_PATH)})`,
          `$s.TargetPath = ${psQuote(TARGET_BAT)}`,
          `$s.WorkingDirectory = ${psQuote(REPO_DIR)}`,
          `$s.WindowStyle = 7`,
          "$s.Save()",
        ].join("; "),
      ]);
    } else {
      if (fs.existsSync(SHORTCUT_PATH)) fs.unlinkSync(SHORTCUT_PATH);
    }
    return NextResponse.json({ enabled: fs.existsSync(SHORTCUT_PATH) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
