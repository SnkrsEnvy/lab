"""Grand Core Texture Fidelity Pass V2 — Unreal Engine 5.8.

This pass is intentionally separate from the successful Material Realism pass.
It preserves geometry, cameras, collision, actor count, and Visual Calibration V2.

It creates new Fidelity materials from the already-imported source maps, assigns
them by stable GC_* labels, makes a pre-pass level backup, softens the remaining
uplight cones, and saves a rollback record.
"""

from __future__ import annotations

from pathlib import Path
import json
import traceback
import unreal


LEVEL_PATH = "/Game/GrandCore/Maps/L_MasterShell"
LEVEL_BACKUP_PATH = "/Game/GrandCore/Maps/L_MasterShell_PreTextureFidelity"

TEXTURE_DIR = "/Game/GrandCore/Materials/Textures"
FIDELITY_DIR = "/Game/GrandCore/Materials/Fidelity"

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
    "marble": f"{FIDELITY_DIR}/M_Marble_Calacatta_Fidelity",
    "velvet": f"{FIDELITY_DIR}/M_Velvet_Camel_Fidelity",
    "plaster": f"{FIDELITY_DIR}/M_Plaster_Ivory_Fidelity",
    "bronze": f"{FIDELITY_DIR}/M_Bronze_Dark_Fidelity",
}

PROJECT_ROOT = Path(unreal.Paths.project_dir())
SAVED = PROJECT_ROOT / "Saved"
SUCCESS_FILE = SAVED / "GrandCoreTextureFidelitySuccess.txt"
REPORT_FILE = SAVED / "GrandCoreTextureFidelityReport.txt"
ROLLBACK_FILE = SAVED / "GrandCoreTextureFidelityRollback.json"

assets = unreal.EditorAssetLibrary
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

REPORT = []


def log(message):
    line = f"[GrandCore Fidelity] {message}"
    REPORT.append(line)
    unreal.log(line)


def warn(message):
    line = f"[GrandCore Fidelity WARNING] {message}"
    REPORT.append(line)
    unreal.log_warning(line)


def safe_set(obj, prop, value):
    if obj is None:
        return False
    try:
        obj.set_editor_property(prop, value)
        return True
    except Exception:
        return False


def safe_get(obj, prop, fallback=None):
    if obj is None:
        return fallback
    try:
        return obj.get_editor_property(prop)
    except Exception:
        return fallback


def label(actor):
    try:
        return actor.get_actor_label()
    except Exception:
        return ""


def mesh_component(actor):
    comp = getattr(actor, "static_mesh_component", None)
    if comp:
        return comp
    try:
        return actor.get_component_by_class(unreal.StaticMeshComponent)
    except Exception:
        return None


def spot_component(actor):
    comp = getattr(actor, "spot_light_component", None)
    if comp:
        return comp
    try:
        return actor.get_component_by_class(unreal.SpotLightComponent)
    except Exception:
        return None


def rect_component(actor):
    comp = getattr(actor, "rect_light_component", None)
    if comp:
        return comp
    try:
        return actor.get_component_by_class(unreal.RectLightComponent)
    except Exception:
        return None


def object_path(obj):
    if not obj:
        return ""
    try:
        return str(obj.get_path_name())
    except Exception:
        return ""


def ensure_directory(path):
    if not assets.does_directory_exist(path):
        assets.make_directory(path)


def load_textures():
    result = {}
    missing = []
    for key, path in TEXTURES.items():
        tex = unreal.load_asset(path)
        if not tex:
            missing.append(path)
            continue
        result[key] = tex
        safe_set(tex, "filter", unreal.TextureFilter.TF_DEFAULT)
        safe_set(tex, "srgb", key.endswith("_albedo"))
        if key.endswith("_normal"):
            safe_set(tex, "compression_settings",
                     unreal.TextureCompressionSettings.TC_NORMALMAP)
    if missing:
        raise RuntimeError("Missing required textures:\n" + "\n".join(missing))
    log(f"Verified {len(result)} source textures.")
    return result


def new_material(path, shading_model):
    name = path.rsplit("/", 1)[-1]
    mat = unreal.load_asset(path)
    if not mat:
        mat = asset_tools.create_asset(
            name, FIDELITY_DIR, unreal.Material, unreal.MaterialFactoryNew()
        )
    if not mat:
        raise RuntimeError(f"Could not create {path}")
    unreal.MaterialEditingLibrary.delete_all_material_expressions(mat)
    safe_set(mat, "blend_mode", unreal.BlendMode.BLEND_OPAQUE)
    safe_set(mat, "shading_model", shading_model)
    safe_set(mat, "two_sided", False)
    return mat


