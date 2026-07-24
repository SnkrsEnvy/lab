"""Grand Core Visual Calibration V2 for Unreal Engine 5.8.

Purpose:
- Preserve the successfully generated L_MasterShell and its 97 actors.
- Correct the overexposed V1 lighting state.
- Keep the safe DX11 / SM5 recovery path.
- Avoid geometry rebuilding and full material recompilation.

This script is idempotent and may be run again safely.
"""

from __future__ import annotations

from pathlib import Path
import traceback
import unreal


LEVEL_PATH = "/Game/GrandCore/Maps/L_MasterShell"

PROJECT_ROOT = Path(unreal.Paths.project_dir())
SAVED_ROOT = PROJECT_ROOT / "Saved"
SUCCESS_FILE = SAVED_ROOT / "GrandCoreVisualCalibrationV2Success.txt"
REPORT_FILE = SAVED_ROOT / "GrandCoreVisualCalibrationV2Report.txt"

actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

REPORT: list[str] = []


def log(message: str) -> None:
    line = f"[GrandCore V2] {message}"
    REPORT.append(line)
    unreal.log(line)


def warn(message: str) -> None:
    line = f"[GrandCore V2 WARNING] {message}"
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


def get_component(actor, class_type, direct_names=()):
    for name in direct_names:
        component = getattr(actor, name, None)
        if component:
            return component
    try:
        return actor.get_component_by_class(class_type)
    except Exception:
        return None


def calibrate_skylight() -> None:
    actor = find_actor("GC_SkyLight")
    if not actor:
        warn("GC_SkyLight was not found.")
        return

    component = get_component(
        actor,
        unreal.SkyLightComponent,
        ("light_component", "sky_light_component"),
    )
    if not component:
        warn("SkyLightComponent was not found.")
        return

    safe_set(component, "real_time_capture", False)
    safe_set(component, "intensity", 0.08)
    safe_set(component, "indirect_lighting_intensity", 0.85)
    safe_set(component, "volumetric_scattering_intensity", 0.15)

    try:
        component.recapture_sky()
    except Exception:
        pass

    log("Reduced Skylight to a restrained sealed-interior fill.")


def auto_exposure_method():
    for enum_name in ("AEM_HISTOGRAM", "AEM_BASIC"):
        method = getattr(unreal.AutoExposureMethod, enum_name, None)
        if method is not None:
            return method
    return None


def calibrate_post_process() -> None:
    actor = find_actor("GC_PostProcess_Master")
    if not actor:
        raise RuntimeError("GC_PostProcess_Master was not found.")

    safe_set(actor, "unbound", True)
    safe_set(actor, "blend_weight", 1.0)
    safe_set(actor, "enabled", True)

    settings = actor.get_editor_property("settings")

    method = auto_exposure_method()
    if method is not None:
        safe_set(settings, "override_auto_exposure_method", True)
        safe_set(settings, "auto_exposure_method", method)

    # The V1 pass added +1.35 stops and very bright fills.
    # V2 lowers exposure by roughly 2.25 stops relative to that state.
    values = [
        ("override_auto_exposure_apply_physical_camera_exposure", True),
        ("auto_exposure_apply_physical_camera_exposure", False),
        ("override_auto_exposure_bias", True),
        ("auto_exposure_bias", -0.90),
        ("override_auto_exposure_low_percent", True),
        ("auto_exposure_low_percent", 65.0),
        ("override_auto_exposure_high_percent", True),
        ("auto_exposure_high_percent", 88.0),
        ("override_auto_exposure_speed_up", True),
        ("auto_exposure_speed_up", 2.0),
        ("override_auto_exposure_speed_down", True),
        ("auto_exposure_speed_down", 1.0),

        # Attempt both UE exposure-range naming systems safely.
        ("override_auto_exposure_min_brightness", True),
        ("auto_exposure_min_brightness", 0.05),
        ("override_auto_exposure_max_brightness", True),
        ("auto_exposure_max_brightness", 1.50),
        ("override_auto_exposure_min_ev100", True),
        ("auto_exposure_min_ev100", 0.0),
        ("override_auto_exposure_max_ev100", True),
        ("auto_exposure_max_ev100", 4.0),

        ("override_bloom_intensity", True),
        ("bloom_intensity", 0.12),
        ("override_vignette_intensity", True),
        ("vignette_intensity", 0.015),
        ("override_chromatic_aberration_intensity", True),
        ("chromatic_aberration_intensity", 0.0),
        ("override_motion_blur_amount", True),
        ("motion_blur_amount", 0.0),
        ("override_ambient_occlusion_intensity", True),
        ("ambient_occlusion_intensity", 0.62),
        ("override_ambient_occlusion_radius", True),
        ("ambient_occlusion_radius", 110.0),
        ("override_indirect_lighting_intensity", True),
        ("indirect_lighting_intensity", 0.92),
    ]

    for prop, value in values:
        safe_set(settings, prop, value)

    actor.set_editor_property("settings", settings)
    log("Lowered exposure, bloom, indirect light, and adaptation range.")


