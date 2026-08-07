// scripts/prepare-package.mjs — 组装 Windows 单机版安装目录到 build/package
// 用法:
//   node scripts/prepare-package.mjs              # CI/出安装包前(含便携 Node 下载)
//   node scripts/prepare-package.mjs --skip-node  # 本机快速测试(用系统 Node)
import { execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync, readdirSync, copyFileSync, realpathSync, statSync } from "node:fs";
import { get } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const OUT = join(ROOT, "build", "package");
const NODE_MAJOR = 22;
const SKIP_NODE = process.argv.includes("--skip-node");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const standalone = join(ROOT, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  throw new Error("缺少 .next/standalone/server.js —— 请先 npm run build");
}

// 1) Next 生产服务器(standalone)
copyDir(standalone, join(OUT, "app"));
copyDir(join(ROOT, ".next", "static"), join(OUT, "app", ".next", "static"));
copyDir(join(ROOT, "public"), join(OUT, "app", "public"));

// Prisma 加载引擎 DLL 时会留下 *.node.tmp<pid> 临时拷贝,清掉不打包
cleanPrismaTmp(join(OUT, "app", "node_modules", ".prisma", "client"));
cleanPrismaTmp(join(OUT, "node_modules", ".prisma", "client"));
cleanPrismaTmp(join(ROOT, ".next", "standalone", "node_modules", ".prisma", "client"));
cleanPrismaTmp(join(ROOT, "node_modules", ".prisma", "client"));

// 2) bot / migrate 运行所需
copyDir(join(ROOT, "node_modules"), join(OUT, "node_modules"));
copyDir(join(ROOT, "bot"), join(OUT, "bot"));
copyDir(join(ROOT, "lib"), join(OUT, "lib"));
copyDir(join(ROOT, "prisma"), join(OUT, "prisma"));

for (const f of ["package.json", "prisma.config.ts", "tsconfig.json", "manager.js", "launch-hidden.vbs", "start-manager.bat"]) {
  copyFile(join(ROOT, f), join(OUT, f));
}

// Tauri 桌面壳(exe 由 npx tauri build --no-bundle 产出;本地没编 Rust 时跳过,不影响纯浏览器版)
const shellExe = join(ROOT, "src-tauri", "target", "release", "ai-kehu-shell.exe");
if (existsSync(shellExe)) {
  copyFile(shellExe, join(OUT, "ai-kehu-shell.exe"));
  const loader = join(ROOT, "src-tauri", "target", "release", "WebView2Loader.dll");
  if (existsSync(loader)) copyFile(loader, join(OUT, "WebView2Loader.dll"));
} else {
  console.warn("未找到 src-tauri/target/release/ai-kehu-shell.exe,安装包将不含桌面壳(仅浏览器版)");
}

// 3) 便携 Node(win-x64,~30MB);--skip-node 时跳过
if (!SKIP_NODE) {
  const version = await latestNodeVersion(NODE_MAJOR);
  console.log(`下载便携 Node v${version}(win-x64)…`);
  const zip = join(tmpdir(), `node-${version}-win-x64.zip`);
  await download(`https://nodejs.org/dist/v${version}/node-v${version}-win-x64.zip`, zip);
  const runtime = join(OUT, "runtime");
  execSync(`powershell -NoProfile -Command "Expand-Archive -Force '${zip}' -DestinationPath '${runtime}'"`);
  const inner = join(runtime, `node-v${version}-win-x64`);
  copyDir(inner, join(runtime, "node"));
  rmSync(inner, { recursive: true, force: true });
}

// 测试产生的 data/(dev.db、日志)绝不进安装包,首启由 manager 重新 migrate
rmSync(join(OUT, "data"), { recursive: true, force: true });

// WebView2 Evergreen Bootstrapper(旧系统缺 WebView2 时安装包引导用;下载失败不阻断)
try {
  const wv2 = join(OUT, "MicrosoftEdgeWebview2Setup.exe");
  if (!existsSync(wv2)) {
    console.log("下载 WebView2 引导程序…");
    await download("https://go.microsoft.com/fwlink/p/?LinkId=2124703", wv2);
  }
} catch (e) {
  console.warn("WebView2 引导程序下载失败(无 WebView2 的机器将无法启动壳):", e.message);
}

console.log("组装完成:", OUT);

// ---------- 工具函数 ----------

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      // 符号链接解引用成真实文件/目录:复制链接本体在商家机器上是断链/会 EPERM
      let target;
      try { target = realpathSync(s); } catch { continue; }
      if (statSync(target).isDirectory()) copyDir(target, d);
      else copyFile(target, d);
      continue;
    }
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}
function copyFile(s, d) {
  mkdirSync(resolve(d, ".."), { recursive: true });
  copyFileSync(s, d);
}
function cleanPrismaTmp(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (f.includes(".node.tmp")) rmSync(join(dir, f), { force: true });
  }
}
async function latestNodeVersion(major) {
  const text = await getText("https://nodejs.org/dist/index.json");
  for (const item of JSON.parse(text)) {
    if (item.version.startsWith(`v${major}.`) && item.lts) return item.version.slice(1);
  }
  throw new Error(`没找到 v${major} LTS`);
}
function getText(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        getText(res.headers.location).then(resolve, reject);
        return;
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      const ws = createWriteStream(dest);
      res.pipe(ws);
      ws.on("finish", () => ws.close(() => resolve()));
      ws.on("error", reject);
    }).on("error", reject);
  });
}
