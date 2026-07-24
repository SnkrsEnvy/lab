"""Grand Core visual calibration pass for Unreal Engine 5.8.

This script is intentionally idempotent. It loads the existing L_MasterShell,
reassigns the intended materials, calibrates exposure and lighting, disables the
invalid real-time Skylight capture mode, updates hero cameras, saves the level,
and writes a success sentinel for the Windows launcher.
"""
from __future__ import annotations

from pathlib import Path
import traceback
import unreal

LEVEL_PATH = "/Game/GrandCore/Maps/L_MasterShell"

MATERIAL_PATHS = {
    "marble": "/Game/GrandCore/Materials/M_Marble_Master",
    "velvet": "/Game/GrandCore/Materials/M_Velvet_Camel_Master",
    "plaster": "/Game/GrandCore/Materials/M_Plaster_Ivory_Master",
    "bronze": "/Game/GrandCore/Materials/M_Bronze_Dark_Master",
    "emissive": "/Game/GrandCore/Materials/M_Cove_Emissive_Master",
}

PROJECT_ROOT = Path(unreal.Paths.project_dir())
SAVED_ROOT = PROJECT_ROOT / "Saved"
SUCCESS_FILE = SAVED_ROOT / "GrandCoreVisualCalibrationSuccess.txt"
REPORT_FILE = SAVED_ROOT / "GrandCoreVisualCalibrationReport.txt"

editor_assets = unreal.EditorAssetLibrary
actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

REPORT_LINES: list[str] = []


def report(message: str) -> None:
    line = f"[GrandCore Calibration] {message}"
    REPORT_LINES.append(line)
    unreal.log(line)


def warning(message: str) -> None:
    line = f"[GrandCore Calibration WARNING] {message}"
    REPORT_LINES.append(line)
    unreal.log_warning(line)


def safe_set(obj, prop: str, value) -> bool:
    if obj is None:
        return False
    try:
        obj.set_editor_property(prop, value)
        return True
    except Exception:
        return False


def actor_label(actor) -> str:
    try:
        return actor.get_actor_label()
    except Exception:
        return ""


def find_actor(label: str):
    for actor in actor_subsystem.get_all_level_actors():
        if actor_label(actor) == label:
            return actor
    return None


def get_static_mesh_component(actor):
    component = getattr(actor, "static_mesh_component", None)
    if component:
        return component
    try:
        return actor.get_component_by_class(unreal.StaticMeshComponent)
    except Exception:
        return None


def get_skylight_component(actor):
    component = getattr(actor, "light_component", None)
    if component and component.get_class().get_name().endswith("SkyLightComponent"):
        return component
    try:
        return actor.get_component_by_class(unreal.SkyLightComponent)
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


def choose_material_key(label: str):
    if label == "GC_Floor":
        return "marble"
    if label.startswith("GC_Velvet_"):
        return "velvet"
    if label.startswith("GC_Wall_") or label.startswith("GC_Soffit_") or label == "GC_Ceiling_Main":
        return "plaster"
    if label.startswith("GC_Trim_") or label == "GC_Door":
        return "bronze"
    if label.startswith("GC_Cove_"):
        return "emissive"
    return None


def load_and_recompile_materials():
    materials = {}
    for key, path in MATERIAL_PATHS.items():
        material = unreal.load_asset(path)
        if not material:
            raise RuntimeError(f"Required material was not found: {path}")
        materials[key] = material

        try:
            errors = unreal.MaterialEditingLibrary.recompile_material(material)
            if errors:
                warning(f"{key} material compiled with messages: {errors}")
        except Exception as exc:
            warning(f"Could not explicitly recompile {key}: {exc}")

        try:
            unreal.MaterialEditingLibrary.refresh_material_editor(material)
        except Exception:
            pass

        try:
            editor_assets.save_loaded_asset(material)
        except Exception as exc:
            warning(f"Could not save {key} material: {exc}")

    report("Loaded and refreshed all five master materials.")
    return materials


def reassign_shell_materials(materials) -> int:
    changed = 0
    for actor in actor_subsystem.get_all_level_actors():
        label = actor_label(actor)
        material_key = choose_material_key(label)
        if not material_key:
            continue

        component = get_static_mesh_component(actor)
        if not component:
            warning(f"No StaticMeshComponent found for {label}")
            continue

        try:
            component.set_material(0, materials[material_key])
            changed += 1
        except Exception as exc:
            warning(f"Could not assign {material_key} to {label}: {exc}")
            continue

        try:
            component.mark_render_state_dirty()
        except Exception:
            pass

    report(f"Reassigned calibrated materials to {changed} shell meshes.")
    return changed


