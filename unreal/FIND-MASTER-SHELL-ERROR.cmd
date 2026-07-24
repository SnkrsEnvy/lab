@echo off
setlocal EnableExtensions EnableDelayedExpansion

title GRAND CORE - MASTER SHELL LOG ERROR FINDER
color 0A

echo ============================================================
echo GRAND CORE - MASTER SHELL LOG ERROR FINDER
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "LOGDIR=%~dp0Saved\Logs"
set "OUT=%~dp0GRANDCORE_MASTER_SHELL_ERRORS.txt"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo.
  echo Put FIND-MASTER-SHELL-ERROR.cmd directly inside:
  echo GrandCoreRepo\lab\unreal
  echo.
  pause
  exit /b 1
)

if not exist "%LOGDIR%" (
  echo ERROR: Saved\Logs was not found.
  echo Run BUILD-AND-OPEN-GRANDCORE-SHELL.cmd once, then run this tool again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%F in ('dir /b /a-d /o-d "%LOGDIR%\*.log" 2^>nul') do (
  set "NEWEST=%LOGDIR%\%%F"
  goto :found
)

echo ERROR: No Unreal .log files were found inside:
echo %LOGDIR%
echo.
pause
exit /b 1

:found
echo Newest Unreal log:
echo !NEWEST!
echo.
echo Extracting Python exceptions and shell-build failures...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$log='!NEWEST!'; $out='%OUT%';" ^
  "$lines=Get-Content -LiteralPath $log;" ^
  "$patterns='Traceback|LogPython.*Error|PythonScript|Exception|Fatal error|Assertion failed|ensure condition failed|Script Msg|Error:|\[GrandCore\]';" ^
  "$hits=for($i=0;$i -lt $lines.Count;$i++){ if($lines[$i] -match $patterns){ [pscustomobject]@{Index=$i;Line=$lines[$i]} } };" ^
  "$sb=New-Object Text.StringBuilder;" ^
  "[void]$sb.AppendLine('GRAND CORE MASTER SHELL ERROR REPORT');" ^
  "[void]$sb.AppendLine('Source log: '+$log);" ^
  "[void]$sb.AppendLine('');" ^
  "if(-not $hits){ [void]$sb.AppendLine('No standard error pattern was found. The final 250 log lines are included below.'); [void]$sb.AppendLine(''); $start=[Math]::Max(0,$lines.Count-250); for($j=$start;$j -lt $lines.Count;$j++){ [void]$sb.AppendLine(('{0,6}: {1}' -f ($j+1),$lines[$j])); } } else {" ^
  "  $selected=$hits | Select-Object -First 25;" ^
  "  $shown=@{};" ^
  "  foreach($h in $selected){" ^
  "    $start=[Math]::Max(0,$h.Index-8); $end=[Math]::Min($lines.Count-1,$h.Index+16);" ^
  "    if(-not $shown.ContainsKey($start)){" ^
  "      $shown[$start]=$true;" ^
  "      [void]$sb.AppendLine(('='*78));" ^
  "      [void]$sb.AppendLine(('MATCH NEAR LOG LINE '+($h.Index+1)));" ^
  "      for($j=$start;$j -le $end;$j++){ [void]$sb.AppendLine(('{0,6}: {1}' -f ($j+1),$lines[$j])); }" ^
  "      [void]$sb.AppendLine('');" ^
  "    }" ^
  "  }" ^
  "  [void]$sb.AppendLine(('='*78));" ^
  "  [void]$sb.AppendLine('FINAL 180 LOG LINES');" ^
  "  $tail=[Math]::Max(0,$lines.Count-180);" ^
  "  for($j=$tail;$j -lt $lines.Count;$j++){ [void]$sb.AppendLine(('{0,6}: {1}' -f ($j+1),$lines[$j])); }" ^
  "}" ^
  "[IO.File]::WriteAllText($out,$sb.ToString(),(New-Object Text.UTF8Encoding($false)));"

if errorlevel 1 (
  echo ERROR: Could not analyze the Unreal log.
  pause
  exit /b 1
)

echo.
echo Created:
echo %OUT%
echo.
echo Opening the report in Notepad...
start "" notepad.exe "%OUT%"
echo.
echo Send ChatGPT a screenshot of the FIRST MATCH section that contains
echo Traceback, LogPython Error, Exception, or Error.
echo.
pause
exit /b 0
