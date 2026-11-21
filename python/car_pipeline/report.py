"""
Asset Inspection Report Formatter.

Formats terminal (human-readable) and JSON (machine-readable) diagnostic outputs.
"""

import json
from typing import Any, Dict

from .glb_reader import GLBContainer
from .hierarchy import HierarchyInfo
from .geometry import GeometryInfo
from .materials import MaterialInfo
from .validation import ValidationReport, ValidationSeverity


def format_terminal_report(
    container: GLBContainer,
    hierarchy: HierarchyInfo,
    geometry: GeometryInfo,
    materials: MaterialInfo,
    validation: ValidationReport,
) -> str:
    """
    Renders structured, clear terminal output matching the specification.
    """
    lines = []
    lines.append("============================================================")
    lines.append("3D CAR MODEL — ASSET INSPECTION")
    lines.append("============================================================")
    lines.append(f"File:          {container.file_path}")
    lines.append(f"File Size:     {container.actual_file_size:,} bytes ({container.actual_file_size / (1024 * 1024):.2f} MB)")
    
    integrity_status = "PASS" if not container.has_errors else "FAIL"
    lines.append(f"GLB Integrity: {integrity_status} (v{container.version})")
    lines.append("")

    # Scene & Hierarchy
    lines.append("SCENE")
    lines.append(f"Scenes:        {hierarchy.scene_count} (Active Scene: {hierarchy.active_scene_index})")
    lines.append(f"Nodes:         {hierarchy.total_nodes} (Root Nodes: {len(hierarchy.root_nodes)})")
    lines.append(f"Meshes:        {geometry.mesh_count}")
    if hierarchy.duplicate_node_names:
        lines.append(f"Duplicate Names: {len(hierarchy.duplicate_node_names)} names duplicated")
    lines.append("")

    # Geometry
    lines.append("GEOMETRY")
    lines.append(f"Primitives:    {geometry.primitive_count} ({geometry.indexed_primitive_count} indexed, {geometry.non_indexed_primitive_count} non-indexed)")
    lines.append(f"Vertices:      {geometry.total_vertices:,}")
    lines.append(f"Triangles:     {geometry.total_triangles:,}")

    bbox = geometry.overall_bounding_box
    if bbox.is_valid:
        lines.append(
            f"Bounding Box:  X=[{bbox.min_point[0]:.2f}, {bbox.max_point[0]:.2f}], "
            f"Y=[{bbox.min_point[1]:.2f}, {bbox.max_point[1]:.2f}], "
            f"Z=[{bbox.min_point[2]:.2f}, {bbox.max_point[2]:.2f}]"
        )
        lines.append(f"Dimensions:    W={bbox.size[0]:.2f}m, H={bbox.size[1]:.2f}m, L={bbox.size[2]:.2f}m")
    else:
        lines.append("Bounding Box:  UNAVAILABLE (Missing min/max accessor metadata)")
    lines.append("")

    # Materials
    lines.append("MATERIALS")
    lines.append(f"Materials:     {materials.material_count}")
    lines.append(f"Textures:      {materials.texture_count}")
    lines.append(f"Images:        {materials.image_count}")
    if materials.has_clearcoat_materials:
        lines.append("Clearcoat:     YES (KHR_materials_clearcoat detected)")
    if materials.has_transmission_materials:
        lines.append("Transmission:  YES (KHR_materials_transmission detected)")
    lines.append("")

    # Vehicle Structure
    audit = hierarchy.vehicle_audit
    lines.append("VEHICLE STRUCTURE")
    lines.append(f"Chassis:       {len(audit.chassis_nodes)} node(s) identified")
    
    door_summary = []
    if audit.door_fl_nodes: door_summary.append(f"FL({len(audit.door_fl_nodes)})")
    if audit.door_fr_nodes: door_summary.append(f"FR({len(audit.door_fr_nodes)})")
    if audit.door_rl_nodes: door_summary.append(f"RL({len(audit.door_rl_nodes)})")
    if audit.door_rr_nodes: door_summary.append(f"RR({len(audit.door_rr_nodes)})")
    door_str = ", ".join(door_summary) if door_summary else "None identified"
    lines.append(f"Doors:         {door_str}")

    door_pivots_str = ", ".join(audit.door_pivots) if audit.door_pivots else "None (Unrigged)"
    lines.append(f"Door pivots:   {door_pivots_str}")
    lines.append(f"Bonnet pivot:  {audit.bonnet_pivot or 'None (Unrigged)'}")
    lines.append(f"Boot pivot:    {audit.boot_pivot or 'None (Unrigged)'}")
    lines.append(f"Wheel assemblies: {len(audit.wheel_nodes)} node(s), {len(audit.wheel_pivots)} pivot(s)")
    lines.append(f"Monolithic:    {'YES (Requires component separation)' if audit.is_monolithic else 'NO'}")
    lines.append(f"Suitability:   {int(audit.suitability_score * 100)}%")
    lines.append("")

    # Validation
    lines.append("VALIDATION")
    lines.append(f"PASS:          {validation.pass_count}")
    lines.append(f"WARNING:       {validation.warning_count}")
    lines.append(f"ERROR:         {validation.error_count}")
    lines.append("")

    if validation.issues:
        lines.append("DIAGNOSTIC ISSUES:")
        for issue in validation.issues:
            if issue.severity == ValidationSeverity.PASS:
                continue
            icon = "[!]" if issue.severity == ValidationSeverity.WARNING else "[X]"
            lines.append(f"  {icon} {issue.severity.value}: [{issue.rule_id}] {issue.message}")
            if issue.details:
                lines.append(f"      Hint: {issue.details}")
        lines.append("")

    lines.append("------------------------------------------------------------")
    lines.append(f"FINAL RESULT:  {validation.overall_status.value}")
    lines.append("============================================================")

    return "\n".join(lines)


