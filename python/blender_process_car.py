#!/usr/bin/env python3
"""
3D Car Model and Viewer — Headless Blender Model Processor & Rigging Tool.

This script is designed to run inside Blender (v3.6 LTS or v4.x) via command line:
    blender --background --python blender_process_car.py -- [options]

When run in standard Python (outside Blender), it prints configuration schemas and help documentation.

Options (passed after '--'):
    --input PATH        Path to raw input model (.blend, .fbx, .obj, .gltf, .glb) [Required]
    --output PATH       Path for exported sanitized .glb [Required]
    --config PATH       JSON configuration defining explicit pivot positions and axis vectors [Optional]
    --scale-factor S    Multiplier for model scale (e.g. 0.01 for cm to meters) [Default: 1.0]
    --draco             Enable Draco geometry compression during GLTF export [Default: False]
    --dry-run           Inspect and validate scene without saving [Default: False]
    --help, -h          Show this help message and exit
"""

import argparse
import json
import os
import sys

# Safe import of bpy: will only succeed when executed inside Blender
try:
    import bpy  # type: ignore
    IS_BLENDER = True
except ImportError:
    bpy = None
    IS_BLENDER = False


DEFAULT_PIVOT_CONFIG_SCHEMA = {
    "description": "Explicit mechanical pivot coordinates and axis vectors for automotive components.",
    "scale_factor": 1.0,
    "pivots": {
        "Pivot_Door_FL": {
            "target_mesh": "Door_FL",
            "position": [-0.95, 0.85, 0.45],
            "rotation_axis": [0.0, 1.0, 0.0],
            "max_angle_deg": 65.0,
        },
        "Pivot_Door_FR": {
            "target_mesh": "Door_FR",
            "position": [0.95, 0.85, 0.45],
            "rotation_axis": [0.0, 1.0, 0.0],
            "max_angle_deg": -65.0,
        },
        "Pivot_Door_RL": {
            "target_mesh": "Door_RL",
            "position": [-0.95, 0.85, -0.65],
            "rotation_axis": [0.0, 1.0, 0.0],
            "max_angle_deg": 60.0,
        },
        "Pivot_Door_RR": {
            "target_mesh": "Door_RR",
            "position": [0.95, 0.85, -0.65],
            "rotation_axis": [0.0, 1.0, 0.0],
            "max_angle_deg": -60.0,
        },
        "Pivot_Bonnet": {
            "target_mesh": "Bonnet",
            "position": [0.0, 1.10, 1.35],
            "rotation_axis": [1.0, 0.0, 0.0],
            "max_angle_deg": -45.0,
        },
        "Pivot_Boot": {
            "target_mesh": "Boot",
            "position": [0.0, 1.25, -1.65],
            "rotation_axis": [1.0, 0.0, 0.0],
            "max_angle_deg": 50.0,
        },
        "Wheel_Assembly_FL": {
            "target_mesh": "Wheel_FL",
            "center": [-0.85, 0.35, 1.45],
        },
        "Wheel_Assembly_FR": {
            "target_mesh": "Wheel_FR",
            "center": [0.85, 0.35, 1.45],
        },
        "Wheel_Assembly_RL": {
            "target_mesh": "Wheel_RL",
            "center": [-0.85, 0.35, -1.45],
        },
        "Wheel_Assembly_RR": {
            "target_mesh": "Wheel_RR",
            "center": [0.85, 0.35, -1.45],
        },
    },
}


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Headless Blender 3D Automotive Asset Normalizer & Pivot Rigging Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input", required=True, help="Path to input raw 3D model")
    parser.add_argument("--output", required=True, help="Destination path for sanitized .glb")
    parser.add_argument("--config", help="Path to JSON file specifying explicit hinge pivot coordinates")
    parser.add_argument("--scale-factor", type=float, default=1.0, help="Uniform scale factor (default: 1.0)")
    parser.add_argument("--draco", action="store_true", help="Enable Draco geometry compression on export")
    parser.add_argument("--dry-run", action="store_true", help="Perform inspection without writing to disk")
    return parser