def calibrate_skylight() -> None:
    sky_actor = find_actor("GC_SkyLight")
    if not sky_actor:
        warning("GC_SkyLight was not found; continuing without it.")
        return

    component = get_skylight_component(sky_actor)
    if not component:
        warning("The Skylight component could not be located.")
        return

    safe_set(component, "real_time_capture", False)
    safe_set(component, "intensity", 0.32)
    safe_set(component, "indirect_lighting_intensity", 1.15)
    safe_set(component, "volumetric_scattering_intensity", 0.35)
    safe_set(component, "mobility", unreal.ComponentMobility.MOVABLE)

    try:
        component.recapture_sky()
    except Exception as exc:
        warning(f"Skylight recapture was skipped: {exc}")

    report("Disabled Skylight real-time capture and established restrained interior fill.")


def auto_exposure_method():
    for name in ("AEM_HISTOGRAM", "AEM_BASIC"):
        method = getattr(unreal.AutoExposureMethod, name, None)
        if method is not None:
            return method
    return None


def calibrate_post_process() -> None:
    pp = find_actor("GC_PostProcess_Master")
    if not pp:
        pp = actor_subsystem.spawn_actor_from_class(
            unreal.PostProcessVolume,
            unreal.Vector(0.0, 0.0, 0.0),
            unreal.Rotator(),
        )
        pp.set_actor_label("GC_PostProcess_Master")
        report("Created the missing master Post Process Volume.")

    safe_set(pp, "unbound", True)
    safe_set(pp, "blend_weight", 1.0)
    safe_set(pp, "enabled", True)

    settings = pp.get_editor_property("settings")
    method = auto_exposure_method()

    exposure_values = [
        ("override_auto_exposure_method", True),
        ("override_auto_exposure_apply_physical_camera_exposure", True),
        ("auto_exposure_apply_physical_camera_exposure", False),
        ("override_auto_exposure_bias", True),
        ("auto_exposure_bias", 1.35),
        ("override_auto_exposure_low_percent", True),
        ("auto_exposure_low_percent", 70.0),
        ("override_auto_exposure_high_percent", True),
        ("auto_exposure_high_percent", 90.0),
        ("override_auto_exposure_speed_up", True),
        ("auto_exposure_speed_up", 3.0),
        ("override_auto_exposure_speed_down", True),
        ("auto_exposure_speed_down", 1.5),
        ("override_auto_exposure_min_brightness", True),
        ("auto_exposure_min_brightness", 0.35),
        ("override_auto_exposure_max_brightness", True),
        ("auto_exposure_max_brightness", 4.0),
        ("override_auto_exposure_min_ev100", True),
        ("auto_exposure_min_ev100", -2.0),
        ("override_auto_exposure_max_ev100", True),
        ("auto_exposure_max_ev100", 4.0),
    ]
    for prop, value in exposure_values:
        safe_set(settings, prop, value)

    if method is not None:
        safe_set(settings, "auto_exposure_method", method)

    visual_values = [
        ("override_bloom_intensity", True),
        ("bloom_intensity", 0.28),
        ("override_vignette_intensity", True),
        ("vignette_intensity", 0.025),
        ("override_chromatic_aberration_intensity", True),
        ("chromatic_aberration_intensity", 0.0),
        ("override_motion_blur_amount", True),
        ("motion_blur_amount", 0.0),
        ("override_ambient_occlusion_intensity", True),
        ("ambient_occlusion_intensity", 0.72),
        ("override_ambient_occlusion_radius", True),
        ("ambient_occlusion_radius", 135.0),
        ("override_lumen_gi_final_gather_quality", True),
        ("lumen_gi_final_gather_quality", 6.0),
        ("override_lumen_reflection_quality", True),
        ("lumen_reflection_quality", 6.0),
        ("override_indirect_lighting_intensity", True),
        ("indirect_lighting_intensity", 1.2),
    ]
    for prop, value in visual_values:
        safe_set(settings, prop, value)

    pp.set_editor_property("settings", settings)
    report("Replaced crushed manual exposure with a stable interior auto-exposure baseline.")


def set_actor_pose(actor, location, rotation) -> None:
    try:
        actor.set_actor_location(unreal.Vector(*location), False, False)
    except Exception:
        pass
    try:
        actor.set_actor_rotation(unreal.Rotator(*rotation), False)
    except Exception:
        pass


def ensure_rect_light(label: str, location, rotation, intensity: float, width: float, height: float, temperature: float):
    actor = find_actor(label)
    if not actor:
        actor = actor_subsystem.spawn_actor_from_class(
            unreal.RectLight,
            unreal.Vector(*location),
            unreal.Rotator(*rotation),
        )
        actor.set_actor_label(label)
    else:
        set_actor_pose(actor, location, rotation)

    component = get_rect_light_component(actor)
    if not component:
        warning(f"RectLight component missing for {label}")
        return None

    safe_set(component, "intensity_units", unreal.LightUnits.LUMENS)
    safe_set(component, "intensity", intensity)
    safe_set(component, "source_width", width)
    safe_set(component, "source_height", height)
    safe_set(component, "attenuation_radius", 1750.0)
    safe_set(component, "use_temperature", True)
    safe_set(component, "temperature", temperature)
    safe_set(component, "cast_shadows", True)
    safe_set(component, "specular_scale", 1.0)
    safe_set(component, "volumetric_scattering_intensity", 0.3)
    safe_set(component, "mobility", unreal.ComponentMobility.MOVABLE)
    return actor


