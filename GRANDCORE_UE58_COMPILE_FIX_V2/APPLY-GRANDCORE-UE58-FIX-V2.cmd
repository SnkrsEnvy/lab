@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo GRAND CORE - UNREAL ENGINE 5.8 COMPILE REPAIR V2
echo ============================================================
echo.

set "PROJECT_ROOT="

rem Supports all likely placements:
rem 1) script directly in lab beside unreal
rem 2) script inside lab\GRANDCORE_UE58_COMPILE_FIX_V2
rem 3) script directly inside unreal
for %%P in ("%CD%" "%CD%\.." "%CD%\..\..") do (
  if not defined PROJECT_ROOT if exist "%%~fP\unreal\GrandCore.uproject" set "PROJECT_ROOT=%%~fP\unreal"
  if not defined PROJECT_ROOT if exist "%%~fP\GrandCore.uproject" set "PROJECT_ROOT=%%~fP"
)

if not defined PROJECT_ROOT (
  echo ERROR: GrandCore.uproject was not found.
  echo.
  echo Put the extracted GRANDCORE_UE58_COMPILE_FIX_V2 folder inside:
  echo   GrandCoreRepo\lab
  echo so it sits beside the unreal and web folders.
  echo.
  echo Expected project file:
  echo   GrandCoreRepo\lab\unreal\GrandCore.uproject
  echo.
  pause
  exit /b 1
)

set "SOURCE_DIR=%PROJECT_ROOT%\Source\GrandCore"
if not exist "%SOURCE_DIR%" (
  echo ERROR: %SOURCE_DIR% was not found.
  pause
  exit /b 1
)

if not exist "%CD%\repair\GrandCorePlayerController.h" (
  echo ERROR: The repair files are missing from %CD%\repair
  echo Extract the entire ZIP before running this script.
  pause
  exit /b 1
)

echo Project: %PROJECT_ROOT%
echo Backing up the original source files...
if not exist "%PROJECT_ROOT%\SourceBackup_Before_UE58_Fix" mkdir "%PROJECT_ROOT%\SourceBackup_Before_UE58_Fix"
copy /Y "%SOURCE_DIR%\GrandCorePlayerController.h" "%PROJECT_ROOT%\SourceBackup_Before_UE58_Fix\" >nul
copy /Y "%SOURCE_DIR%\GrandCorePlayerController.cpp" "%PROJECT_ROOT%\SourceBackup_Before_UE58_Fix\" >nul
copy /Y "%SOURCE_DIR%\GrandCoreHUD.cpp" "%PROJECT_ROOT%\SourceBackup_Before_UE58_Fix\" >nul

echo Applying Unreal 5.8 API corrections...
copy /Y "%CD%\repair\GrandCorePlayerController.h" "%SOURCE_DIR%\GrandCorePlayerController.h" >nul
copy /Y "%CD%\repair\GrandCorePlayerController.cpp" "%SOURCE_DIR%\GrandCorePlayerController.cpp" >nul
copy /Y "%CD%\repair\GrandCoreHUD.cpp" "%SOURCE_DIR%\GrandCoreHUD.cpp" >nul

echo Removing stale generated build folders...
if exist "%PROJECT_ROOT%\Binaries" rmdir /S /Q "%PROJECT_ROOT%\Binaries"
if exist "%PROJECT_ROOT%\Intermediate" rmdir /S /Q "%PROJECT_ROOT%\Intermediate"
if exist "%PROJECT_ROOT%\.vs" rmdir /S /Q "%PROJECT_ROOT%\.vs"

echo.
echo ============================================================
echo SOURCE REPAIR APPLIED SUCCESSFULLY
echo ============================================================
echo.
echo Next:
echo 1. Open the unreal folder shown above.
echo 2. Right-click GrandCore.uproject.
echo 3. Choose Generate Visual Studio project files.
echo 4. Open GrandCore.sln.
echo 5. Select Development Editor and Win64.
echo 6. Build Solution.
echo.
pause
