@echo off
REM Run this after packaging and after starting the compatible Epic Pixel Streaming Infrastructure signalling server.
REM Replace the EXE path below with your packaged GrandCore.exe.
set "APP=%~dp0..\Builds\Windows\Windows\GrandCore.exe"
if not exist "%APP%" (
  echo Packaged application not found:
  echo %APP%
  echo Run PACKAGE-MASTER-WALK.cmd first, then update this path if needed.
  pause
  exit /b 1
)
start "Grand Core Pixel Stream" "%APP%" -RenderOffscreen -AudioMixer -PixelStreamingURL="ws://127.0.0.1:8888" -PixelStreamingEncoderCodec=AV1 -PixelStreamingEncoderTargetBitrate=50000000 -ForceRes -ResX=2560 -ResY=1440 -DX12