def process_scene_in_blender(args: argparse.Namespace) -> int:
    """
    Executes scene rigging, pivot alignment, and GLTF export inside Blender.
    """
    print(f"[Blender] Blender version: {bpy.app.version_string}")
    if bpy.app.version < (3, 6, 0):
        print(f"[Error] Unsupported Blender version: {bpy.app.version_string}. Minimum required is 3.6 LTS.")
        return 1

    # 1. Reset Scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # 2. Import input model based on extension
    ext = os.path.splitext(args.input)[1].lower()
    print(f"[Blender] Importing raw asset '{args.input}' ({ext})...")

    if ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=args.input)
    elif ext in (".gltf", ".glb"):
        bpy.ops.import_scene.gltf(filepath=args.input)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=args.input)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=args.input)
    else:
        print(f"[Error] Unsupported input file format: {ext}")
        return 1

    # 3. Apply optional scale factor
    if args.scale_factor != 1.0:
        print(f"[Blender] Applying scale factor: {args.scale_factor}")
        for obj in bpy.context.scene.objects:
            obj.scale *= args.scale_factor
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # 4. Process explicit pivots from config if supplied
    if args.config and os.path.exists(args.config):
        print(f"[Blender] Loading pivot configuration from '{args.config}'...")
        with open(args.config, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        pivots = cfg.get("pivots", {})

        for pivot_name, p_data in pivots.items():
            target_mesh_name = p_data.get("target_mesh")
            target_obj = bpy.data.objects.get(target_mesh_name)
            if not target_obj:
                print(f"[Blender Warning] Target mesh '{target_mesh_name}' not found for pivot '{pivot_name}'.")
                continue

            pos = p_data.get("position", [0.0, 0.0, 0.0])
            print(f"[Blender] Creating Empty Pivot '{pivot_name}' at {pos} for mesh '{target_mesh_name}'")
            pivot_empty = bpy.data.objects.new(pivot_name, None)
            pivot_empty.empty_display_type = "ARROWS"
            pivot_empty.empty_display_size = 0.2
            pivot_empty.location = (pos[0], pos[1], pos[2])
            bpy.context.scene.collection.objects.link(pivot_empty)

            # Re-parent target mesh under pivot keeping transform
            target_obj.parent = pivot_empty
            target_obj.matrix_parent_inverse = pivot_empty.matrix_world.inverted()

    # 5. Export to GLTF 2.0 Binary
    if args.dry_run:
        print("[Blender] Dry run requested. Skipping GLB export.")
        return 0

    print(f"[Blender] Exporting sanitized GLB to '{args.output}' (Draco: {args.draco})...")
    out_dir = os.path.dirname(os.path.abspath(args.output))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    export_kwargs = {
        "filepath": args.output,
        "export_format": "GLB",
        "use_selection": False,
        "export_apply": True,
        "export_draco_mesh_compression_enable": args.draco,
    }

    bpy.ops.export_scene.gltf(**export_kwargs)
    print(f"[Blender] Successfully exported: {args.output}")
    return 0


def main() -> int:
    # Handle arguments passed after Blender's '--' separator
    argv = sys.argv
    if "--" in argv:
        raw_args = argv[argv.index("--") + 1 :]
    else:
        raw_args = argv[1:]

    parser = build_arg_parser()

    if not IS_BLENDER:
        # Running in standalone Python (outside Blender)
        print("===================================================================")
        print("3D CAR MODEL — BLENDER AUTOMATION TOOL (STANDALONE INTERFACE)")
        print("===================================================================")
        print("Notice: Blender is currently not running in this session.")
        print("This script is designed to run via headless Blender CLI:")
        print("  blender --background --python python/blender_process_car.py -- [options]")
        print("")
        print("Default Pivot Configuration Schema Template:")
        print(json.dumps(DEFAULT_PIVOT_CONFIG_SCHEMA, indent=2))
        print("===================================================================")
        if not raw_args or "-h" in raw_args or "--help" in raw_args:
            parser.print_help()
            return 0
        print("\nTo execute scene processing, run this command with Blender installed.")
        return 0

    # Inside Blender
    args = parser.parse_args(raw_args)

    if not os.path.exists(args.input):
        print(f"[Error] Input file does not exist: {args.input}")
        return 1

    if os.path.abspath(args.input) == os.path.abspath(args.output):
        print("[Error] Output path cannot match input path (cannot overwrite original source asset).")
        return 1

    return process_scene_in_blender(args)


if __name__ == "__main__":
    sys.exit(main())
