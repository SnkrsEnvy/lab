@echo off
setlocal EnableExtensions

title GRAND CORE - DIRECT UNREAL EDITOR BUILD
color 0A

echo ============================================================
echo GRAND CORE - DIRECT UNREAL ENGINE 5.8 EDITOR BUILD
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "BUILD=%ENGINE%\Engine\Build\BatchFiles\Build.bat"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo.
  echo Put BUILD-GRANDCORE-EDITOR.cmd directly inside:
  echo lab\unreal
  echo.
  pause
  exit /b 1
)

if not exist "%BUILD%" (
  echo ERROR: Unreal Engine 5.8 Build.bat was not found at:
  echo %BUILD%
  echo.
  echo Confirm Unreal Engine 5.8 is installed in:
  echo C:\Program Files\Epic Games\UE_5.8
  echo.
  pause
  exit /b 1
)

echo Project:
echo %PROJECT%
echo.
echo Engine:
echo %ENGINE%
echo.
echo Building GrandCoreEditor - Development - Win64...
echo This can take several minutes.
echo.

call "%BUILD%" GrandCoreEditor Win64 Development -Project="%PROJECT%" -WaitMutex -NoHotReloadFromIDE

set "RESULT=%ERRORLEVEL%"
echo.
echo ============================================================

if "%RESULT%"=="0" (
  echo BUILD SUCCEEDED
  echo ============================================================
  echo.
  echo You may now open GrandCore.uproject in Unreal Engine.
) else (
  echo BUILD FAILED - EXIT CODE %RESULT%
  echo ============================================================
  echo.
  echo Scroll upward to the FIRST line containing "error C" or "error:".
  echo Take a screenshot of that first error and send it to ChatGPT.
)

echo.
pause
exit /b %RESULT%
