@echo off
setlocal EnableExtensions

title GRAND CORE - UE 5.8 BUILD SETTINGS V7 FIX
color 0A

echo ============================================================
echo GRAND CORE - UNREAL ENGINE 5.8 BUILD SETTINGS V7 FIX
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "GAME_TARGET=%~dp0Source\GrandCore.Target.cs"
set "EDITOR_TARGET=%~dp0Source\GrandCoreEditor.Target.cs"
set "BACKUP=%~dp0SourceBackup_Before_V7_Fix"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo Put this file directly inside GrandCoreRepo\lab\unreal
  pause
  exit /b 1
)

if not exist "%GAME_TARGET%" (
  echo ERROR: Source\GrandCore.Target.cs was not found.
  pause
  exit /b 1
)

if not exist "%EDITOR_TARGET%" (
  echo ERROR: Source\GrandCoreEditor.Target.cs was not found.
  pause
  exit /b 1
)

echo Backing up target files...
if not exist "%BACKUP%" mkdir "%BACKUP%"
copy /Y "%GAME_TARGET%" "%BACKUP%\GrandCore.Target.cs" >nul
copy /Y "%EDITOR_TARGET%" "%BACKUP%\GrandCoreEditor.Target.cs" >nul

echo Updating BuildSettingsVersion.V6 to BuildSettingsVersion.V7...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$paths=@('%GAME_TARGET%','%EDITOR_TARGET%'); foreach($p in $paths){ $c=[IO.File]::ReadAllText($p); if($c -notmatch 'BuildSettingsVersion\.V6' -and $c -notmatch 'BuildSettingsVersion\.V7'){ throw ('Expected build settings line not found in '+$p) }; $c=$c -replace 'BuildSettingsVersion\.V6','BuildSettingsVersion.V7'; [IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false))) }"

if errorlevel 1 (
  echo ERROR: The target files could not be updated.
  pause
  exit /b 1
)

findstr /C:"BuildSettingsVersion.V7" "%GAME_TARGET%" >nul || (
  echo ERROR: GrandCore.Target.cs was not updated to V7.
  pause
  exit /b 1
)

findstr /C:"BuildSettingsVersion.V7" "%EDITOR_TARGET%" >nul || (
  echo ERROR: GrandCoreEditor.Target.cs was not updated to V7.
  pause
  exit /b 1
)

echo Removing stale Unreal build products...
if exist "%~dp0Binaries" rmdir /S /Q "%~dp0Binaries"
if exist "%~dp0Intermediate" rmdir /S /Q "%~dp0Intermediate"
if exist "%~dp0.vs" rmdir /S /Q "%~dp0.vs"

echo.
echo ============================================================
echo BUILD SETTINGS V7 FIX APPLIED SUCCESSFULLY
echo ============================================================
echo.
echo Next:
echo 1. Close this window.
echo 2. Double-click BUILD-GRANDCORE-EDITOR.cmd in this same folder.
echo 3. Wait for BUILD SUCCEEDED or send the first new error.
echo.
pause
exit /b 0
