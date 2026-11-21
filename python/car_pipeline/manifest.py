"""
Manifest Generator for 3D Car Asset Pipeline
Produces a structured, machine-readable JSON manifest detailing nodes,
meshes, materials, semantic groupings, and pivot candidates.
"""

import json
import os
from typing import Dict, Any, Optional
from .glb_reader import read_glb_file, GLBContainer
from .hierarchy import inspect_hierarchy
from .geometry import inspect_geometry
from .materials import inspect_materials

def generate_car_manifest(glb_path: str, output_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses a GLB vehicle asset and produces a comprehensive asset manifest.
    """
    if not os.path.exists(glb_path):
        raise FileNotFoundError(f"GLB asset not found: {glb_path}")

    glb = read_glb_file(glb_path)
    json_data = glb.json_data
    file_size = os.path.getsize(glb_path)

    nodes = json_data.get("nodes", [])
    meshes = json_data.get("meshes", [])
    materials = json_data.get("materials", [])
    scenes = json_data.get("scenes", [])
    active_scene_idx = json_data.get("scene", 0)
    active_scene = scenes[active_scene_idx] if scenes else {}
    root_node_indices = active_scene.get("nodes", [])

    # Build parent-child map
    parents = {}
    for i, n in enumerate(nodes):
        for ch in n.get("children", []):
            parents[ch] = i

    # Process nodes
    manifest_nodes = []
    for i, n in enumerate(nodes):
        mesh_idx = n.get("mesh")
        node_entry = {
            "index": i,
            "name": n.get("name", f"node_{i}"),
            "parent": parents.get(i),
            "children": n.get("children", []),
            "has_mesh": mesh_idx is not None,
            "mesh_index": mesh_idx,
            "mesh_name": meshes[mesh_idx].get("name", "") if mesh_idx is not None and mesh_idx < len(meshes) else None,
            "translation": n.get("translation"),
            "rotation": n.get("rotation"),
            "scale": n.get("scale"),
            "has_matrix": "matrix" in n,
        }
        manifest_nodes.append(node_entry)

    # Process meshes and primitives
    manifest_meshes = []
    for m_idx, m in enumerate(meshes):
        prims = m.get("primitives", [])
        prim_entries = []
        for p_idx, p in enumerate(prims):
            mat_idx = p.get("material")
            prim_entries.append({
                "primitive_index": p_idx,
                "material_index": mat_idx,
                "material_name": materials[mat_idx].get("name") if mat_idx is not None and mat_idx < len(materials) else None,
                "attributes": list(p.get("attributes", {}).keys()),
                "has_indices": "indices" in p,
            })
        manifest_meshes.append({
            "index": m_idx,
            "name": m.get("name", f"mesh_{m_idx}"),
            "primitive_count": len(prims),
            "primitives": prim_entries,
        })

    # Process materials
    manifest_materials = []
    for mat_idx, mat in enumerate(materials):
        pbr = mat.get("pbrMetallicRoughness", {})
        manifest_materials.append({
            "index": mat_idx,
            "name": mat.get("name", f"material_{mat_idx}"),
            "base_color_factor": pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0]),
            "metallic_factor": pbr.get("metallicFactor", 1.0),
            "roughness_factor": pbr.get("roughnessFactor", 1.0),
            "extensions": list(mat.get("extensions", {}).keys()),
            "double_sided": mat.get("doubleSided", False),
        })

    # High-level geometry & inspection
    geo_info = inspect_geometry(glb.json_data)
    hier_info = inspect_hierarchy(glb.json_data)

    # Semantic component mappings
    semantic_mappings = {
        "chassis": ["BodyUnderside", "BodyRoofPanel", "BodyPillars", "BodyPanelsColor2", "License Plate"],
        "door_fl": ["Pivot_Door_FL", "BodyDoorLColor1", "BodyDoorLColor2", "Glass_Door_FL"],
        "door_fr": ["Pivot_Door_FR", "BodyDoorRColor1", "BodyDoorRColor2", "Glass_Door_FR"],
        "bonnet": ["Pivot_Bonnet", "BodyHood", "BodyHoodInterior01", "BodyHoodInterior02", "BodyHoodTopgrill"],
        "boot": ["Pivot_Boot", "BodyRearPanelsColor1", "InteriorRearHatch", "Glass_RearWindow"],
        "wheel_fl": ["Wheel_Assembly_FL", "Mesh_Rim_FL", "Mesh_Caliper_FL", "WheelFrontLBrakeDisc"],
        "wheel_fr": ["Wheel_Assembly_FR", "Mesh_Rim_FR", "Mesh_Caliper_FR", "WheelFrontRBrakeDisc"],
        "wheel_rl": ["Wheel_Assembly_RL", "Mesh_Rim_RL", "Mesh_Caliper_RL", "WheelRearLBrakeDisc"],
        "wheel_rr": ["Wheel_Assembly_RR", "Mesh_Rim_RR", "Mesh_Caliper_RR", "WheelRearRBrakeDisc"],
        "glass": ["Glass_Windshield", "Glass_Door_FL", "Glass_Door_FR", "Glass_RearWindow", "BodyWindowsRearSides"],
        "mirrors": ["BodyDoorLMirror", "BodyDoorRMirror"],
        "headlights": ["Mesh_Headlight_Assemblies", "BodyHeadlights"],
        "taillights": ["Mesh_Taillight_Assemblies", "BodyTurnsignalsRear", "BodyTaillightsPanels"],
    }

    # Verify which semantic components can be resolved
    all_node_names = {n.get("name") for n in nodes if n.get("name")}
    resolved_semantics = {}
    for sem_id, candidates in semantic_mappings.items():
        found = [c for c in candidates if c in all_node_names]
        resolved_semantics[sem_id] = {
            "target_candidates": candidates,
            "matched_nodes": found,
            "resolved": len(found) > 0,
        }

    manifest = {
        "asset_info": {
            "source_path": glb_path,
            "file_size_bytes": file_size,
            "format": "glTF 2.0 Binary (GLB)",
            "generator": json_data.get("asset", {}).get("generator", "Unknown"),
            "version": json_data.get("asset", {}).get("version", "2.0"),
        },
        "metrics": {
            "total_nodes": len(nodes),
            "total_meshes": len(meshes),
            "total_primitives": geo_info.primitive_count,
            "total_vertices": geo_info.total_vertices,
            "total_triangles": geo_info.total_triangles,
            "total_materials": len(materials),
            "dimensions": {
                "x_width": round(geo_info.overall_bounding_box.size[0], 3) if geo_info.overall_bounding_box else 0.0,
                "y_height": round(geo_info.overall_bounding_box.size[1], 3) if geo_info.overall_bounding_box else 0.0,
                "z_length": round(geo_info.overall_bounding_box.size[2], 3) if geo_info.overall_bounding_box else 0.0,
            },
        },
        "scene_graph": {
            "active_scene": active_scene_idx,
            "root_nodes": root_node_indices,
            "duplicate_node_names": hier_info.duplicate_node_names,
            "has_cycles": hier_info.has_cycles,
        },
        "pivots": {
            "door_fl": "Pivot_Door_FL" if "Pivot_Door_FL" in all_node_names else None,
            "door_fr": "Pivot_Door_FR" if "Pivot_Door_FR" in all_node_names else None,
            "bonnet": "Pivot_Bonnet" if "Pivot_Bonnet" in all_node_names else None,
            "boot": "Pivot_Boot" if "Pivot_Boot" in all_node_names else None,
            "wheels": [
                w for w in ["Wheel_Assembly_FL", "Wheel_Assembly_FR", "Wheel_Assembly_RL", "Wheel_Assembly_RR"]
                if w in all_node_names
            ],
        },
        "semantic_components": resolved_semantics,
        "nodes": manifest_nodes,
        "meshes": manifest_meshes,
        "materials": manifest_materials,
    }

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

    return manifest
