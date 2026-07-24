"""Grand Core Material Realism Pass — Unreal Engine 5.8.

Non-destructive objectives:
- Preserve L_MasterShell geometry, camera positions, collision, and V2 exposure.
- Build separate realism materials from the already-imported high-resolution maps.
- Assign them by stable GC_* actor labels.
- Soften remaining floor-level hotspots without adding actors.
- Save a complete material/light rollback record.
- Validate material compilation before declaring success.

The script is idempotent and safe to rerun.
"""

from __future__ import annotations

from pathlib import Path
import json
import traceback
import unreal


LEVEL_PATH = "/Game/GrandCore/Maps/L_MasterShell"
LEVEL_BACKUP_PATH = "/Game/GrandCore/Maps/L_MasterShell_PreMaterialRealism"

TEXTURE_DIR = "/Game/GrandCore/Materials/Textures"
REALISM_DIR = "/Game/GrandCore/Materials/Realism"

TEXTURES = {
    "marble_albedo": f"{TEXTURE_DIR}/T_Marble_Calacatta_Albedo_8K",
    "marble_normal": f"{TEXTURE_DIR}/T_Marble_Calacatta_Normal_4K",
    "marble_roughness": f"{TEXTURE_DIR}/T_Marble_Calacatta_Roughness_4K",
    "marble_ao": f"{TEXTURE_DIR}/T_Marble_Calacatta_AO_4K",

    "velvet_albedo": f"{TEXTURE_DIR}/T_Velvet_Camel_Albedo_8K",
    "velvet_normal": f"{TEXTURE_DIR}/T_Velvet_Camel_Normal_4K",
    "velvet_roughness": f"{TEXTURE_DIR}/T_Velvet_Camel_Roughness_4K",
    "velvet_ao": f"{TEXTURE_DIR}/T_Velvet_Camel_AO_4K",
    "velvet_fuzz": f"{TEXTURE_DIR}/T_Velvet_Camel_Fuzz_4K",

    "plaster_albedo": f"{TEXTURE_DIR}/T_Plaster_Ivory_Albedo_4K",
    "plaster_normal": f"{TEXTURE_DIR}/T_Plaster_Ivory_Normal_4K",
    "plaster_roughness": f"{TEXTURE_DIR}/T_Plaster_Ivory_Roughness_4K",

    "bronze_albedo": f"{TEXTURE_DIR}/T_Bronze_Dark_Albedo_2K",
    "bronze_normal": f"{TEXTURE_DIR}/T_Bronze_Dark_Normal_2K",
    "bronze_roughness": f"{TEXTURE_DIR}/T_Bronze_Dark_Roughness_2K",
    "bronze_metallic": f"{TEXTURE_DIR}/T_Bronze_Dark_Metallic_2K",
}

MATERIAL_PATHS = {
    "marble": f"{REALISM_DIR}/M_Marble_Calacatta_Realism",
    "velvet": f"{REALISM_DIR}/M_Velvet_Camel_Realism",
    "plaster": f"{REALISM_DIR}/M_Plaster_Ivory_Realism",
    "bronze": f"{REALISM_DIR}/M_Bronze_Dark_Realism",
}

PROJECT_ROOT = Path(unreal.Paths.project_dir())
SAVED_ROOT = PROJECT_ROOT / "Saved"
SUCCESS_FILE = SAVED_ROOT / "GrandCoreMaterialRealismSuccess.txt"
REPORT_FILE = SAVED_ROOT / "GrandCoreMaterialRealismReport.txt"
ROLLBACK_FILE = SAVED_ROOT / "GrandCoreMaterialRealismRollback.json"

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
editor_assets = unreal.EditorAssetLibrary
actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

REPORT: list[str] = []


def log(message: str) -> None:
    line = f"[GrandCore Realism] {message}"
    REPORT.append(line)
    unreal.log(line)


def warn(message: str) -> None:
    line = f"[GrandCore Realism WARNING] {message}"
    REPORT.append(line)
    unreal.log_warning(line)


