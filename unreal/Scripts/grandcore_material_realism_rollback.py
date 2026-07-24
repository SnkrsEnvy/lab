"""Rollback Grand Core Material Realism assignments and light changes."""

from __future__ import annotations

from pathlib import Path
import json
import traceback
import unreal


LEVEL_PATH = "/Game/GrandCore/Maps/L_MasterShell"

PROJECT_ROOT = Path(unreal.Paths.project_dir())
ROLLBACK_FILE = PROJECT_ROOT / "Saved" / "GrandCoreMaterialRealismRollback.json"
REPORT_FILE = PROJECT_ROOT / "Saved" / "GrandCoreMaterialRealismRollbackReport.txt"

actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def safe_set(obj, prop, value):
    if obj is None or value is None:
        return
    try:
        obj.set_editor_property(prop, value)
    except Exception:
        pass


def label_map():
    result = {}
    for actor in actor_subsystem.get_all_level_actors():
        try:
            result[actor.get_actor_label()] = actor
        except Exception:
            pass
    return result


def static_component(actor):
    comp = getattr(actor, "static_mesh_component", None)
    if comp:
        return comp
    try:
        return actor.get_component_by_class(unreal.StaticMeshComponent)
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


def spot_component(actor):
    comp = getattr(actor, "spot_light_component", None)
    if comp:
        return comp
    try:
        return actor.get_component_by_class(unreal.SpotLightComponent)
    except Exception:
        return None


def main():
    try:
        if not ROLLBACK_FILE.exists():
            raise RuntimeError(f"Rollback record not found: {ROLLBACK_FILE}")

        level_subsystem.load_level(LEVEL_PATH)
        actors = label_map()
        data = json.loads(ROLLBACK_FILE.read_text(encoding="utf-8"))

        material_count = 0
        for item in data.get("materials", []):
            actor = actors.get(item.get("actor_label", ""))
            if not actor:
                continue
            component = static_component(actor)
            material = unreal.load_asset(item.get("material_path", ""))
            if component and material:
                component.set_material(0, material)
                try:
                    component.mark_render_state_dirty()
                except Exception:
                    pass
                material_count += 1

        light_count = 0
        for item in data.get("lights", []):
            actor = actors.get(item.get("actor_label", ""))
            if not actor:
                continue

            if item.get("type") == "spot":
                component = spot_component(actor)
            else:
                component = rect_component(actor)

            if not component:
                continue

            for prop in (
                "intensity",
                "attenuation_radius",
                "temperature",
                "volumetric_scattering_intensity",
                "inner_cone_angle",
                "outer_cone_angle",
                "source_radius",
                "soft_source_radius",
            ):
                safe_set(component, prop, item.get(prop))

            light_count += 1

        level_subsystem.save_current_level()
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)

        REPORT_FILE.write_text(
            "GRAND CORE MATERIAL REALISM ROLLBACK: SUCCESS\n\n"
            f"Restored {material_count} material assignments.\n"
            f"Restored {light_count} light configurations.\n",
            encoding="utf-8",
        )

        unreal.log(
            f"[GrandCore Rollback] Restored {material_count} materials and "
            f"{light_count} lights."
        )

    except Exception:
        error_text = traceback.format_exc()
        unreal.log_error(error_text)
        REPORT_FILE.write_text(
            "GRAND CORE MATERIAL REALISM ROLLBACK: FAILED\n\n"
            + error_text,
            encoding="utf-8",
        )
        raise


if __name__ == "__main__":
    main()
