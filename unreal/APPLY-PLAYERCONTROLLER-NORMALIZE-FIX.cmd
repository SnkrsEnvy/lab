@echo off
setlocal EnableExtensions

title GRAND CORE - PLAYER CONTROLLER NORMALIZE FIX
color 0A

echo ============================================================
echo GRAND CORE - PLAYER CONTROLLER NORMALIZE FIX
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "SOURCE=%~dp0Source\GrandCore\GrandCorePlayerController.cpp"
set "BACKUP=%~dp0SourceBackup_Before_PlayerController_Normalize_Fix"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo.
  echo Put APPLY-PLAYERCONTROLLER-NORMALIZE-FIX.cmd directly inside:
  echo GrandCoreRepo\lab\unreal
  echo.
  pause
  exit /b 1
)

if not exist "%SOURCE%" (
  echo ERROR: Source\GrandCore\GrandCorePlayerController.cpp was not found.
  pause
  exit /b 1
)

echo Project:
echo %~dp0
echo.
echo Backing up GrandCorePlayerController.cpp...
if not exist "%BACKUP%" mkdir "%BACKUP%"
copy /Y "%SOURCE%" "%BACKUP%\GrandCorePlayerController.cpp" >nul

echo Normalizing repeated GrandCoreCharacter identifiers...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%SOURCE%';" ^
  "$c=[IO.File]::ReadAllText($p);" ^
  "$c=[regex]::Replace($c,'(?:GrandCore)+Character','GrandCoreCharacter');" ^
  "$c=[regex]::Replace($c,'if\s*\(\s*!Character\s*\)','if (!GrandCoreCharacter)');" ^
  "$c=$c.Replace('Character->SetTouchMove','GrandCoreCharacter->SetTouchMove');" ^
  "$c=$c.Replace('Character->SetTouchLook','GrandCoreCharacter->SetTouchLook');" ^
  "$c=$c.Replace('Character->ClearTouchMove','GrandCoreCharacter->ClearTouchMove');" ^
  "$c=$c.Replace('Character->ClearTouchLook','GrandCoreCharacter->ClearTouchLook');" ^
  "$c=[regex]::Replace($c,'(?:GrandCore)+Character','GrandCoreCharacter');" ^
  "[IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false)));"

if errorlevel 1 (
  echo.
  echo ERROR: The source file could not be updated.
  echo Backup:
  echo %BACKUP%
  echo.
  pause
  exit /b 1
)

findstr /C:"GrandCoreGrandCoreCharacter" "%SOURCE%" >nul && (
  echo ERROR: A repeated GrandCoreCharacter identifier still remains.
  pause
  exit /b 1
)

findstr /C:"GrandCoreGrandCoreGrandCoreCharacter" "%SOURCE%" >nul && (
  echo ERROR: A tripled GrandCoreCharacter identifier still remains.
  pause
  exit /b 1
)

findstr /C:"AGrandCoreCharacter* GrandCoreCharacter" "%SOURCE%" >nul || (
  echo ERROR: The expected GrandCoreCharacter declaration was not found.
  pause
  exit /b 1
)

findstr /C:"if (!GrandCoreCharacter)" "%SOURCE%" >nul || (
  echo ERROR: The corrected null check was not found.
  pause
  exit /b 1
)

echo Removing stale Unreal build products...
if exist "%~dp0Binaries" rmdir /S /Q "%~dp0Binaries"
if exist "%~dp0Intermediate" rmdir /S /Q "%~dp0Intermediate"

echo.
echo ============================================================
echo PLAYER CONTROLLER NORMALIZE FIX APPLIED SUCCESSFULLY
echo ============================================================
echo.
echo Next:
echo 1. Close this window.
echo 2. Double-click BUILD-GRANDCORE-EDITOR.cmd.
echo 3. Wait for BUILD SUCCEEDED or send the first new red error.
echo.
pause
exit /b 0