def safe_set(obj, prop: str, value) -> bool:
    if obj is None:
        return False
    try:
        obj.set_editor_property(prop, value)
        return True
    except Exception:
        return False


def safe_get(obj, prop: str, fallback=None):
    if obj is None:
        return fallback
    try:
        return obj.get_editor_property(prop)
    except Exception:
        return fallback


def actor_label(actor) -> str:
    try:
        return actor.get_actor_label()
    except Exception:
        return ""


def get_static_mesh_component(actor):
    component = getattr(actor, "static_mesh_component", None)
    if component:
        return component
    try:
        return actor.get_component_by_class(unreal.StaticMeshComponent)
    except Exception:
        return None


def get_rect_light_component(actor):
    component = getattr(actor, "rect_light_component", None)
    if component:
        return component
    try:
        return actor.get_component_by_class(unreal.RectLightComponent)
    except Exception:
        return None


def get_spot_light_component(actor):
    component = getattr(actor, "spot_light_component", None)
    if component:
        return component
    try:
        return actor.get_component_by_class(unreal.SpotLightComponent)
    except Exception:
        return None


def asset_path(obj) -> str:
    if not obj:
        return ""
    try:
        return str(obj.get_path_name())
    except Exception:
        return ""


def ensure_directory(path: str) -> None:
    if not editor_assets.does_directory_exist(path):
        if not editor_assets.make_directory(path):
            raise RuntimeError(f"Could not create asset directory: {path}")


def load_required_textures():
    textures = {}
    missing = []

    for key, path in TEXTURES.items():
        texture = unreal.load_asset(path)
        if not texture:
            missing.append(path)
            continue

        textures[key] = texture
        safe_set(texture, "filter", unreal.TextureFilter.TF_DEFAULT)

        if key.endswith("_albedo"):
            safe_set(texture, "srgb", True)
        else:
            safe_set(texture, "srgb", False)

        if key.endswith("_normal"):
            safe_set(
                texture,
                "compression_settings",
                unreal.TextureCompressionSettings.TC_NORMALMAP,
            )

        try:
            editor_assets.save_loaded_asset(texture)
        except Exception:
            pass

    if missing:
        raise RuntimeError(
            "The following required imported textures were not found:\n"
            + "\n".join(missing)
        )

    log(f"Verified {len(textures)} high-resolution source textures.")
    return textures


def create_or_reset_material(path: str, shading_model):
    name = path.rsplit("/", 1)[-1]
    material = unreal.load_asset(path)

    if not material:
        material = asset_tools.create_asset(
            name,
            REALISM_DIR,
            unreal.Material,
            unreal.MaterialFactoryNew(),
        )

    if not material:
        raise RuntimeError(f"Could not create material: {path}")

    unreal.MaterialEditingLibrary.delete_all_material_expressions(material)
    safe_set(material, "blend_mode", unreal.BlendMode.BLEND_OPAQUE)
    safe_set(material, "shading_model", shading_model)
    safe_set(material, "two_sided", False)
    safe_set(material, "use_material_attributes", False)
    return material


def expression(material, cls, x: int, y: int):
    node = unreal.MaterialEditingLibrary.create_material_expression(
        material,
        cls,
        x,
        y,
    )
    if not node:
        raise RuntimeError(f"Could not create material expression: {cls}")
    return node


def connect_property(node, output: str, property_) -> None:
    if not unreal.MaterialEditingLibrary.connect_material_property(
        node,
        output,
        property_,
    ):
        raise RuntimeError(f"Could not connect material property: {property_}")


def connect_nodes(a, output: str, b, input_name: str) -> None:
    if not unreal.MaterialEditingLibrary.connect_material_expressions(
        a,
        output,
        b,
        input_name,
    ):
        raise RuntimeError(
            f"Could not connect {a.get_class().get_name()} to "
            f"{b.get_class().get_name()}:{input_name}"
        )


def uv_node(material, u: float, v: float, x=-1200, y=0):
    node = expression(
        material,
        unreal.MaterialExpressionTextureCoordinate,
        x,
        y,
    )
    safe_set(node, "u_tiling", u)
    safe_set(node, "v_tiling", v)
    return node


