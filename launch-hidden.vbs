' AI客户经营助手 隐藏启动器(开机自启 / 桌面图标调用)
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
node = dir & "\runtime\node\node.exe"
if Not fso.FileExists(node) Then node = "node"
shell.Run """" & node & """ """ & dir & "\manager.js""", 0, False
