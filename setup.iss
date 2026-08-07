; AI客户经营助手 Windows 安装脚本(Inno Setup 6)
; 先跑 npm run build && npm run pack,再用:
;   ISCC.exe /DMyAppVersion=0.2.0 setup.iss
; 产物:release\ai-kehu-setup-0.2.0.exe

#define MyAppName "AI客户经营助手"
#ifndef MyAppVersion
  #define MyAppVersion "0.2.0"
#endif

[Setup]
AppId={{A7E3F1C2-4D5B-4A1E-9C8F-2B6D4E7F1A32}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={localappdata}\ai-kehu
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
OutputDir=release
OutputBaseFilename=ai-kehu-setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
UninstallDisplayIcon={app}\ai-kehu-shell.exe

[Languages]
Name: "chinesesimplified"; MessagesFile: "ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "在桌面创建快捷方式"; GroupDescription: "附加图标:"

[Files]
Source: "build\package\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "AI客户经营助手"; ValueData: """""{app}\ai-kehu-shell.exe"""" --start-minimized"; Flags: uninsdeletevalue

[Icons]
Name: "{autodesktop}\AI客户经营助手"; Filename: "{app}\ai-kehu-shell.exe"; Tasks: desktopicon
Name: "{autoprograms}\AI客户经营助手"; Filename: "{app}\ai-kehu-shell.exe"

[Run]
; 旧系统缺 WebView2 运行时:先引导安装(下载失败或已安装则跳过),再启动壳
Filename: "{app}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "正在安装 WebView2 运行时…"; Check: not IsWebView2Installed and FileExists(ExpandConstant('{app}\MicrosoftEdgeWebview2Setup.exe')); Flags: skipifdoesntexist
Filename: "{app}\ai-kehu-shell.exe"; Flags: nowait postinstall skipifsilent

[Code]
function IsWebView2Installed(): Boolean;
var
  V: String;
begin
  Result := RegQueryStringValue(HKLM64, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', V);
  if not Result then
    Result := RegQueryStringValue(HKLM32, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', V);
end;
