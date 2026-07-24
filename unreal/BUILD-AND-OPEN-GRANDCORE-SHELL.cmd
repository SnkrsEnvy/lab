@echo off
setlocal EnableExtensions

title GRAND CORE - BUILD AND OPEN MASTER SHELL
color 0A

echo ============================================================
echo GRAND CORE - BUILD AND OPEN MASTER SHELL
echo ============================================================
echo.

set "PROJECT=%~dp0GrandCore.uproject"
set "PYTHON=%~dp0Scripts\build_master_shell.py"
set "ENGINE=C:\Program Files\Epic Games\UE_5.8"
set "EDITORCMD=%ENGINE%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
set "EDITOR=%ENGINE%\Engine\Binaries\Win64\UnrealEditor.exe"
set "MAP=/Game/GrandCore/Maps/L_MasterShell"

if not exist "%PROJECT%" (
  echo ERROR: GrandCore.uproject was not found beside this script.
  echo.
  echo Put BUILD-AND-OPEN-GRANDCORE-SHELL.cmd directly inside:
  echo GrandCoreRepo\lab\unreal
  echo.
  pause
  exit /b 1
)

if not exist "%PYTHON%" (
  echo ERROR: Scripts\build_master_shell.py was not found.
  echo.
  pause
  exit /b 1
)

if not exist "%EDITORCMD%" (
  echo ERROR: UnrealEditor-Cmd.exe was not found at:
  echo %EDITORCMD%
  echo.
  pause
  exit /b 1
)

echo Project:
echo %PROJECT%
echo.
echo Shell builder:
echo %PYTHON%
echo.
echo Generating the 80 x 40 x 20 ft Grand Core room...
echo Importing the high-resolution materials and constructing the level.
echo This can take several minutes.
echo.

call "%EDITORCMD%" "%PROJECT%" -run=pythonscript -script="%PYTHON%" -unattended -nop4 -nosplash -NoSound -stdout -FullStdOutLogOutput

set "RESULT=%ERRORLEVEL%"
echo.
echo ============================================================

if not "%RESULT%"=="0" (
  echo MASTER SHELL BUILD FAILED - EXIT CODE %RESULT%
  echo ============================================================
  echo.
  echo The detailed Unreal log is normally inside:
  echo %~dp0Saved\Logs
  echo.
  echo Send ChatGPT a screenshot of the FIRST red error above.
  echo.
  pause
  exit /b %RESULT%
)

echo MASTER SHELL GENERATED SUCCESSFULLY
echo ============================================================
echo.
echo Opening GrandCore in Unreal Editor...
echo The first launch may compile shaders for several minutes.
echo.

start "" "%EDITOR%" "%PROJECT%" "%MAP%" -log

echo GrandCore launch command sent successfully.
echo Wait for the Unreal Editor and shader compilation to finish.
echo.
pause
exit /b 0
