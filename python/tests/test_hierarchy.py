"""
Unit Tests for Scene Graph & Hierarchy Inspector (hierarchy.py).
"""

from car_pipeline.hierarchy import inspect_hierarchy
from tests.fixtures.glb_generator import (
    create_minimal_valid_gltf_dict,
    create_mock_car_gltf_dict,
)


def test_minimal_hierarchy_traversal():
    gltf_dict = create_minimal_valid_gltf_dict()
    info = inspect_hierarchy(gltf_dict)

    assert info.scene_count == 1
    assert info.active_scene_index == 0
    assert info.total_nodes == 1
    assert info.root_nodes == [0]
    assert len(info.nodes) == 1
    assert info.nodes[0].name == "RootNode"
    assert info.nodes[0].mesh_index == 0
    assert len(info.duplicate_node_names) == 0
    assert not info.has_cycles
    assert len(info.invalid_node_references) == 0


def test_duplicate_node_names_detection():
    gltf_dict = {
        "scenes": [{"nodes": [0, 1]}],
        "nodes": [
            {"name": "Wheel_Rim"},
            {"name": "Wheel_Rim"},  # Duplicate name
            {"name": "Unique_Chassis"},
        ],
    }
    info = inspect_hierarchy(gltf_dict)
    assert info.total_nodes == 3
    assert "Wheel_Rim" in info.duplicate_node_names
    assert info.duplicate_node_names["Wheel_Rim"] == [0, 1]


def test_invalid_child_node_reference():
    gltf_dict = {
        "scenes": [{"nodes": [0]}],
        "nodes": [
            {"name": "ParentNode", "children": [99]},  # Index 99 does not exist!
        ],
    }
    info = inspect_hierarchy(gltf_dict)
    assert len(info.invalid_node_references) > 0
    assert any("out-of-bounds child index 99" in ref for ref in info.invalid_node_references)


def test_cyclic_hierarchy_detection():
    # Node 0 has child 1; Node 1 has child 0
    gltf_dict = {
        "scenes": [{"nodes": [0]}],
        "nodes": [
            {"name": "NodeA", "children": [1]},
            {"name": "NodeB", "children": [0]},
        ],
    }
    info = inspect_hierarchy(gltf_dict)
    assert info.has_cycles
    assert any("Cyclic parent-child" in ref for ref in info.invalid_node_references)


def test_vehicle_structure_audit_with_pivots():
    gltf_dict = create_mock_car_gltf_dict(with_pivots=True)
    info = inspect_hierarchy(gltf_dict)

    audit = info.vehicle_audit
    assert not audit.is_monolithic
    assert len(audit.chassis_nodes) > 0
    assert len(audit.wheel_nodes) > 0
    assert len(audit.door_fl_nodes) > 0
    assert "Pivot_Door_FL" in audit.door_pivots
    assert audit.suitability_score >= 0.6


def test_vehicle_structure_audit_without_pivots():
    gltf_dict = create_mock_car_gltf_dict(with_pivots=False)
    info = inspect_hierarchy(gltf_dict)

    audit = info.vehicle_audit
    assert len(audit.door_pivots) == 0
