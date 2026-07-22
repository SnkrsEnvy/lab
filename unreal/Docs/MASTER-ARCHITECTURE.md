# Locked Master Architecture

## Hero engine

**Unreal Engine 5.8** is the hero renderer.

### Core visual systems

- Lumen dynamic global illumination and reflections
- hardware ray tracing through DirectX 12 / Shader Model 6
- Nanite-ready station geometry
- Virtual Shadow Maps
- Temporal Super Resolution
- clear-coat marble
- cloth-shaded camel velvet
- physically modeled tray ceiling and cove light geometry
- path tracing for cinematic stills

## Delivery architecture

### Master Walk

A packaged Windows Unreal application running Lumen and the grounded first-person core.

### Cinematic Limit

A path-traced or highly accumulated mode used for hero images and quality-ceiling evaluation. It may render slowly; visual quality is the priority.

### Immersive Web App

Pixel Streaming 2 runs the packaged Unreal application on a GPU computer or cloud GPU and sends the rendered stream to a browser over WebRTC. Keyboard, mouse, touch and gamepad input return to Unreal.

## Separation of concerns

- `GrandCoreCharacter`: movement, camera and interaction
- `GrandCorePlayerController`: desktop/mobile input
- `GrandStation`: base for future stations and objects
- `build_master_shell.py`: generated architectural shell
- material source maps: replaceable without changing movement
- Pixel Streaming frontend: replaceable without changing Unreal world logic

This keeps the engine stable while the world can evolve station by station.
