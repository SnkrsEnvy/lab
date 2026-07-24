@echo off
setlocal EnableExtensions

title GRAND CORE - UE 5.8 TEXTURE FILTER FIX
color 0A

echo ============================================================
echo GRAND CORE - UE 5.8 TEXTURE FILTER FIX
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "SCRIPT=%~dp0Scripts\build_master_shell.py"
set "BACKUP=%~dp0ScriptsBackup_Before_TextureFilter_Fix"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo.
  echo Put APPLY-TEXTUREFILTER-UE58-FIX.cmd directly inside:
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

echo Replacing unsupported TF_ANISOTROPIC with a UE 5.8-safe fallback...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%SCRIPT%';" ^
  "$c=[IO.File]::ReadAllText($p);" ^
  "$old='safe_set(texture, ""filter"", unreal.TextureFilter.TF_ANISOTROPIC)';" ^
  "$new='texture_filter = getattr(unreal.TextureFilter, ""TF_ANISOTROPIC"", unreal.TextureFilter.TF_DEFAULT)' + [Environment]::NewLine + '    safe_set(texture, ""filter"", texture_filter)';" ^
  "if($c.Contains($old)){ $c=$c.Replace($old,$new) } elseif($c -match 'texture_filter = getattr\(unreal\.TextureFilter'){ Write-Host 'The script is already patched.' } else { throw 'Expected TF_ANISOTROPIC line was not found.' };" ^
  "[IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false)));"

if errorlevel 1 (
  echo.
  echo ERROR: The Python shell builder could not be updated.
  echo Backup:
  echo %BACKUP%
  echo.
  pause
  exit /b 1
)

findstr /C:"texture_filter = getattr(unreal.TextureFilter" "%SCRIPT%" >nul || (
  echo ERROR: The TextureFilter correction could not be verified.
  pause
  exit /b 1
)

echo Removing stale generated shell output...
if exist "%~dp0Saved\Logs" (
  echo Existing logs preserved for reference.
)

echo.
echo ============================================================
echo TEXTURE FILTER UE 5.8 FIX APPLIED SUCCESSFULLY
echo ============================================================
echo.
echo Next:
echo 1. Close this window.
echo 2. Double-click BUILD-AND-OPEN-GRANDCORE-SHELL.cmd.
echo 3. Wait for MASTER SHELL GENERATED SUCCESSFULLY.
echo 4. If it fails, run FIND-MASTER-SHELL-ERROR.cmd again.
echo.
pause
exit /b 0
