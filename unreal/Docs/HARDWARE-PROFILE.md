# Current Development Hardware Profile

Observed user hardware:

- Microsoft Surface Laptop Studio
- Intel Core i7
- 32 GB system memory
- Intel Iris Xe integrated graphics
- NVIDIA GeForce RTX 3050 Ti Laptop GPU
- DirectX 12
- browser WebGPU and WebGL hardware acceleration available

## Required setup

Assign these applications to the NVIDIA high-performance GPU in Windows Graphics settings:

- `UnrealEditor.exe`
- packaged `GrandCore.exe`
- Edge or Chrome only when testing browser-native builds

Use AC power and Windows Best performance mode.

## Expected role

The RTX 3050 Ti is appropriate for authoring and local Master Walk testing at controlled resolution. Cinematic path tracing can be slow. Final Pixel Streaming production should move to a cloud or workstation GPU with more VRAM when the world becomes heavily populated.