def format_json_report(
    container: GLBContainer,
    hierarchy: HierarchyInfo,
    geometry: GeometryInfo,
    materials: MaterialInfo,
    validation: ValidationReport,
) -> Dict[str, Any]:
    """
    Produces clean, machine-readable JSON dictionary with all metrics and validation items.
    """
    bbox = geometry.overall_bounding_box
    return {
        "file": {
            "path": container.file_path,
            "size_bytes": container.actual_file_size,
            "declared_size_bytes": container.declared_file_size,
            "glb_version": container.version,
            "is_valid_container": not container.has_errors,
            "chunk_count": len(container.chunks),
            "chunks": [
                {
                    "type": c.chunk_type_name,
                    "length": c.chunk_length,
                    "offset": c.byte_offset,
                }
                for c in container.chunks
            ],
        },
        "scene": {
            "scene_count": hierarchy.scene_count,
            "active_scene": hierarchy.active_scene_index,
            "total_nodes": hierarchy.total_nodes,
            "root_nodes": hierarchy.root_nodes,
            "duplicate_node_names": hierarchy.duplicate_node_names,
            "mesh_count": geometry.mesh_count,
        },
        "geometry": {
            "primitive_count": geometry.primitive_count,
            "total_vertices": geometry.total_vertices,
            "total_triangles": geometry.total_triangles,
            "indexed_primitives": geometry.indexed_primitive_count,
            "non_indexed_primitives": geometry.non_indexed_primitive_count,
            "bounding_box": {
                "is_valid": bbox.is_valid,
                "min": bbox.min_point if bbox.is_valid else None,
                "max": bbox.max_point if bbox.is_valid else None,
                "size": bbox.size if bbox.is_valid else None,
                "center": bbox.center if bbox.is_valid else None,
            },
        },
        "materials": {
            "material_count": materials.material_count,
            "texture_count": materials.texture_count,
            "image_count": materials.image_count,
            "has_clearcoat": materials.has_clearcoat_materials,
            "has_transmission": materials.has_transmission_materials,
            "materials_list": [
                {
                    "index": m.index,
                    "name": m.name,
                    "pbr": {
                        "base_color_factor": m.pbr.base_color_factor,
                        "metallic_factor": m.pbr.metallic_factor,
                        "roughness_factor": m.pbr.roughness_factor,
                    },
                    "has_clearcoat": m.clearcoat is not None,
                    "has_transmission": m.transmission is not None,
                }
                for m in materials.materials
            ],
        },
        "vehicle_structure": {
            "is_monolithic": hierarchy.vehicle_audit.is_monolithic,
            "suitability_score": hierarchy.vehicle_audit.suitability_score,
            "chassis_nodes": hierarchy.vehicle_audit.chassis_nodes,
            "door_fl_nodes": hierarchy.vehicle_audit.door_fl_nodes,
            "door_fr_nodes": hierarchy.vehicle_audit.door_fr_nodes,
            "door_rl_nodes": hierarchy.vehicle_audit.door_rl_nodes,
            "door_rr_nodes": hierarchy.vehicle_audit.door_rr_nodes,
            "bonnet_nodes": hierarchy.vehicle_audit.bonnet_nodes,
            "boot_nodes": hierarchy.vehicle_audit.boot_nodes,
            "wheel_nodes": hierarchy.vehicle_audit.wheel_nodes,
            "door_pivots": hierarchy.vehicle_audit.door_pivots,
            "bonnet_pivot": hierarchy.vehicle_audit.bonnet_pivot,
            "boot_pivot": hierarchy.vehicle_audit.boot_pivot,
            "wheel_pivots": hierarchy.vehicle_audit.wheel_pivots,
        },
        "validation": {
            "overall_status": validation.overall_status.value,
            "pass_count": validation.pass_count,
            "warning_count": validation.warning_count,
            "error_count": validation.error_count,
            "issues": [
                {
                    "rule_id": issue.rule_id,
                    "severity": issue.severity.value,
                    "message": issue.message,
                    "details": issue.details,
                }
                for issue in validation.issues
            ],
        },
    }
