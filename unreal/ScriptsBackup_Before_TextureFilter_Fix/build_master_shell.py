"""Build the exact Grand Core master shell inside Unreal Engine 5.8.

Run from the Unreal Editor Python console or through BUILD-MASTER-SHELL.cmd.
The script is intentionally idempotent: it rebuilds only the generated level and
assets under /Game/GrandCore.
"""
from __future__ import annotations

from pathlib import Path
import math
import unreal

PROJECT_ROOT = Path(unreal.Paths.project_dir())
SOURCE_ROOT = PROJECT_ROOT / "ContentSource"
TEXTURE_ROOT = SOURCE_ROOT / "Textures"
LEVEL_PATH = "/Game/GrandCore/Maps/L_MasterShell"
TEXTURE_DEST = "/Game/GrandCore/Materials/Textures"
MATERIAL_DEST = "/Game/GrandCore/Materials"

# Exact architectural dimensions in centimeters (Unreal units).
ROOM_LENGTH = 2438.4   # 80 ft
ROOM_WIDTH = 1219.2    # 40 ft
ROOM_HEIGHT = 609.6    # 20 ft
WALL_THICKNESS = 15.0
DOOR_WIDTH = 121.92    # 4 ft
DOOR_HEIGHT = 243.84   # 8 ft
DOOR_Y = -305.0        # slightly toward the front edge of the left short wall

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
editor_assets = unreal.EditorAssetLibrary
actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def log(message: str) -> None:
    unreal.log(f"[GrandCore] {message}")


def warn(message: str) -> None:
    unreal.log_warning(f"[GrandCore] {message}")


def safe_set(obj, prop: str, value) -> bool:
    try:
        obj.set_editor_property(prop, value)
        return True
    except Exception:
        return False


