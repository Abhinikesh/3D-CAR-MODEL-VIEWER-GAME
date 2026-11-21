#!/usr/bin/env python3
"""
3D Car Model and Viewer — Command-Line Model Inspector.

Usage:
    python inspect_model.py path/to/model.glb [options]

Options:
    --json                  Output raw JSON instead of human-readable terminal report.
    --output FILE, -o FILE  Save the report (JSON or text) to specified file path.
    --strict                Treat warnings as errors (exit code 1 on any warning).
    --warn-triangles N      Custom warning threshold for triangle count (default: 250,000).
    --warn-size-mb N        Custom warning threshold for file size in MB (default: 35.0).
    --help, -h              Show this help message and exit.

Exit Codes:
    0: Valid (PASS, or WARNING in non-strict mode).
    1: Validation ERRORs (or WARNINGs in strict mode).
    2: Invalid arguments or unreadable file.
"""

import argparse
import json
import os
import sys

# Ensure car_pipeline can be imported when running script directly
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from car_pipeline.glb_reader import read_glb_file
from car_pipeline.hierarchy import inspect_hierarchy
from car_pipeline.geometry import inspect_geometry
from car_pipeline.materials import inspect_materials
from car_pipeline.validation import (
    validate_model,
    ValidationSeverity,
    ValidationThresholds,
)
from car_pipeline.report import format_terminal_report, format_json_report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="3D Car Model & Viewer — Khronos GLTF 2.0 Binary (GLB) Inspector",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("model", help="Path to the .glb model file to inspect")
    parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Format report as machine-readable JSON",
    )
    parser.add_argument(
        "--output",
        "-o",
        dest="output_file",
        help="Write report to the specified file path",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Elevate warnings to errors (exits with code 1 on any warning)",
    )
    parser.add_argument(
        "--warn-triangles",
        type=int,
        default=250_000,
        help="Triangle count warning threshold (default: 250,000)",
    )
    parser.add_argument(
        "--warn-size-mb",
        type=float,
        default=35.0,
        help="File size warning threshold in MB (default: 35.0)",
    )

    args = parser.parse_args()

    # Step 1: Input file existence check
    if not os.path.exists(args.model):
        sys.stderr.write(f"Error: Specified model file does not exist: '{args.model}'\n")
        return 2

    if not os.path.isfile(args.model):
        sys.stderr.write(f"Error: Specified path is not a file: '{args.model}'\n")
        return 2

    # Step 2: Parse GLB Container
    container = read_glb_file(args.model)

    # Step 3: Parse Subsystems
    hierarchy = inspect_hierarchy(container.json_data)
    geometry = inspect_geometry(container.json_data)
    materials = inspect_materials(container.json_data)

    # Step 4: Validate
    thresholds = ValidationThresholds(
        warn_triangles=args.warn_triangles,
        warn_file_size_mb=args.warn_size_mb,
    )
    validation = validate_model(
        container=container,
        hierarchy=hierarchy,
        geometry=geometry,
        materials=materials,
        thresholds=thresholds,
        strict=args.strict,
    )

    # Step 5: Format Report
    if args.as_json or (args.output_file and args.output_file.endswith(".json")):
        json_dict = format_json_report(container, hierarchy, geometry, materials, validation)
        formatted_output = json.dumps(json_dict, indent=2)
    else:
        formatted_output = format_terminal_report(container, hierarchy, geometry, materials, validation)

    # Step 6: Output Handling
    if args.output_file:
        try:
            out_dir = os.path.dirname(os.path.abspath(args.output_file))
            if out_dir and not os.path.exists(out_dir):
                os.makedirs(out_dir, exist_ok=True)
            with open(args.output_file, "w", encoding="utf-8") as f:
                f.write(formatted_output)
            print(f"Report written to: {args.output_file}")
        except Exception as e:
            sys.stderr.write(f"Error writing to output file '{args.output_file}': {str(e)}\n")
            return 2
    else:
        print(formatted_output)

    # Step 7: Determine Exit Code
    # 0 = PASS or WARNING (in non-strict mode)
    # 1 = ERROR (or WARNING in strict mode)
    if validation.overall_status == ValidationSeverity.ERROR:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
