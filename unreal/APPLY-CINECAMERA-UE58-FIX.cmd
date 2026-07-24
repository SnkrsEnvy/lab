@echo off
setlocal EnableExtensions

title GRAND CORE - UE 5.8 CINE CAMERA API FIX
color 0A

echo ============================================================
echo GRAND CORE - UE 5.8 CINE CAMERA API FIX
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "SCRIPT=%~dp0Scripts\build_master_shell.py"
set "BACKUP=%~dp0ScriptsBackup_Before_CineCamera_Fix"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo.
  echo Put APPLY-CINECAMERA-UE58-FIX.cmd directly inside:
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

echo Replacing direct cine_camera_component access with UE 5.8 API calls...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%SCRIPT%';" ^
  "$c=[IO.File]::ReadAllText($p);" ^
  "$old='        safe_set(camera.cine_camera_component, ""current_focal_length"", 22.0)' + [Environment]::NewLine + '        safe_set(camera.cine_camera_component, ""current_aperture"", 5.6)' + [Environment]::NewLine + '        safe_set(camera.cine_camera_component, ""focus_settings"", camera.cine_camera_component.focus_settings)';" ^
  "$new='        camera_component = camera.get_cine_camera_component()' + [Environment]::NewLine + '        if camera_component:' + [Environment]::NewLine + '            safe_set(camera_component, ""current_focal_length"", 22.0)' + [Environment]::NewLine + '            safe_set(camera_component, ""current_aperture"", 5.6)';" ^
  "if($c.Contains($old)){ $c=$c.Replace($old,$new); [IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false))); Write-Host 'Replacement applied.' }" ^
  "elseif($c.Contains('camera.get_cine_camera_component()')){ Write-Host 'The script is already patched.' }" ^
  "else { throw 'Expected CineCamera block was not found.' }"

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
  echo ERROR: Direct cine_camera_component access still remains.
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
echo CINE CAMERA UE 5.8 FIX APPLIED SUCCESSFULLY
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
