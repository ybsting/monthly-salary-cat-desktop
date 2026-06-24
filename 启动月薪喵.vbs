Option Explicit

Dim shell, fso, projectRoot, logDir, logFile, startScript, command, exitCode

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectRoot = fso.GetParentFolderName(WScript.ScriptFullName)
logDir = fso.BuildPath(projectRoot, "logs")
logFile = fso.BuildPath(logDir, "desktop-start.log")
startScript = fso.BuildPath(projectRoot, "scripts\start-background.ps1")

If Not fso.FolderExists(logDir) Then
  fso.CreateFolder(logDir)
End If

If Not fso.FileExists(startScript) Then
  AppendLog "Missing PowerShell launcher: " & startScript
  MsgBox "Monthly Salary Meow failed to start." & vbCrLf & "Missing scripts\start-background.ps1" & vbCrLf & vbCrLf & "See logs\desktop-start.log.", vbExclamation, "Monthly Salary Meow"
  WScript.Quit 1
End If

AppendLog "Delegating hidden desktop launch to scripts\start-background.ps1."
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & Quote(startScript)
exitCode = shell.Run(command, 0, True)

If exitCode <> 0 Then
  AppendLog "PowerShell launcher failed with exit code " & CStr(exitCode)
  MsgBox "Monthly Salary Meow failed to start." & vbCrLf & "PowerShell launcher exit code: " & CStr(exitCode) & vbCrLf & vbCrLf & "See logs\desktop-start.log.", vbExclamation, "Monthly Salary Meow"
  WScript.Quit exitCode
End If

AppendLog "PowerShell launcher completed successfully."

Sub AppendLog(message)
  Dim file
  Set file = fso.OpenTextFile(logFile, 8, True)
  file.WriteLine "[" & Now & "] " & message
  file.Close
End Sub

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
