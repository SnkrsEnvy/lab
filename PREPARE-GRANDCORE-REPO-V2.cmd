@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Grand Core Repository Preparation V2
color 0A

echo ============================================================
echo GRAND CORE - REPOSITORY PREPARATION V2
echo ============================================================
echo.
echo Current folder:
echo %CD%
echo.

if not exist ".git" (
  echo ERROR: This file is not inside the cloned GitHub repository root.
  echo.
  echo Put this file directly inside the lab folder beside:
  echo   .gitignore
  echo   web
  echo   unreal
  echo.
  pause
  exit /b 1
)

if not exist "unreal\GrandCore.uproject" (
  echo ERROR: unreal\GrandCore.uproject was not found.
  echo.
  echo Open the unreal folder and confirm GrandCore.uproject is directly inside it.
  echo It must not be inside another GrandCore_Unreal_Master_v1 folder.
  echo.
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git for Windows was not found.
  echo Reopen GitHub Desktop, then run this file again.
  pause
  exit /b 1
)

git lfs version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git LFS was not found.
  echo.
  echo Open Windows Terminal and run:
  echo   winget install -e --id GitHub.GitLFS
  echo.
  echo Then restart GitHub Desktop and run this file again.
  pause
  exit /b 1
)

echo [1/5] Installing Git LFS...
git lfs install
if errorlevel 1 goto :failed

echo [2/5] Tracking Unreal and high-resolution source assets...
git lfs track "unreal/**/*.uasset"
git lfs track "unreal/**/*.umap"
git lfs track "unreal/**/*.fbx"
git lfs track "unreal/**/*.glb"
git lfs track "unreal/**/*.exr"
git lfs track "unreal/**/*.hdr"
git lfs track "unreal/**/*.tif"
git lfs track "unreal/**/*.tiff"
git lfs track "unreal/**/*.psd"
git lfs track "unreal/**/*.png"
git lfs track "unreal/**/*.jpg"
git lfs track "unreal/**/*.jpeg"
if errorlevel 1 goto :failed

echo [3/5] Repairing the root .gitignore...
findstr /C:"# GRAND CORE UNREAL RULES" ".gitignore" >nul 2>&1
if errorlevel 1 (
  >>.gitignore echo.
  >>.gitignore echo # GRAND CORE UNREAL RULES
  >>.gitignore echo unreal/Binaries/
  >>.gitignore echo unreal/DerivedDataCache/
  >>.gitignore echo unreal/Intermediate/
  >>.gitignore echo unreal/Saved/
  >>.gitignore echo unreal/.vs/
  >>.gitignore echo unreal/*.sln
  >>.gitignore echo unreal/*.VC.db
  >>.gitignore echo unreal/*.VC.opendb
  >>.gitignore echo unreal/*.opensdf
  >>.gitignore echo unreal/*.sdf
  >>.gitignore echo unreal/*.suo
  >>.gitignore echo unreal/Plugins/**/Binaries/
  >>.gitignore echo unreal/Plugins/**/Intermediate/
  >>.gitignore echo Thumbs.db
  >>.gitignore echo Desktop.ini
  >>.gitignore echo .DS_Store
  echo Added Grand Core Unreal ignore rules.
) else (
  echo Grand Core Unreal ignore rules already present.
)

echo [4/5] Making sure Vercel has a browser entrance file...
if not exist "web" mkdir "web"
if not exist "web\index.html" (
  >"web\index.html" echo ^<!doctype html^>
  >>"web\index.html" echo ^<html lang="en"^>
  >>"web\index.html" echo ^<head^>
  >>"web\index.html" echo   ^<meta charset="utf-8" /^>
  >>"web\index.html" echo   ^<meta name="viewport" content="width=device-width, initial-scale=1" /^>
  >>"web\index.html" echo   ^<title^>Grand Core^</title^>
  >>"web\index.html" echo   ^<style^>html,body{height:100%%;margin:0;background:#080604;color:#f4e7d5;font-family:Arial,sans-serif}main{height:100%%;display:grid;place-items:center;text-align:center;padding:24px}h1{letter-spacing:.08em}p{opacity:.72}^</style^>
  >>"web\index.html" echo ^</head^>
  >>"web\index.html" echo ^<body^>^<main^>^<div^>^<h1^>GRAND CORE^</h1^>^<p^>Unreal Master and Pixel Streaming entrance under construction.^</p^>^</div^>^</main^>^</body^>
  >>"web\index.html" echo ^</html^>
  echo Created web\index.html.
) else (
  echo Existing web\index.html preserved.
)

echo [5/5] Checking repository status...
echo.
git status --short

echo.
echo ============================================================
echo SUCCESS
 echo ============================================================
echo.
echo NEXT:
echo 1. Press any key to close this window.
echo 2. Open GitHub Desktop.
echo 3. Confirm repository: SnkrsEnvy/lab.
echo 4. In Summary enter: Add Grand Core Unreal master project
echo 5. Click Commit to main.
echo 6. Click Push origin.
echo.
pause
exit /b 0

:failed
echo.
echo ERROR: Git or Git LFS preparation failed.
echo Take a screenshot of this window and send it in chat.
pause
exit /b 1