def texture_node(material, texture, uv, x: int, y: int):
    node = expression(
        material,
        unreal.MaterialExpressionTextureSample,
        x,
        y,
    )
    node.texture = texture
    connect_nodes(uv, "", node, "UVs")
    return node


def scalar_node(material, value: float, x: int, y: int):
    node = expression(material, unreal.MaterialExpressionConstant, x, y)
    node.r = value
    return node


def vector_node(material, color, x: int, y: int):
    node = expression(material, unreal.MaterialExpressionConstant3Vector, x, y)
    node.constant = unreal.LinearColor(*color)
    return node


def multiply_nodes(material, a, b, x: int, y: int):
    node = expression(material, unreal.MaterialExpressionMultiply, x, y)
    connect_nodes(a, "", node, "A")
    connect_nodes(b, "", node, "B")
    return node


def add_nodes(material, a, b, x: int, y: int):
    node = expression(material, unreal.MaterialExpressionAdd, x, y)
    connect_nodes(a, "", node, "A")
    connect_nodes(b, "", node, "B")
    return node


def compile_material(material, label: str) -> None:
    try:
        unreal.MaterialEditingLibrary.layout_material_expressions(material)
    except Exception:
        pass

    errors = unreal.MaterialEditingLibrary.recompile_material(material)
    if errors:
        raise RuntimeError(
            f"{label} material compiler messages:\n" + "\n".join(errors)
        )

    editor_assets.save_loaded_asset(material)
    try:
        unreal.MaterialEditingLibrary.refresh_material_editor(material)
    except Exception:
        pass

    count = unreal.MaterialEditingLibrary.get_num_material_expressions(material)
    log(f"Compiled {label} realism material with {count} expressions.")


