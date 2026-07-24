@echo off
setlocal EnableExtensions

title GRAND CORE - UE 5.8 TEXTURE FILTER FIX V2
color 0A

echo ============================================================
echo GRAND CORE - UE 5.8 TEXTURE FILTER FIX V2
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "SCRIPT=%~dp0Scripts\build_master_shell.py"
set "BACKUP=%~dp0ScriptsBackup_Before_TextureFilter_Fix_V2"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo.
  echo Put APPLY-TEXTUREFILTER-UE58-FIX-V2.cmd directly inside:
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

echo Replacing unreal.TextureFilter.TF_ANISOTROPIC with TF_DEFAULT...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%SCRIPT%';" ^
  "$c=[IO.File]::ReadAllText($p);" ^
  "$old='unreal.TextureFilter.TF_ANISOTROPIC';" ^
  "$new='unreal.TextureFilter.TF_DEFAULT';" ^
  "if($c.Contains($old)){ $c=$c.Replace($old,$new); [IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false))); Write-Host 'Replacement applied.' }" ^
  "elseif($c.Contains('unreal.TextureFilter.TF_DEFAULT')){ Write-Host 'The script is already patched.' }" ^
  "else { throw 'Neither TF_ANISOTROPIC nor the expected TF_DEFAULT replacement was found.' }"

if errorlevel 1 (
  echo.
  echo ERROR: The Python shell builder could not be updated.
  echo Backup:
  echo %BACKUP%
  echo.
  pause
  exit /b 1
)

findstr /C:"unreal.TextureFilter.TF_ANISOTROPIC" "%SCRIPT%" >nul && (
  echo ERROR: TF_ANISOTROPIC still remains in the Python file.
  pause
  exit /b 1
)

findstr /C:"unreal.TextureFilter.TF_DEFAULT" "%SCRIPT%" >nul || (
  echo ERROR: TF_DEFAULT could not be verified in the Python file.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo TEXTURE FILTER UE 5.8 FIX V2 APPLIED SUCCESSFULLY
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
