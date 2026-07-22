# Material Specification

## White marble floor

Source maps:

- 8192 × 8192 albedo
- 4096 × 4096 normal
- 4096 × 4096 roughness
- 4096 × 4096 ambient occlusion
- 4096 × 4096 height

Unreal shading target:

- Clear Coat shading model
- low base roughness with controlled variation through the veins
- clear-coat strength 1.0
- clear-coat roughness approximately 0.075
- real-world texture scale around 4 m per tile
- Lumen hardware-ray-traced reflections in Master Walk
- Path Tracer for hero stills

## Camel velvet walls

Source maps:

- 8192 × 8192 albedo
- 4096 × 4096 directional normal
- 4096 × 4096 roughness
- 4096 × 4096 ambient occlusion
- 4096 × 4096 fuzz mask

Unreal shading target:

- Cloth shading model
- camel base with darker compressed nap
- warm fuzz/subsurface color
- directional fiber response at grazing angles
- real geometry panel depth and narrow shadow gaps

## Ivory ceiling plaster

- 4096 × 4096 albedo, normal and roughness
- soft ivory, not bright white
- restrained surface variation
- physically modeled tray and cove

## Bronze details

- dark aged bronze door and base trim
- metallic map near 0.94
- variable roughness from approximately 0.18 to 0.42