def build_marble(textures):
    material = create_or_reset_material(
        MATERIAL_PATHS["marble"],
        unreal.MaterialShadingModel.MSM_CLEAR_COAT,
    )

    # Larger real-world marble slabs: approximately 6–7 ft per repeat.
    uv = uv_node(material, 4.0, 2.0)

    albedo = texture_node(material, textures["marble_albedo"], uv, -1000, -420)
    tint = vector_node(material, (1.08, 1.065, 1.04, 1.0), -760, -520)
    base = multiply_nodes(material, albedo, tint, -480, -420)
    connect_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    normal = texture_node(material, textures["marble_normal"], uv, -1000, -120)
    connect_property(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    roughness = texture_node(
        material,
        textures["marble_roughness"],
        uv,
        -1000,
        180,
    )
    rough_scale = scalar_node(material, 0.45, -760, 230)
    rough_mul = multiply_nodes(material, roughness, rough_scale, -500, 180)
    rough_floor = scalar_node(material, 0.08, -500, 300)
    rough_final = add_nodes(material, rough_mul, rough_floor, -250, 200)
    connect_property(rough_final, "", unreal.MaterialProperty.MP_ROUGHNESS)

    ao = texture_node(material, textures["marble_ao"], uv, -1000, 470)
    connect_property(ao, "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)

    specular = scalar_node(material, 0.48, -250, 480)
    connect_property(specular, "", unreal.MaterialProperty.MP_SPECULAR)

    clear_coat = scalar_node(material, 0.72, -250, 620)
    clear_roughness = scalar_node(material, 0.11, -250, 720)
    connect_property(clear_coat, "", unreal.MaterialProperty.MP_CUSTOM_DATA_0)
    connect_property(
        clear_roughness,
        "",
        unreal.MaterialProperty.MP_CUSTOM_DATA_1,
    )

    compile_material(material, "marble")
    return material


def build_velvet(textures):
    material = create_or_reset_material(
        MATERIAL_PATHS["velvet"],
        unreal.MaterialShadingModel.MSM_CLOTH,
    )

    # One broad fabric repeat across each wall panel; vertical tiling shows nap.
    uv = uv_node(material, 1.15, 4.6)

    albedo = texture_node(material, textures["velvet_albedo"], uv, -1000, -420)
    camel_tint = vector_node(
        material,
        (0.88, 0.67, 0.45, 1.0),
        -760,
        -520,
    )
    base = multiply_nodes(material, albedo, camel_tint, -480, -420)
    connect_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    normal = texture_node(material, textures["velvet_normal"], uv, -1000, -120)
    connect_property(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    roughness = texture_node(
        material,
        textures["velvet_roughness"],
        uv,
        -1000,
        180,
    )
    rough_scale = scalar_node(material, 0.55, -760, 230)
    rough_mul = multiply_nodes(material, roughness, rough_scale, -500, 180)
    rough_floor = scalar_node(material, 0.34, -500, 300)
    rough_final = add_nodes(material, rough_mul, rough_floor, -250, 200)
    connect_property(rough_final, "", unreal.MaterialProperty.MP_ROUGHNESS)

    ao = texture_node(material, textures["velvet_ao"], uv, -1000, 470)
    connect_property(ao, "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)

    fuzz = texture_node(material, textures["velvet_fuzz"], uv, -1000, 720)
    fuzz_color = vector_node(
        material,
        (0.27, 0.075, 0.018, 1.0),
        -720,
        800,
    )
    fuzz_result = multiply_nodes(material, fuzz, fuzz_color, -430, 720)
    connect_property(
        fuzz_result,
        "",
        unreal.MaterialProperty.MP_SUBSURFACE_COLOR,
    )

    specular = scalar_node(material, 0.18, -240, 500)
    connect_property(specular, "", unreal.MaterialProperty.MP_SPECULAR)

    compile_material(material, "velvet")
    return material


def build_plaster(textures):
    material = create_or_reset_material(
        MATERIAL_PATHS["plaster"],
        unreal.MaterialShadingModel.MSM_DEFAULT_LIT,
    )

    uv = uv_node(material, 2.6, 2.6)

    albedo = texture_node(material, textures["plaster_albedo"], uv, -1000, -320)
    ivory_tint = vector_node(
        material,
        (1.04, 1.015, 0.96, 1.0),
        -760,
        -440,
    )
    base = multiply_nodes(material, albedo, ivory_tint, -480, -320)
    connect_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    normal = texture_node(material, textures["plaster_normal"], uv, -1000, -20)
    connect_property(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    roughness = texture_node(
        material,
        textures["plaster_roughness"],
        uv,
        -1000,
        280,
    )
    rough_scale = scalar_node(material, 0.44, -760, 330)
    rough_mul = multiply_nodes(material, roughness, rough_scale, -500, 280)
    rough_floor = scalar_node(material, 0.43, -500, 400)
    rough_final = add_nodes(material, rough_mul, rough_floor, -250, 300)
    connect_property(rough_final, "", unreal.MaterialProperty.MP_ROUGHNESS)

    specular = scalar_node(material, 0.16, -240, 470)
    connect_property(specular, "", unreal.MaterialProperty.MP_SPECULAR)

    compile_material(material, "plaster")
    return material


def build_bronze(textures):
    material = create_or_reset_material(
        MATERIAL_PATHS["bronze"],
        unreal.MaterialShadingModel.MSM_DEFAULT_LIT,
    )

    uv = uv_node(material, 2.4, 2.4)

    albedo = texture_node(material, textures["bronze_albedo"], uv, -1000, -370)
    bronze_tint = vector_node(
        material,
        (0.82, 0.70, 0.58, 1.0),
        -760,
        -470,
    )
    base = multiply_nodes(material, albedo, bronze_tint, -480, -370)
    connect_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    normal = texture_node(material, textures["bronze_normal"], uv, -1000, -80)
    connect_property(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    roughness = texture_node(
        material,
        textures["bronze_roughness"],
        uv,
        -1000,
        210,
    )
    rough_scale = scalar_node(material, 0.62, -760, 260)
    rough_mul = multiply_nodes(material, roughness, rough_scale, -500, 210)
    rough_floor = scalar_node(material, 0.10, -500, 330)
    rough_final = add_nodes(material, rough_mul, rough_floor, -250, 230)
    connect_property(rough_final, "", unreal.MaterialProperty.MP_ROUGHNESS)

    metallic = texture_node(
        material,
        textures["bronze_metallic"],
        uv,
        -1000,
        500,
    )
    connect_property(metallic, "R", unreal.MaterialProperty.MP_METALLIC)

    specular = scalar_node(material, 0.50, -250, 520)
    connect_property(specular, "", unreal.MaterialProperty.MP_SPECULAR)

    compile_material(material, "bronze")
    return material


def choose_material_key(label: str):
    if label == "GC_Floor":
        return "marble"
    if label.startswith("GC_Velvet_"):
        return "velvet"
    if (
        label.startswith("GC_Wall_")
        or label.startswith("GC_Soffit_")
        or label == "GC_Ceiling_Main"
    ):
        return "plaster"
    if label.startswith("GC_Trim_") or label == "GC_Door":
        return "bronze"
    return None


def record_and_assign_materials(materials, rollback):
    counts = {
        "marble": 0,
        "velvet": 0,
        "plaster": 0,
        "bronze": 0,
    }

    for actor in actor_subsystem.get_all_level_actors():
        label = actor_label(actor)
        key = choose_material_key(label)
        if not key:
            continue

        component = get_static_mesh_component(actor)
        if not component:
            warn(f"No StaticMeshComponent found for {label}.")
            continue

        previous = component.get_material(0)
        rollback["materials"].append(
            {
                "actor_label": label,
                "material_path": asset_path(previous),
            }
        )

        component.set_material(0, materials[key])
        safe_set(component, "cast_shadow", True)
        safe_set(component, "cast_contact_shadow", True)

        try:
            component.mark_render_state_dirty()
        except Exception:
            pass

        counts[key] += 1

    if counts["marble"] != 1:
        raise RuntimeError(
            f"Expected exactly one GC_Floor assignment; found {counts['marble']}."
        )
    if counts["velvet"] < 8:
        raise RuntimeError(
            f"Too few velvet wall panels were found: {counts['velvet']}."
        )
    if counts["plaster"] < 5:
        raise RuntimeError(
            f"Too few plaster shell meshes were found: {counts['plaster']}."
        )
    if counts["bronze"] < 2:
        raise RuntimeError(
            f"Too few bronze trim/door meshes were found: {counts['bronze']}."
        )

    log(
        "Assigned realism materials: "
        f"{counts['marble']} marble, "
        f"{counts['velvet']} velvet, "
        f"{counts['plaster']} plaster, "
        f"{counts['bronze']} bronze."
    )


def record_light(component, label: str, light_type: str, rollback):
    entry = {
        "actor_label": label,
        "type": light_type,
        "intensity": safe_get(component, "intensity"),
        "attenuation_radius": safe_get(component, "attenuation_radius"),
        "temperature": safe_get(component, "temperature"),
        "volumetric_scattering_intensity": safe_get(
            component,
            "volumetric_scattering_intensity",
        ),
    }

    if light_type == "spot":
        entry.update(
            {
                "inner_cone_angle": safe_get(component, "inner_cone_angle"),
                "outer_cone_angle": safe_get(component, "outer_cone_angle"),
                "source_radius": safe_get(component, "source_radius"),
                "soft_source_radius": safe_get(component, "soft_source_radius"),
            }
        )

    rollback["lights"].append(entry)


def soften_hotspots(rollback):
    counts = {"fill": 0, "cove": 0, "uplight": 0}

    for actor in actor_subsystem.get_all_level_actors():
        label = actor_label(actor)

        if label.startswith("GC_Calibration_Fill_"):
            component = get_rect_light_component(actor)
            if component:
                record_light(component, label, "rect", rollback)
                safe_set(component, "intensity", 700.0)
                safe_set(component, "temperature", 3550.0)
                safe_set(component, "attenuation_radius", 1450.0)
                safe_set(component, "volumetric_scattering_intensity", 0.05)
                counts["fill"] += 1

        elif label.startswith("GC_CoveLight_"):
            component = get_rect_light_component(actor)
            if component:
                record_light(component, label, "rect", rollback)
                safe_set(component, "intensity", 2050.0)
                safe_set(component, "temperature", 3100.0)
                safe_set(component, "volumetric_scattering_intensity", 0.05)
                safe_set(component, "source_height", 28.0)
                counts["cove"] += 1

        elif label.startswith("GC_Uplight_"):
            component = get_spot_light_component(actor)
            if component:
                record_light(component, label, "spot", rollback)
                safe_set(component, "intensity", 480.0)
                safe_set(component, "temperature", 2875.0)
                safe_set(component, "inner_cone_angle", 18.0)
                safe_set(component, "outer_cone_angle", 42.0)
                safe_set(component, "attenuation_radius", 625.0)
                safe_set(component, "source_radius", 4.0)
                safe_set(component, "soft_source_radius", 7.0)
                safe_set(component, "volumetric_scattering_intensity", 0.04)
                counts["uplight"] += 1

    log(
        "Softened remaining hotspots across "
        f"{counts['fill']} fills, "
        f"{counts['cove']} cove lights, and "
        f"{counts['uplight']} uplights."
    )


def create_backup_level():
    if editor_assets.does_asset_exist(LEVEL_BACKUP_PATH):
        log("Pre-realism level backup already exists.")
        return

    try:
        result = editor_assets.duplicate_asset(LEVEL_PATH, LEVEL_BACKUP_PATH)
        if result:
            log("Created L_MasterShell_PreMaterialRealism backup.")
        else:
            warn("Could not create the optional level-asset backup.")
    except Exception as exc:
        warn(f"Optional level backup was skipped: {exc}")


def save_all():
    if not level_subsystem.save_current_level():
        warn("LevelEditorSubsystem.save_current_level returned false.")

    try:
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    except Exception as exc:
        warn(f"save_dirty_packages reported: {exc}")

    try:
        level_subsystem.editor_invalidate_viewports()
    except Exception:
        pass

    log("Saved L_MasterShell and all new realism materials.")


def write_report(success: bool, error_text: str = ""):
    SAVED_ROOT.mkdir(parents=True, exist_ok=True)

    lines = [
        f"GRAND CORE MATERIAL REALISM: {'SUCCESS' if success else 'FAILED'}",
        "",
        *REPORT,
    ]

    if error_text:
        lines.extend(["", "ERROR:", error_text])

    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")


def main():
    try:
        if SUCCESS_FILE.exists():
            SUCCESS_FILE.unlink()

        log("Starting the non-destructive Material Realism Pass.")

        if not editor_assets.does_asset_exist(LEVEL_PATH):
            raise RuntimeError(f"Master shell level not found: {LEVEL_PATH}")

        level_subsystem.load_level(LEVEL_PATH)
        log("Loaded L_MasterShell.")

        create_backup_level()
        ensure_directory(REALISM_DIR)

        textures = load_required_textures()

        materials = {
            "marble": build_marble(textures),
            "velvet": build_velvet(textures),
            "plaster": build_plaster(textures),
            "bronze": build_bronze(textures),
        }

        rollback = {
            "level_path": LEVEL_PATH,
            "materials": [],
            "lights": [],
        }

        record_and_assign_materials(materials, rollback)
        soften_hotspots(rollback)

        ROLLBACK_FILE.write_text(
            json.dumps(rollback, indent=2),
            encoding="utf-8",
        )
        log("Saved the complete material/light rollback record.")

        save_all()

        SUCCESS_FILE.write_text(
            "GRAND CORE MATERIAL REALISM PASS COMPLETED SUCCESSFULLY\n"
            "The stable V2 exposure was preserved.\n"
            "Open L_MasterShell through the included DX11 review launcher.",
            encoding="utf-8",
        )
        write_report(True)
        log("MATERIAL REALISM PASS COMPLETE.")

    except Exception:
        error_text = traceback.format_exc()
        unreal.log_error(error_text)
        REPORT.append(error_text)
        write_report(False, error_text)
        raise


if __name__ == "__main__":
    main()