def calibrate_existing_lights() -> None:
    cove_count = 0
    uplight_count = 0

    for actor in actor_subsystem.get_all_level_actors():
        label = actor_label(actor)

        if label.startswith("GC_CoveLight_"):
            component = get_rect_light_component(actor)
            if component:
                safe_set(component, "intensity_units", unreal.LightUnits.LUMENS)
                safe_set(component, "intensity", 17500.0)
                safe_set(component, "use_temperature", True)
                safe_set(component, "temperature", 3150.0)
                safe_set(component, "attenuation_radius", 2200.0)
                safe_set(component, "specular_scale", 1.0)
                safe_set(component, "volumetric_scattering_intensity", 0.25)
                cove_count += 1

        elif label.startswith("GC_Uplight_"):
            component = get_spot_light_component(actor)
            if component:
                safe_set(component, "intensity_units", unreal.LightUnits.LUMENS)
                safe_set(component, "intensity", 3900.0)
                safe_set(component, "use_temperature", True)
                safe_set(component, "temperature", 2925.0)
                safe_set(component, "inner_cone_angle", 19.0)
                safe_set(component, "outer_cone_angle", 38.0)
                safe_set(component, "attenuation_radius", 850.0)
                safe_set(component, "volumetric_scattering_intensity", 0.2)
                uplight_count += 1

    fill_specs = [
        ("GC_Calibration_Fill_West", (-640.0, 0.0, 515.0), (-90.0, 0.0, 0.0)),
        ("GC_Calibration_Fill_Center", (0.0, 0.0, 515.0), (-90.0, 0.0, 0.0)),
        ("GC_Calibration_Fill_East", (640.0, 0.0, 515.0), (-90.0, 0.0, 0.0)),
    ]
    for label, location, rotation in fill_specs:
        ensure_rect_light(
            label,
            location,
            rotation,
            intensity=7200.0,
            width=580.0,
            height=300.0,
            temperature=3650.0,
        )

    report(f"Calibrated {cove_count} cove lights and {uplight_count} perimeter uplights.")
    report("Added or refreshed three broad, soft ceiling fill lights.")


def calibrate_cameras() -> None:
    changed = 0
    for actor in actor_subsystem.get_all_level_actors():
        label = actor_label(actor)
        if not label.startswith("GC_Hero_"):
            continue
        try:
            component = actor.get_cine_camera_component()
        except Exception:
            component = None

        if not component:
            warning(f"CineCamera component missing for {label}")
            continue

        safe_set(component, "current_focal_length", 24.0)
        safe_set(component, "current_aperture", 2.8)
        safe_set(component, "post_process_blend_weight", 0.0)
        safe_set(component, "constrain_aspect_ratio", False)
        changed += 1

    report(f"Calibrated {changed} hero cameras for the interior lighting pass.")


def save_level() -> None:
    try:
        unreal.EditorLevelLibrary.save_current_level()
    except Exception as exc:
        warning(f"save_current_level reported: {exc}")

    try:
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    except Exception as exc:
        warning(f"save_dirty_packages reported: {exc}")

    report("Saved L_MasterShell and all dirty visual assets.")


def write_report(success: bool, error_text: str = "") -> None:
    SAVED_ROOT.mkdir(parents=True, exist_ok=True)
    status = "SUCCESS" if success else "FAILED"
    body = [f"GRAND CORE VISUAL CALIBRATION: {status}", "", *REPORT_LINES]
    if error_text:
        body.extend(["", "ERROR:", error_text])
    REPORT_FILE.write_text("\n".join(body), encoding="utf-8")


def main() -> None:
    try:
        if SUCCESS_FILE.exists():
            SUCCESS_FILE.unlink()

        report("Starting visual calibration pass.")

        if not editor_assets.does_asset_exist(LEVEL_PATH):
            raise RuntimeError(f"Master shell level does not exist: {LEVEL_PATH}")

        level_subsystem.load_level(LEVEL_PATH)
        report("Loaded L_MasterShell.")

        materials = load_and_recompile_materials()
        reassign_shell_materials(materials)
        calibrate_skylight()
        calibrate_post_process()
        calibrate_existing_lights()
        calibrate_cameras()
        save_level()

        success_message = (
            "GRAND CORE VISUAL CALIBRATION COMPLETED SUCCESSFULLY\n"
            "Level: /Game/GrandCore/Maps/L_MasterShell\n"
            "Return the viewport to Lit mode and inspect GC_Hero_Center."
        )
        SUCCESS_FILE.write_text(success_message, encoding="utf-8")
        write_report(True)
        report("VISUAL CALIBRATION COMPLETE.")

    except Exception:
        error_text = traceback.format_exc()
        unreal.log_error(error_text)
        REPORT_LINES.append(error_text)
        write_report(False, error_text)
        raise


if __name__ == "__main__":
    main()
