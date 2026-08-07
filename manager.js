"use strict";
// AI客户经营助手 · Windows 单机管理器
// 职责:数据库迁移、拉起/守护 Next 服务器、拉起/守护微信 bot、日志、开机自启自动开浏览器。
// 开发时直接 `node manager.js`(用系统 Node);安装版用便携 Node 跑,逻辑一致。

const { spawn, exec } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const ROOT = __dirname;
const APP_DIR = path.join(ROOT, "app");
const DATA_DIR = path.join(ROOT, "data");
const LOG_DIR = path.join(DATA_DIR, "logs");
const BACKUP_DIR = path.join(DATA_DIR, "backup");
const DB_PATH = path.join(DATA_DIR, "dev.db");
const CONFIG_PATH = path.join(ROOT, "config.json");
const DB_URL = "file:" + DB_PATH.replace(/\\/g, "/");

const NODE_BIN = fs.existsSync(path.join(ROOT, "runtime", "node", "node.exe"))
  ? path.join(ROOT, "runtime", "node", "node.exe")
  : process.execPath;
const TSCLI = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const PRISMA_CLI = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
const SERVER_JS = path.join(APP_DIR, "server.js");

const cfg = (() => {
  try {
    return { port: 3000, bot: true, openBrowser: true, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {
    return { port: 3000, bot: true, openBrowser: true };
  }
})();

// 由 Tauri 壳拉起时(--shell),不再弹浏览器,窗口由壳负责
const SHELL = process.argv.includes("--shell");

const children = new Map();
let stopping = false;
let botBackoff = 1000;
let botStartedAt = Date.now();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");
function ts() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function log(name, line) {
  const msg = `[${ts()}] [${name}] ${line}`;
  console.log(msg);
  try { fs.appendFileSync(path.join(LOG_DIR, `${name}-${new Date().toISOString().slice(0, 10)}.log`), msg + "\n"); } catch {}
}

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
function saveConfig() {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}

function healthOk(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}
function portFree(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port }, () => { s.destroy(); resolve(false); });
    s.on("error", () => resolve(true));
    s.setTimeout(1200, () => { s.destroy(); resolve(true); });
  });
}
async function waitHealthy(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await healthOk(port)) return true;
    await sleep(500);
  }
  return false;
}

function run(name, cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.set(name, child);
  child.stdout.on("data", (d) => log(name, d.toString().trimEnd()));
  child.stderr.on("data", (d) => log(name, "ERR " + d.toString().trimEnd()));
  return child;
}

function backupDb() {
  if (!fs.existsSync(DB_PATH)) return;
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  try {
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, `dev-${stamp}.db`));
    log("manager", `已备份数据库 → backup/dev-${stamp}.db`);
  } catch (e) {
    log("manager", "备份失败:" + e.message);
  }
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).sort();
    while (files.length > 30) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  } catch {}
}

function runMigrate() {
  return new Promise((resolve) => {
    log("manager", "执行数据库迁移(migrate deploy)…");
    const child = spawn(NODE_BIN, [PRISMA_CLI, "migrate", "deploy"], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: DB_URL },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => log("migrate", d.toString().trimEnd()));
    child.stderr.on("data", (d) => log("migrate", "ERR " + d.toString().trimEnd()));
    child.on("exit", (code) => {
      log("migrate", code === 0 ? "迁移完成" : "迁移失败(不影响已存在的数据库)");
      resolve(code === 0);
    });
  });
}

function superviseServer() {
  if (stopping) return;
  const child = run("server", NODE_BIN, [SERVER_JS], {
    PORT: String(cfg.port),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: DB_URL,
  });
  child.on("exit", (code) => {
    children.delete("server");
    if (stopping) return;
    log("manager", `服务器退出 code=${code},5 秒后重启`);
    setTimeout(superviseServer, 5000);
  });
}

function superviseBot() {
  if (stopping) return;
  botStartedAt = Date.now();
  const child = run("bot", NODE_BIN, [TSCLI, path.join("bot", "index.ts")], {
    WXQR_PNG: path.join(ROOT, "login-qr.png"),
    DATABASE_URL: DB_URL,
  });
  child.on("exit", (code) => {
    children.delete("bot");
    if (stopping) return;
    if (Date.now() - botStartedAt > 60000) botBackoff = 1000; // 撑过 1 分钟就重置退避
    log("manager", `微信 bot 退出 code=${code},${botBackoff / 1000} 秒后重启`);
    setTimeout(() => { superviseBot(); }, botBackoff);
    botBackoff = Math.min(botBackoff * 2, 30000);
  });
}

function openBrowser(port) {
  try {
    exec(`start "" "http://127.0.0.1:${port}"`);
    log("manager", "已为你打开后台页面");
  } catch (e) {
    log("manager", "打开浏览器失败:" + e.message);
  }
}

function shutdown() {
  stopping = true;
  log("manager", "正在停止(会同时结束服务器和 bot)…");
  for (const child of children.values()) {
    try { exec(`taskkill /pid ${child.pid} /T /F`, () => {}); } catch {}
  }
  setTimeout(() => process.exit(0), 800);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  ensureDirs();
  log("manager", "AI客户经营助手 正在启动…");

  // 已在运行:只打开浏览器,然后退出(防重复实例,兼顾开机自启 + 手动双击)
  for (let i = 0; i < 10; i++) {
    if (await healthOk(cfg.port + i)) {
      if (!SHELL) openBrowser(cfg.port + i);
      return;
    }
  }

  backupDb();
  await runMigrate();

  // 挑一个空闲端口
  let port = cfg.port;
  for (let i = 0; i < 10; i++) {
    if (await portFree(port + i)) { port += i; break; }
  }
  cfg.port = port;
  saveConfig();
  log("manager", `使用端口 ${port}`);

  superviseServer();
  if (await waitHealthy(port)) {
    if (cfg.openBrowser && !SHELL) openBrowser(port);
  } else {
    log("manager", `后台启动超时,请查看 data/logs/server-*.log(如端口被长期占用,可改 config.json 的 port)`);
  }

  if (cfg.bot) superviseBot();
}

main().catch((e) => {
  log("manager", "启动失败:" + (e && e.message ? e.message : e));
  process.exit(1);
});
