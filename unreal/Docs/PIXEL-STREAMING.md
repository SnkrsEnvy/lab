# Pixel Streaming 2 Delivery Plan

## Purpose

Run the high-fidelity Unreal application on an NVIDIA GPU and make it available through one HTTPS browser link. The visitor receives video/audio and sends keyboard, mouse, touch or gamepad input back to Unreal.

## Local proof

1. Package the project with `PACKAGE-MASTER-WALK.cmd`.
2. Acquire the Pixel Streaming Infrastructure branch compatible with Unreal 5.8.
3. Start the signalling/web server.
4. Launch the packaged app with:

```text
-RenderOffscreen -AudioMixer -PixelStreamingURL="ws://127.0.0.1:8888" -ForceRes -ResX=2560 -ResY=1440 -DX12
```

The template command is in `Scripts/RUN-PIXEL-STREAMING-TEMPLATE.cmd`.

## Production

A production deployment needs:

- GPU host with NVENC
- signalling and web frontend
- TLS/HTTPS
- TURN server for difficult networks
- session management
- health checks and automatic restart
- bitrate and resolution policy
- access controls if the world is private

## Custom frontend

The final CannaCardz/Golden Goose interface can sit around the Pixel Streaming player. GUIDE, GEAR, BOARD, FULL, booking and station panels can communicate with Unreal through Pixel Streaming data channels.