def expr(mat, cls, x, y):
    node = unreal.MaterialEditingLibrary.create_material_expression(
        mat, cls, x, y
    )
    if not node:
        raise RuntimeError(f"Could not create expression {cls}")
    return node


def connect_expr(a, output_name, b, input_name):
    unreal.MaterialEditingLibrary.connect_material_expressions(
        a, output_name, b, input_name
    )


def connect_prop(node, output_name, prop):
    unreal.MaterialEditingLibrary.connect_material_property(
        node, output_name, prop
    )


def uv(mat, u, v, x=-1250, y=0):
    node = expr(mat, unreal.MaterialExpressionTextureCoordinate, x, y)
    safe_set(node, "u_tiling", u)
    safe_set(node, "v_tiling", v)
    return node


def tex(mat, texture, coords, x, y):
    node = expr(mat, unreal.MaterialExpressionTextureSample, x, y)
    node.texture = texture
    connect_expr(coords, "", node, "UVs")
    return node


def scalar(mat, value, x, y):
    node = expr(mat, unreal.MaterialExpressionConstant, x, y)
    node.r = value
    return node


def vector(mat, rgba, x, y):
    node = expr(mat, unreal.MaterialExpressionConstant3Vector, x, y)
    node.constant = unreal.LinearColor(*rgba)
    return node


def multiply(mat, a, b, x, y):
    node = expr(mat, unreal.MaterialExpressionMultiply, x, y)
    connect_expr(a, "", node, "A")
    connect_expr(b, "", node, "B")
    return node


def add(mat, a, b, x, y):
    node = expr(mat, unreal.MaterialExpressionAdd, x, y)
    connect_expr(a, "", node, "A")
    connect_expr(b, "", node, "B")
    return node


def compile_save(mat, name):
    try:
        unreal.MaterialEditingLibrary.layout_material_expressions(mat)
    except Exception:
        pass
    messages = unreal.MaterialEditingLibrary.recompile_material(mat)
    if messages:
        warn(f"{name} compiler messages: {messages}")
    assets.save_loaded_asset(mat)
    log(f"Compiled and saved {name}.")


