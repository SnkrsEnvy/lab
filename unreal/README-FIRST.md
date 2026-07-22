# Grand Core — Unreal Master v1

This is the locked maximum-quality production foundation for the immersive open-world room.

## What this package is

A real Unreal Engine 5.8 C++ project seed with:

- an exact 80 ft × 40 ft × 20 ft architectural shell
- one 4 ft × 8 ft door in the left short wall
- marble, camel velvet, ivory plaster and bronze PBR source maps
- automated Unreal Editor construction script
- first-person grounded movement
- mouse, keyboard, touch and gamepad input
- interaction-ready station base class
- on-screen renderer/GPU/FPS diagnostics
- Lumen, Nanite, Virtual Shadow Maps, TSR and hardware ray tracing settings
- Pixel Streaming 2 enabled for browser delivery
- Master Walk and Cinematic Limit profiles

## Important truth

This project was generated and structurally checked in a container that does not have Unreal Engine installed. Therefore it has **not been compiled or visually rendered inside Unreal here**. The first real compile and shader build happens on your Windows computer after Unreal Engine 5.8 and Visual Studio are installed.

## First run

1. Install **Unreal Engine 5.8** through Epic Games Launcher.
2. Install **Visual Studio 2022 Community** with:
   - Desktop development with C++
   - Game development with C++
   - Windows 11 SDK
3. Plug in the Surface and set Windows power mode to **Best performance**.
4. Force UnrealEditor.exe to use the NVIDIA RTX 3050 Ti in Windows Graphics settings.
5. Extract this project to a short path such as:

   `C:\GrandCore`

6. Double-click:

   `SETUP-GRAND-CORE.cmd`

The setup script generates project files, compiles the runtime core, runs the Unreal Python shell builder, and opens the finished level.

## Inside Unreal

- Wait for shader compilation to finish.
- Open `/Game/GrandCore/Maps/L_MasterShell` if it is not already open.
- Press **Play**.
- Move with WASD and mouse.
- Hold Shift to sprint.
- Press F3 to show/hide the hardware diagnostic panel.

## Key files

- `Scripts/build_master_shell.py` — creates the shell, materials, lights, cameras and post process
- `Source/GrandCore/GrandCoreCharacter.*` — movement and interaction core
- `Source/GrandCore/GrandStation.*` — future station/object API
- `Config/ConsoleVariables.ini` — Master Walk renderer settings
- `Scripts/Cinematic-Limit-CVars.txt` — maximum still/cinematic settings
- `ContentSource/Textures/` — high-resolution PBR source maps
- `ContentSource/Geometry/GrandCore_MasterShell.glb` — exact shell geometry reference

## Saved baseline

The earlier web build named **function** remains conceptually preserved as the movement/UI reference. This Unreal project is the new hero-engine branch and does not overwrite that baseline.
