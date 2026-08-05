@echo off
setlocal EnableExtensions
set "RUNNER_ROOT=C:\actions-runner-hcl-pod"

if not exist "%RUNNER_ROOT%\run.cmd" (
  echo ERROR: GitHub Actions runner was not found at %RUNNER_ROOT%.
  echo Run Register-HCLPodUE58Runner.ps1 first.
  pause
  exit /b 1
)

cd /d "%RUNNER_ROOT%"
title HCL POD UE5.8 GitHub Runner
call run.cmd
