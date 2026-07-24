@echo off
setlocal EnableExtensions

title GRAND CORE - UE 5.8 CINE CAMERA API FIX V2
color 0A

echo ============================================================
echo GRAND CORE - UE 5.8 CINE CAMERA API FIX V2
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "SCRIPT=%~dp0Scripts\build_master_shell.py"
set "BACKUP=%~dp0ScriptsBackup_Before_CineCamera_Fix_V2"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo.
  echo Put APPLY-CINECAMERA-UE58-FIX-V2.cmd directly inside:
  echo GrandCoreRepo\lab\unreal
  echo.
  pause
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo ERROR: Scripts\build_master_shell.py was not found.
  echo.
  pause
  exit /b 1
)

echo Project:
echo %~dp0
echo.
echo Backing up build_master_shell.py...
if not exist "%BACKUP%" mkdir "%BACKUP%"
copy /Y "%SCRIPT%" "%BACKUP%\build_master_shell.py" >nul

echo Replacing the CineCamera lines individually...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%SCRIPT%';" ^
  "$c=[IO.File]::ReadAllText($p);" ^
  "if($c.Contains('camera.get_cine_camera_component()')){ Write-Host 'The script is already patched.' } else {" ^
  "  $pattern1='(?m)^[ \t]*safe_set\(camera\.cine_camera_component,\s*[''\""]current_focal_length[''\""],\s*22\.0\)\s*$';" ^
  "  $replacement1='        camera_component = camera.get_cine_camera_component()' + [Environment]::NewLine + '        if camera_component:' + [Environment]::NewLine + '            safe_set(camera_component, ""current_focal_length"", 22.0)';" ^
  "  $c2=[regex]::Replace($c,$pattern1,$replacement1,1);" ^
  "  if($c2 -eq $c){ throw 'The focal-length camera line was not found.' };" ^
  "  $c=$c2;" ^
  "  $pattern2='(?m)^[ \t]*safe_set\(camera\.cine_camera_component,\s*[''\""]current_aperture[''\""],\s*5\.6\)\s*$';" ^
  "  $replacement2='            safe_set(camera_component, ""current_aperture"", 5.6)';" ^
  "  $c2=[regex]::Replace($c,$pattern2,$replacement2,1);" ^
  "  if($c2 -eq $c){ throw 'The aperture camera line was not found.' };" ^
  "  $c=$c2;" ^
  "  $pattern3='(?m)^[ \t]*safe_set\(camera\.cine_camera_component,\s*[''\""]focus_settings[''\""],\s*camera\.cine_camera_component\.focus_settings\)\s*\r?\n?';" ^
  "  $c=[regex]::Replace($c,$pattern3,'',1);" ^
  "  [IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false)));" ^
  "}"

if errorlevel 1 (
  echo.
  echo ERROR: The Python shell builder could not be updated.
  echo Backup:
  echo %BACKUP%
  echo.
  pause
  exit /b 1
)

findstr /C:"camera.cine_camera_component" "%SCRIPT%" >nul && (
  echo ERROR: Direct camera.cine_camera_component access still remains.
  echo Open Scripts\build_master_shell.py and send a screenshot around the camera lines.
  pause
  exit /b 1
)

findstr /C:"camera.get_cine_camera_component()" "%SCRIPT%" >nul || (
  echo ERROR: The corrected CineCamera API call could not be verified.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo CINE CAMERA UE 5.8 FIX V2 APPLIED SUCCESSFULLY
echo ============================================================
echo.
echo Next:
echo 1. Close this window.
echo 2. Double-click BUILD-AND-OPEN-GRANDCORE-SHELL.cmd.
echo 3. Wait for MASTER SHELL GENERATED SUCCESSFULLY.
echo 4. If it fails again, run FIND-MASTER-SHELL-ERROR.cmd.
echo.
pause
exit /b 0