def import_texture(filename: str, asset_name: str, normal=False, linear=False):
    src = TEXTURE_ROOT / filename
    if not src.exists():
        raise FileNotFoundError(src)
    destination = f"{TEXTURE_DEST}/{asset_name}"
    existing = unreal.load_asset(destination)
    if existing:
        return existing

    task = unreal.AssetImportTask()
    task.filename = str(src)
    task.destination_path = TEXTURE_DEST
    task.destination_name = asset_name
    task.automated = True
    task.replace_existing = True
    task.save = True
    asset_tools.import_asset_tasks([task])
    texture = unreal.load_asset(destination)
    if not texture:
        raise RuntimeError(f"Texture import failed: {src}")

    if normal:
        safe_set(texture, "compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        safe_set(texture, "srgb", False)
    elif linear:
        safe_set(texture, "srgb", False)
    safe_set(texture, "filter", unreal.TextureFilter.TF_ANISOTROPIC)
    safe_set(texture, "max_texture_size", 8192)
    editor_assets.save_loaded_asset(texture)
    return texture


def clear_material(material):
    try:
        unreal.MaterialEditingLibrary.delete_all_material_expressions(material)
    except Exception:
        pass


def create_material_asset(name: str):
    path = f"{MATERIAL_DEST}/{name}"
    material = unreal.load_asset(path)
    if not material:
        material = asset_tools.create_asset(name, MATERIAL_DEST, unreal.Material, unreal.MaterialFactoryNew())
    clear_material(material)
    return material


def expression(material, cls, x, y):
    return unreal.MaterialEditingLibrary.create_material_expression(material, cls, x, y)


def connect(expr, output: str, prop):
    unreal.MaterialEditingLibrary.connect_material_property(expr, output, prop)


def connect_expr(a, output: str, b, input_name: str):
    unreal.MaterialEditingLibrary.connect_material_expressions(a, output, b, input_name)


def texture_sample(material, texture, x, y, uv_node=None):
    node = expression(material, unreal.MaterialExpressionTextureSample, x, y)
    node.texture = texture
    if uv_node:
        connect_expr(uv_node, "", node, "UVs")
    return node


def uv_node(material, u: float, v: float, x=-1100, y=0):
    node = expression(material, unreal.MaterialExpressionTextureCoordinate, x, y)
    safe_set(node, "u_tiling", u)
    safe_set(node, "v_tiling", v)
    return node


def constant(material, value: float, x, y):
    node = expression(material, unreal.MaterialExpressionConstant, x, y)
    node.r = value
    return node


def vector_constant(material, color: unreal.LinearColor, x, y):
    node = expression(material, unreal.MaterialExpressionConstant3Vector, x, y)
    node.constant = color
    return node


def build_materials():
    log("Importing high-resolution material maps")
    marble_a = import_texture("T_Marble_Calacatta_Albedo_8K.jpg", "T_Marble_Calacatta_Albedo_8K")
    marble_n = import_texture("T_Marble_Calacatta_Normal_4K.png", "T_Marble_Calacatta_Normal_4K", normal=True)
    marble_r = import_texture("T_Marble_Calacatta_Roughness_4K.png", "T_Marble_Calacatta_Roughness_4K", linear=True)
    marble_ao = import_texture("T_Marble_Calacatta_AO_4K.png", "T_Marble_Calacatta_AO_4K", linear=True)

    velvet_a = import_texture("T_Velvet_Camel_Albedo_8K.jpg", "T_Velvet_Camel_Albedo_8K")
    velvet_n = import_texture("T_Velvet_Camel_Normal_4K.png", "T_Velvet_Camel_Normal_4K", normal=True)
    velvet_r = import_texture("T_Velvet_Camel_Roughness_4K.png", "T_Velvet_Camel_Roughness_4K", linear=True)
    velvet_ao = import_texture("T_Velvet_Camel_AO_4K.png", "T_Velvet_Camel_AO_4K", linear=True)
    velvet_fuzz = import_texture("T_Velvet_Camel_Fuzz_4K.png", "T_Velvet_Camel_Fuzz_4K", linear=True)

    plaster_a = import_texture("T_Plaster_Ivory_Albedo_4K.jpg", "T_Plaster_Ivory_Albedo_4K")
    plaster_n = import_texture("T_Plaster_Ivory_Normal_4K.png", "T_Plaster_Ivory_Normal_4K", normal=True)
    plaster_r = import_texture("T_Plaster_Ivory_Roughness_4K.png", "T_Plaster_Ivory_Roughness_4K", linear=True)

    bronze_a = import_texture("T_Bronze_Dark_Albedo_2K.jpg", "T_Bronze_Dark_Albedo_2K")
    bronze_n = import_texture("T_Bronze_Dark_Normal_2K.png", "T_Bronze_Dark_Normal_2K", normal=True)
    bronze_r = import_texture("T_Bronze_Dark_Roughness_2K.png", "T_Bronze_Dark_Roughness_2K", linear=True)
    bronze_m = import_texture("T_Bronze_Dark_Metallic_2K.png", "T_Bronze_Dark_Metallic_2K", linear=True)

    # Marble: real-world scale approximately 4 m per texture tile.
    marble = create_material_asset("M_Marble_Master")
    safe_set(marble, "shading_model", unreal.MaterialShadingModel.MSM_CLEAR_COAT)
    uv = uv_node(marble, ROOM_LENGTH / 400.0, ROOM_WIDTH / 400.0)
    connect(texture_sample(marble, marble_a, -850, -180, uv), "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    connect(texture_sample(marble, marble_n, -850, 80, uv), "RGB", unreal.MaterialProperty.MP_NORMAL)
    connect(texture_sample(marble, marble_r, -850, 300, uv), "R", unreal.MaterialProperty.MP_ROUGHNESS)
    connect(texture_sample(marble, marble_ao, -850, 500, uv), "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)
    try:
        connect(constant(marble, 1.0, -250, 620), "", unreal.MaterialProperty.MP_CUSTOM_DATA_0)
        connect(constant(marble, 0.075, -250, 700), "", unreal.MaterialProperty.MP_CUSTOM_DATA_1)
    except Exception:
        pass
    safe_set(marble, "two_sided", False)
    unreal.MaterialEditingLibrary.recompile_material(marble)
    editor_assets.save_loaded_asset(marble)

    # Velvet: cloth shading model gives a dedicated fuzz response; maps preserve the nap.
    velvet = create_material_asset("M_Velvet_Camel_Master")
    safe_set(velvet, "shading_model", unreal.MaterialShadingModel.MSM_CLOTH)
    uv = uv_node(velvet, 2.2, 5.8)
    connect(texture_sample(velvet, velvet_a, -850, -180, uv), "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    connect(texture_sample(velvet, velvet_n, -850, 80, uv), "RGB", unreal.MaterialProperty.MP_NORMAL)
    connect(texture_sample(velvet, velvet_r, -850, 300, uv), "R", unreal.MaterialProperty.MP_ROUGHNESS)
    connect(texture_sample(velvet, velvet_ao, -850, 500, uv), "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)
    try:
        fuzz_tex = texture_sample(velvet, velvet_fuzz, -850, 720, uv)
        fuzz_color = vector_constant(velvet, unreal.LinearColor(0.28, 0.095, 0.025, 1.0), -500, 820)
        multiply = expression(velvet, unreal.MaterialExpressionMultiply, -250, 760)
        connect_expr(fuzz_tex, "R", multiply, "A")
        connect_expr(fuzz_color, "", multiply, "B")
        connect(multiply, "", unreal.MaterialProperty.MP_SUBSURFACE_COLOR)
    except Exception as exc:
        warn(f"Velvet fuzz connection skipped: {exc}")
    unreal.MaterialEditingLibrary.recompile_material(velvet)
    editor_assets.save_loaded_asset(velvet)

    plaster = create_material_asset("M_Plaster_Ivory_Master")
    uv = uv_node(plaster, 3.0, 3.0)
    connect(texture_sample(plaster, plaster_a, -850, -160, uv), "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    connect(texture_sample(plaster, plaster_n, -850, 80, uv), "RGB", unreal.MaterialProperty.MP_NORMAL)
    connect(texture_sample(plaster, plaster_r, -850, 300, uv), "R", unreal.MaterialProperty.MP_ROUGHNESS)
    unreal.MaterialEditingLibrary.recompile_material(plaster)
    editor_assets.save_loaded_asset(plaster)

    bronze = create_material_asset("M_Bronze_Dark_Master")
    uv = uv_node(bronze, 3.0, 3.0)
    connect(texture_sample(bronze, bronze_a, -850, -160, uv), "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    connect(texture_sample(bronze, bronze_n, -850, 80, uv), "RGB", unreal.MaterialProperty.MP_NORMAL)
    connect(texture_sample(bronze, bronze_r, -850, 300, uv), "R", unreal.MaterialProperty.MP_ROUGHNESS)
    connect(texture_sample(bronze, bronze_m, -850, 500, uv), "R", unreal.MaterialProperty.MP_METALLIC)
    unreal.MaterialEditingLibrary.recompile_material(bronze)
    editor_assets.save_loaded_asset(bronze)

    emissive = create_material_asset("M_Cove_Emissive_Master")
    color = vector_constant(emissive, unreal.LinearColor(1.0, 0.68, 0.32, 1.0), -500, 0)
    intensity = constant(emissive, 32.0, -500, 120)
    mult = expression(emissive, unreal.MaterialExpressionMultiply, -180, 20)
    connect_expr(color, "", mult, "A")
    connect_expr(intensity, "", mult, "B")
    connect(mult, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    connect(constant(emissive, 0.25, -180, 180), "", unreal.MaterialProperty.MP_ROUGHNESS)
    unreal.MaterialEditingLibrary.recompile_material(emissive)
    editor_assets.save_loaded_asset(emissive)

    return {
        "marble": marble,
        "velvet": velvet,
        "plaster": plaster,
        "bronze": bronze,
        "emissive": emissive,
    }


def delete_generated_level_actors():
    for actor in actor_subsystem.get_all_level_actors():
        if actor.get_actor_label().startswith("GC_"):
            actor_subsystem.destroy_actor(actor)


def spawn_box(label: str, center, size, material, collision=True):
    cube = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
    actor = actor_subsystem.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*center), unreal.Rotator())
    actor.set_actor_label(f"GC_{label}")
    component = actor.static_mesh_component
    component.set_static_mesh(cube)
    component.set_world_scale3d(unreal.Vector(size[0] / 100.0, size[1] / 100.0, size[2] / 100.0))
    component.set_material(0, material)
    safe_set(component, "mobility", unreal.ComponentMobility.STATIC)
    safe_set(component, "cast_shadow", True)
    safe_set(component, "cast_contact_shadow", True)
    safe_set(component, "collision_enabled", unreal.CollisionEnabled.QUERY_AND_PHYSICS if collision else unreal.CollisionEnabled.NO_COLLISION)
    return actor


def look_at_rotation(origin, target):
    direction = unreal.Vector(target[0] - origin[0], target[1] - origin[1], target[2] - origin[2])
    return unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*origin), unreal.Vector(*target))


def spawn_rect_light(label, location, rotation, intensity=9000.0, width=1000.0, height=12.0, temperature=3000.0):
    actor = actor_subsystem.spawn_actor_from_class(unreal.RectLight, unreal.Vector(*location), unreal.Rotator(*rotation))
    actor.set_actor_label(f"GC_{label}")
    comp = actor.rect_light_component
    safe_set(comp, "intensity_units", unreal.LightUnits.LUMENS)
    safe_set(comp, "intensity", intensity)
    safe_set(comp, "source_width", width)
    safe_set(comp, "source_height", height)
    safe_set(comp, "use_temperature", True)
    safe_set(comp, "temperature", temperature)
    safe_set(comp, "attenuation_radius", 2200.0)
    safe_set(comp, "cast_shadows", True)
    safe_set(comp, "mobility", unreal.ComponentMobility.MOVABLE)
    return actor


def spawn_spot(label, location, rotation, intensity=2400.0, temperature=2900.0):
    actor = actor_subsystem.spawn_actor_from_class(unreal.SpotLight, unreal.Vector(*location), unreal.Rotator(*rotation))
    actor.set_actor_label(f"GC_{label}")
    comp = actor.spot_light_component
    safe_set(comp, "intensity_units", unreal.LightUnits.LUMENS)
    safe_set(comp, "intensity", intensity)
    safe_set(comp, "inner_cone_angle", 16.0)
    safe_set(comp, "outer_cone_angle", 33.0)
    safe_set(comp, "attenuation_radius", 750.0)
    safe_set(comp, "source_radius", 2.5)
    safe_set(comp, "use_temperature", True)
    safe_set(comp, "temperature", temperature)
    safe_set(comp, "cast_shadows", True)
    safe_set(comp, "contact_shadow_length", 0.20)
    return actor


def build_shell(materials):
    log("Creating exact 80 ft x 40 ft x 20 ft architectural shell")
    L, W, H, T = ROOM_LENGTH, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS

    # Structural shell.
    spawn_box("Floor", (0, 0, -5), (L, W, 10), materials["marble"])
    spawn_box("Wall_North", (0, W / 2 + T / 2, H / 2), (L, T, H), materials["plaster"])
    spawn_box("Wall_South", (0, -W / 2 - T / 2, H / 2), (L, T, H), materials["plaster"])
    spawn_box("Wall_Right", (L / 2 + T / 2, 0, H / 2), (T, W, H), materials["plaster"])

    door_min = DOOR_Y - DOOR_WIDTH / 2
    door_max = DOOR_Y + DOOR_WIDTH / 2
    wall_min = -W / 2
    wall_max = W / 2
    seg_a = door_min - wall_min
    seg_b = wall_max - door_max
    spawn_box("Wall_Left_A", (-L / 2 - T / 2, wall_min + seg_a / 2, H / 2), (T, seg_a, H), materials["plaster"])
    spawn_box("Wall_Left_B", (-L / 2 - T / 2, door_max + seg_b / 2, H / 2), (T, seg_b, H), materials["plaster"])
    spawn_box("Wall_Left_Header", (-L / 2 - T / 2, DOOR_Y, DOOR_HEIGHT + (H - DOOR_HEIGHT) / 2), (T, DOOR_WIDTH, H - DOOR_HEIGHT), materials["plaster"])
    spawn_box("Door", (-L / 2 + 3.0, DOOR_Y, DOOR_HEIGHT / 2), (8.0, DOOR_WIDTH - 4.0, DOOR_HEIGHT - 4.0), materials["bronze"])

    # Velvet panels with narrow physical shadow gaps.
    panel_depth = 3.5
    panel_h = H - 10.0
    gap = 1.2
    target = 235.0

    def panel_run(total, axis, fixed, prefix):
        count = int(math.ceil(total / target))
        width = (total - (count - 1) * gap) / count
        for i in range(count):
            position = -total / 2 + width / 2 + i * (width + gap)
            if axis == "x":
                spawn_box(f"Velvet_{prefix}_{i+1:02d}", (position, fixed, H / 2), (width, panel_depth, panel_h), materials["velvet"], False)
            else:
                spawn_box(f"Velvet_{prefix}_{i+1:02d}", (fixed, position, H / 2), (panel_depth, width, panel_h), materials["velvet"], False)

    panel_run(L, "x", W / 2 - 3.0, "North")
    panel_run(L, "x", -W / 2 + 3.0, "South")
    panel_run(W, "y", L / 2 - 3.0, "Right")

    # Left-wall velvet, split around door.
    for index, (start, end) in enumerate(((wall_min, door_min), (door_max, wall_max))):
        total = end - start
        count = max(1, int(math.ceil(total / target)))
        width = (total - (count - 1) * gap) / count
        for i in range(count):
            y = start + width / 2 + i * (width + gap)
            spawn_box(f"Velvet_Left_{index}_{i+1:02d}", (-L / 2 + 3.0, y, H / 2), (panel_depth, width, panel_h), materials["velvet"], False)
    spawn_box("Velvet_Door_Header", (-L / 2 + 3.0, DOOR_Y, DOOR_HEIGHT + (H - DOOR_HEIGHT) / 2), (panel_depth, DOOR_WIDTH - 2.0, H - DOOR_HEIGHT - 10.0), materials["velvet"], False)

    # Bronze skirting.
    trim_h, trim_d = 9.0, 2.5
    spawn_box("Trim_North", (0, W / 2 - 5.5, trim_h / 2), (L, trim_d, trim_h), materials["bronze"], False)
    spawn_box("Trim_South", (0, -W / 2 + 5.5, trim_h / 2), (L, trim_d, trim_h), materials["bronze"], False)
    spawn_box("Trim_Right", (L / 2 - 5.5, 0, trim_h / 2), (trim_d, W, trim_h), materials["bronze"], False)
    spawn_box("Trim_Left_A", (-L / 2 + 5.5, wall_min + seg_a / 2, trim_h / 2), (trim_d, seg_a, trim_h), materials["bronze"], False)
    spawn_box("Trim_Left_B", (-L / 2 + 5.5, door_max + seg_b / 2, trim_h / 2), (trim_d, seg_b, trim_h), materials["bronze"], False)

    # Tray ceiling and luminous cove.
    spawn_box("Ceiling_Main", (0, 0, H + 5), (L, W, 10), materials["plaster"])
    soffit, drop = 62.0, 30.0
    spawn_box("Soffit_North", (0, W / 2 - soffit / 2, H - drop / 2), (L, soffit, drop), materials["plaster"])
    spawn_box("Soffit_South", (0, -W / 2 + soffit / 2, H - drop / 2), (L, soffit, drop), materials["plaster"])
    spawn_box("Soffit_East", (L / 2 - soffit / 2, 0, H - drop / 2), (soffit, W - 2 * soffit, drop), materials["plaster"])
    spawn_box("Soffit_West", (-L / 2 + soffit / 2, 0, H - drop / 2), (soffit, W - 2 * soffit, drop), materials["plaster"])

    strip = 3.5
    z = H - drop + 4.0
    spawn_box("Cove_North", (0, W / 2 - soffit, z), (L - 2 * soffit, strip, strip), materials["emissive"], False)
    spawn_box("Cove_South", (0, -W / 2 + soffit, z), (L - 2 * soffit, strip, strip), materials["emissive"], False)
    spawn_box("Cove_East", (L / 2 - soffit, 0, z), (strip, W - 2 * soffit, strip), materials["emissive"], False)
    spawn_box("Cove_West", (-L / 2 + soffit, 0, z), (strip, W - 2 * soffit, strip), materials["emissive"], False)

    # Four broad area lights create the aura; emissive strips remain visible.
    spawn_rect_light("CoveLight_North", (0, W / 2 - soffit - 8, H - drop + 10), (10, 180, 0), 14500, L - 2 * soffit, 18)
    spawn_rect_light("CoveLight_South", (0, -W / 2 + soffit + 8, H - drop + 10), (10, 0, 0), 14500, L - 2 * soffit, 18)
    spawn_rect_light("CoveLight_East", (L / 2 - soffit - 8, 0, H - drop + 10), (10, -90, 0), 11000, W - 2 * soffit, 18)
    spawn_rect_light("CoveLight_West", (-L / 2 + soffit + 8, 0, H - drop + 10), (10, 90, 0), 11000, W - 2 * soffit, 18)

    # Uplights around the perimeter. Spacing is about 3 m, matching the benchmark rhythm.
    for idx, x in enumerate([(-L / 2 + 150) + i * ((L - 300) / 9) for i in range(10)]):
        spawn_spot(f"Uplight_N_{idx:02d}", (x, W / 2 - 22, 6), (-88, 180, 0))
        spawn_spot(f"Uplight_S_{idx:02d}", (x, -W / 2 + 22, 6), (-88, 0, 0))
    for idx, y in enumerate([(-W / 2 + 150) + i * ((W - 300) / 4) for i in range(5)]):
        spawn_spot(f"Uplight_E_{idx:02d}", (L / 2 - 22, y, 6), (-88, -90, 0))

    # Skylight for soft fill.
    sky = actor_subsystem.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, H - 50), unreal.Rotator())
    sky.set_actor_label("GC_SkyLight")
    safe_set(sky.light_component, "intensity", 0.18)
    safe_set(sky.light_component, "mobility", unreal.ComponentMobility.MOVABLE)
    safe_set(sky.light_component, "real_time_capture", True)

    # Reflection capture for non-path-traced fallback.
    try:
        capture = actor_subsystem.spawn_actor_from_class(unreal.SphereReflectionCapture, unreal.Vector(0, 0, H / 2), unreal.Rotator())
        capture.set_actor_label("GC_ReflectionCapture")
        safe_set(capture.capture_component, "influence_radius", 2000.0)
        safe_set(capture.capture_component, "brightness", 1.0)
    except Exception as exc:
        warn(f"Reflection capture skipped: {exc}")

    # Unbound post process with physically controlled exposure.
    pp = actor_subsystem.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(), unreal.Rotator())
    pp.set_actor_label("GC_PostProcess_Master")
    safe_set(pp, "unbound", True)
    settings = pp.settings
    for prop, value in (
        ("override_auto_exposure_method", True),
        ("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL),
        ("override_auto_exposure_bias", True),
        ("auto_exposure_bias", 0.0),
        ("override_bloom_intensity", True),
        ("bloom_intensity", 0.18),
        ("override_vignette_intensity", True),
        ("vignette_intensity", 0.05),
        ("override_chromatic_aberration_intensity", True),
        ("chromatic_aberration_intensity", 0.0),
        ("override_motion_blur_amount", True),
        ("motion_blur_amount", 0.0),
        ("override_lumen_gi_final_gather_quality", True),
        ("lumen_gi_final_gather_quality", 6.0),
        ("override_lumen_reflection_quality", True),
        ("lumen_reflection_quality", 6.0),
    ):
        safe_set(settings, prop, value)
    pp.settings = settings

    # Default visitor start and hero cameras.
    start_loc = (-L / 2 + 165, DOOR_Y, 92)
    start = actor_subsystem.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(*start_loc), unreal.Rotator(0, 0, 0))
    start.set_actor_label("GC_PlayerStart")

    cameras = [
        ("Hero_Entrance", (-L / 2 + 245, -W / 2 + 190, 170), (L / 2 - 250, 0, 220)),
        ("Hero_Center", (-L / 2 + 320, 0, 170), (L / 2 - 280, 0, 240)),
        ("Hero_Right", (-L / 2 + 360, W / 2 - 190, 190), (L / 2 - 250, -60, 240)),
        ("Hero_Reverse", (L / 2 - 260, W / 2 - 170, 180), (-L / 2 + 280, -120, 220)),
    ]
    for label, loc, target in cameras:
        camera = actor_subsystem.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(*loc), look_at_rotation(loc, target))
        camera.set_actor_label(f"GC_{label}")
        safe_set(camera.cine_camera_component, "current_focal_length", 22.0)
        safe_set(camera.cine_camera_component, "current_aperture", 5.6)
        safe_set(camera.cine_camera_component, "focus_settings", camera.cine_camera_component.focus_settings)

    # World settings.
    world = unreal.EditorLevelLibrary.get_editor_world()
    world_settings = world.get_world_settings()
    safe_set(world_settings, "force_no_precomputed_lighting", True)
    game_mode = unreal.load_class(None, "/Script/GrandCore.GrandCoreGameMode")
    if game_mode:
        safe_set(world_settings, "default_game_mode", game_mode)


def main():
    log("Starting master-shell build")
    if editor_assets.does_asset_exist(LEVEL_PATH):
        level_subsystem.load_level(LEVEL_PATH)
    else:
        level_subsystem.new_level(LEVEL_PATH)
    delete_generated_level_actors()
    materials = build_materials()
    build_shell(materials)
    unreal.EditorLevelLibrary.save_current_level()
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log("MASTER SHELL COMPLETE — open L_MasterShell and press Play")


if __name__ == "__main__":
    main()