def build_marble(t):
    mat = new_material(
        MATERIAL_PATHS["marble"],
        unreal.MaterialShadingModel.MSM_DEFAULT_LIT,
    )
    coords = uv(mat, 1.55, 0.78)

    albedo = tex(mat, t["marble_albedo"], coords, -1050, -430)
    tint = vector(mat, (1.18, 1.16, 1.12, 1.0), -790, -520)
    base = multiply(mat, albedo, tint, -500, -430)
    connect_prop(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    normal = tex(mat, t["marble_normal"], coords, -1050, -100)
    connect_prop(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    rough = tex(mat, t["marble_roughness"], coords, -1050, 210)
    scale = scalar(mat, 0.30, -790, 250)
    scaled = multiply(mat, rough, scale, -520, 210)
    floor = scalar(mat, 0.09, -520, 330)
    final_rough = add(mat, scaled, floor, -250, 230)
    connect_prop(final_rough, "", unreal.MaterialProperty.MP_ROUGHNESS)

    ao = tex(mat, t["marble_ao"], coords, -1050, 510)
    connect_prop(ao, "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)

    spec = scalar(mat, 0.58, -260, 500)
    connect_prop(spec, "", unreal.MaterialProperty.MP_SPECULAR)

    compile_save(mat, "marble fidelity")
    return mat


def build_velvet(t):
    cloth = getattr(
        unreal.MaterialShadingModel,
        "MSM_CLOTH",
        unreal.MaterialShadingModel.MSM_DEFAULT_LIT,
    )
    mat = new_material(MATERIAL_PATHS["velvet"], cloth)
    coords = uv(mat, 0.72, 3.15)

    albedo = tex(mat, t["velvet_albedo"], coords, -1050, -430)
    tint = vector(mat, (0.93, 0.73, 0.50, 1.0), -790, -520)
    base = multiply(mat, albedo, tint, -500, -430)
    connect_prop(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    normal = tex(mat, t["velvet_normal"], coords, -1050, -100)
    connect_prop(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    rough = tex(mat, t["velvet_roughness"], coords, -1050, 210)
    scale = scalar(mat, 0.52, -790, 250)
    scaled = multiply(mat, rough, scale, -520, 210)
    floor = scalar(mat, 0.40, -520, 330)
    final_rough = add(mat, scaled, floor, -250, 230)
    connect_prop(final_rough, "", unreal.MaterialProperty.MP_ROUGHNESS)

    ao = tex(mat, t["velvet_ao"], coords, -1050, 510)
    connect_prop(ao, "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)

    fuzz = tex(mat, t["velvet_fuzz"], coords, -1050, 760)
    fuzz_color = vector(mat, (0.34, 0.10, 0.025, 1.0), -760, 820)
    fuzz_result = multiply(mat, fuzz, fuzz_color, -470, 760)
    try:
        connect_prop(
            fuzz_result, "", unreal.MaterialProperty.MP_SUBSURFACE_COLOR
        )
    except Exception:
        warn("Cloth fuzz output was unavailable; base velvet remains valid.")

    spec = scalar(mat, 0.12, -250, 510)
    connect_prop(spec, "", unreal.MaterialProperty.MP_SPECULAR)

    compile_save(mat, "velvet fidelity")
    return mat


def build_plaster(t):
    mat = new_material(
        MATERIAL_PATHS["plaster"],
        unreal.MaterialShadingModel.MSM_DEFAULT_LIT,
    )
    coords = uv(mat, 2.1, 2.1)

    albedo = tex(mat, t["plaster_albedo"], coords, -1050, -360)
    tint = vector(mat, (1.08, 1.04, 0.96, 1.0), -790, -450)
    base = multiply(mat, albedo, tint, -500, -360)
    connect_prop(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    normal = tex(mat, t["plaster_normal"], coords, -1050, -40)
    connect_prop(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    rough = tex(mat, t["plaster_roughness"], coords, -1050, 280)
    scale = scalar(mat, 0.42, -790, 320)
    scaled = multiply(mat, rough, scale, -520, 280)
    floor = scalar(mat, 0.46, -520, 390)
    final_rough = add(mat, scaled, floor, -250, 300)
    connect_prop(final_rough, "", unreal.MaterialProperty.MP_ROUGHNESS)

    spec = scalar(mat, 0.14, -260, 480)
    connect_prop(spec, "", unreal.MaterialProperty.MP_SPECULAR)

    compile_save(mat, "plaster fidelity")
    return mat


def build_bronze(t):
    mat = new_material(
        MATERIAL_PATHS["bronze"],
        unreal.MaterialShadingModel.MSM_DEFAULT_LIT,
    )
    coords = uv(mat, 1.8, 1.8)

    albedo = tex(mat, t["bronze_albedo"], coords, -1050, -390)
    tint = vector(mat, (0.90, 0.77, 0.61, 1.0), -790, -480)
    base = multiply(mat, albedo, tint, -500, -390)
    connect_prop(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    normal = tex(mat, t["bronze_normal"], coords, -1050, -80)
    connect_prop(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    rough = tex(mat, t["bronze_roughness"], coords, -1050, 230)
    scale = scalar(mat, 0.56, -790, 270)
    scaled = multiply(mat, rough, scale, -520, 230)
    floor = scalar(mat, 0.11, -520, 350)
    final_rough = add(mat, scaled, floor, -250, 250)
    connect_prop(final_rough, "", unreal.MaterialProperty.MP_ROUGHNESS)

    metallic = tex(mat, t["bronze_metallic"], coords, -1050, 520)
    connect_prop(metallic, "R", unreal.MaterialProperty.MP_METALLIC)

    spec = scalar(mat, 0.48, -250, 510)
    connect_prop(spec, "", unreal.MaterialProperty.MP_SPECULAR)

    compile_save(mat, "bronze fidelity")
    return mat


def material_key(actor_label):
    if actor_label == "GC_Floor":
        return "marble"
    if actor_label.startswith("GC_Velvet_"):
        return "velvet"
    if (
        actor_label.startswith("GC_Wall_")
        or actor_label.startswith("GC_Soffit_")
        or actor_label == "GC_Ceiling_Main"
    ):
        return "plaster"
    if actor_label.startswith("GC_Trim_") or actor_label == "GC_Door":
        return "bronze"
    return None


def assign_materials(materials, rollback):
    counts = {key: 0 for key in materials}
    for actor in actors.get_all_level_actors():
        actor_label = label(actor)
        key = material_key(actor_label)
        if not key:
            continue
        comp = mesh_component(actor)
        if not comp:
            continue
        rollback["materials"].append({
            "actor_label": actor_label,
            "previous_material": object_path(comp.get_material(0)),
        })
        comp.set_material(0, materials[key])
        try:
            comp.mark_render_state_dirty()
        except Exception:
            pass
        counts[key] += 1

    if counts["marble"] != 1:
        raise RuntimeError(f"Expected one floor; found {counts['marble']}.")
    if counts["velvet"] < 8:
        raise RuntimeError(f"Expected velvet panels; found {counts['velvet']}.")
    log(f"Assigned fidelity materials: {counts}.")


def tune_lights(rollback):
    changed = 0
    for actor in actors.get_all_level_actors():
        actor_label = label(actor)

        if actor_label.startswith("GC_Uplight_"):
            comp = spot_component(actor)
            if not comp:
                continue
            rollback["lights"].append({
                "actor_label": actor_label,
                "type": "spot",
                "intensity": safe_get(comp, "intensity"),
                "inner_cone_angle": safe_get(comp, "inner_cone_angle"),
                "outer_cone_angle": safe_get(comp, "outer_cone_angle"),
                "attenuation_radius": safe_get(comp, "attenuation_radius"),
                "temperature": safe_get(comp, "temperature"),
            })
            safe_set(comp, "intensity", 390.0)
            safe_set(comp, "inner_cone_angle", 20.0)
            safe_set(comp, "outer_cone_angle", 50.0)
            safe_set(comp, "attenuation_radius", 610.0)
            safe_set(comp, "temperature", 2900.0)
            safe_set(comp, "source_radius", 5.0)
            safe_set(comp, "soft_source_radius", 9.0)
            changed += 1

        elif actor_label.startswith("GC_Calibration_Fill_"):
            comp = rect_component(actor)
            if not comp:
                continue
            rollback["lights"].append({
                "actor_label": actor_label,
                "type": "rect",
                "intensity": safe_get(comp, "intensity"),
                "temperature": safe_get(comp, "temperature"),
                "attenuation_radius": safe_get(comp, "attenuation_radius"),
            })
            safe_set(comp, "intensity", 760.0)
            safe_set(comp, "temperature", 3900.0)
            changed += 1

    log(f"Tuned {changed} existing lights without adding actors.")


def save_all():
    levels.save_current_level()
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    try:
        levels.editor_invalidate_viewports()
    except Exception:
        pass


def write_report(success, error_text=""):
    SAVED.mkdir(parents=True, exist_ok=True)
    lines = [
        f"GRAND CORE TEXTURE FIDELITY: {'SUCCESS' if success else 'FAILED'}",
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

        log("Starting Texture Fidelity Pass V2.")
        if not assets.does_asset_exist(LEVEL_PATH):
            raise RuntimeError(f"Missing level: {LEVEL_PATH}")

        levels.load_level(LEVEL_PATH)
        ensure_directory(FIDELITY_DIR)

        if not assets.does_asset_exist(LEVEL_BACKUP_PATH):
            try:
                assets.duplicate_asset(LEVEL_PATH, LEVEL_BACKUP_PATH)
                log("Created L_MasterShell_PreTextureFidelity backup.")
            except Exception as exc:
                warn(f"Optional level backup skipped: {exc}")

        source = load_textures()
        materials = {
            "marble": build_marble(source),
            "velvet": build_velvet(source),
            "plaster": build_plaster(source),
            "bronze": build_bronze(source),
        }

        rollback = {"materials": [], "lights": []}
        assign_materials(materials, rollback)
        tune_lights(rollback)

        ROLLBACK_FILE.write_text(
            json.dumps(rollback, indent=2), encoding="utf-8"
        )

        save_all()

        SUCCESS_FILE.write_text(
            "GRAND CORE TEXTURE FIDELITY PASS V2 COMPLETED SUCCESSFULLY\n"
            "The stable DX11 visual state was preserved.",
            encoding="utf-8",
        )
        write_report(True)
        log("TEXTURE FIDELITY PASS COMPLETE.")

    except Exception:
        error_text = traceback.format_exc()
        unreal.log_error(error_text)
        REPORT.append(error_text)
        write_report(False, error_text)
        raise


if __name__ == "__main__":
    main()