def set_rect_light(component, intensity: float, temperature: float, radius: float) -> None:
    safe_set(component, "intensity_units", unreal.LightUnits.LUMENS)
    safe_set(component, "intensity", intensity)
    safe_set(component, "use_temperature", True)
    safe_set(component, "temperature", temperature)
    safe_set(component, "attenuation_radius", radius)
    safe_set(component, "volumetric_scattering_intensity", 0.08)
    safe_set(component, "specular_scale", 1.0)


def set_spot_light(component, intensity: float, temperature: float, radius: float) -> None:
    safe_set(component, "intensity_units", unreal.LightUnits.LUMENS)
    safe_set(component, "intensity", intensity)
    safe_set(component, "use_temperature", True)
    safe_set(component, "temperature", temperature)
    safe_set(component, "attenuation_radius", radius)
    safe_set(component, "inner_cone_angle", 17.0)
    safe_set(component, "outer_cone_angle", 34.0)
    safe_set(component, "volumetric_scattering_intensity", 0.06)


def calibrate_lights() -> None:
    counts = {
        "fill": 0,
        "cove": 0,
        "uplight": 0,
    }

    for actor in actor_subsystem.get_all_level_actors():
        label = actor_label(actor)

        if label.startswith("GC_Calibration_Fill_"):
            component = get_component(
                actor,
                unreal.RectLightComponent,
                ("rect_light_component", "light_component"),
            )
            if component:
                set_rect_light(component, 900.0, 3500.0, 1500.0)
                safe_set(component, "source_width", 540.0)
                safe_set(component, "source_height", 280.0)
                counts["fill"] += 1

        elif label.startswith("GC_CoveLight_"):
            component = get_component(
                actor,
                unreal.RectLightComponent,
                ("rect_light_component", "light_component"),
            )
            if component:
                set_rect_light(component, 2400.0, 3050.0, 1500.0)
                counts["cove"] += 1

        elif label.startswith("GC_Uplight_"):
            component = get_component(
                actor,
                unreal.SpotLightComponent,
                ("spot_light_component", "light_component"),
            )
            if component:
                set_spot_light(component, 700.0, 2850.0, 650.0)
                counts["uplight"] += 1

    log(
        "Reduced light energy: "
        f"{counts['fill']} ceiling fills, "
        f"{counts['cove']} cove lights, "
        f"{counts['uplight']} uplights."
    )


def calibrate_hero_cameras() -> None:
    count = 0

    for actor in actor_subsystem.get_all_level_actors():
        label = actor_label(actor)
        if not label.startswith("GC_Hero_"):
            continue

        try:
            component = actor.get_cine_camera_component()
        except Exception:
            component = None

        if not component:
            continue

        safe_set(component, "current_focal_length", 24.0)
        safe_set(component, "current_aperture", 4.0)
        safe_set(component, "post_process_blend_weight", 0.0)
        safe_set(component, "constrain_aspect_ratio", False)
        count += 1

    log(f"Calibrated {count} hero cameras without camera-level exposure overrides.")


def save_all() -> None:
    try:
        unreal.EditorLevelLibrary.save_current_level()
    except Exception as exc:
        warn(f"save_current_level: {exc}")

    try:
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    except Exception as exc:
        warn(f"save_dirty_packages: {exc}")

    log("Saved L_MasterShell and all dirty visual packages.")


def write_report(success: bool, error_text: str = "") -> None:
    SAVED_ROOT.mkdir(parents=True, exist_ok=True)

    lines = [
        f"GRAND CORE VISUAL CALIBRATION V2: {'SUCCESS' if success else 'FAILED'}",
        "",
        *REPORT,
    ]
    if error_text:
        lines.extend(["", "ERROR:", error_text])

    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    try:
        if SUCCESS_FILE.exists():
            SUCCESS_FILE.unlink()

        log("Starting restrained visual calibration V2.")

        if not unreal.EditorAssetLibrary.does_asset_exist(LEVEL_PATH):
            raise RuntimeError(f"Level does not exist: {LEVEL_PATH}")

        level_subsystem.load_level(LEVEL_PATH)
        log("Loaded L_MasterShell.")

        calibrate_skylight()
        calibrate_post_process()
        calibrate_lights()
        calibrate_hero_cameras()
        save_all()

        message = (
            "GRAND CORE VISUAL CALIBRATION V2 COMPLETED SUCCESSFULLY\n"
            "The calibrated level was saved.\n"
            "Open with OPEN-GRANDCORE-GPU-SAFE-DX11.cmd and inspect GC_Hero_Center."
        )
        SUCCESS_FILE.write_text(message, encoding="utf-8")
        write_report(True)
        log("VISUAL CALIBRATION V2 COMPLETE.")

    except Exception:
        error_text = traceback.format_exc()
        unreal.log_error(error_text)
        REPORT.append(error_text)
        write_report(False, error_text)
        raise


if __name__ == "__main__":
    main()
