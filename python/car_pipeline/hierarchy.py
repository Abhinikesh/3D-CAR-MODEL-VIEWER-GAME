"""
Scene Graph & Node Hierarchy Inspector.

Analyzes scenes, nodes, parent-child relationships, transform descriptors,
and detects automotive component naming patterns and articulated pivot structures.
"""

from dataclasses import dataclass, field
import re
from typing import Any, Dict, List, Optional, Set, Tuple


@dataclass
class NodeTransform:
    has_matrix: bool = False
    matrix: Optional[List[float]] = None
    translation: Optional[List[float]] = None
    rotation: Optional[List[float]] = None
    scale: Optional[List[float]] = None


@dataclass
class NodeInfo:
    index: int
    name: str
    children: List[int] = field(default_factory=list)
    parent: Optional[int] = None
    mesh_index: Optional[int] = None
    transform: NodeTransform = field(default_factory=NodeTransform)


@dataclass
class VehicleStructureAudit:
    chassis_nodes: List[str] = field(default_factory=list)
    door_fl_nodes: List[str] = field(default_factory=list)
    door_fr_nodes: List[str] = field(default_factory=list)
    door_rl_nodes: List[str] = field(default_factory=list)
    door_rr_nodes: List[str] = field(default_factory=list)
    bonnet_nodes: List[str] = field(default_factory=list)
    boot_nodes: List[str] = field(default_factory=list)
    wheel_nodes: List[str] = field(default_factory=list)
    glass_nodes: List[str] = field(default_factory=list)
    light_nodes: List[str] = field(default_factory=list)
    
    # Explicit pivot nodes detected
    door_pivots: List[str] = field(default_factory=list)
    bonnet_pivot: Optional[str] = None
    boot_pivot: Optional[str] = None
    wheel_pivots: List[str] = field(default_factory=list)

    is_monolithic: bool = False
    suitability_score: float = 0.0  # 0.0 to 1.0


@dataclass
class HierarchyInfo:
    scene_count: int = 0
    active_scene_index: int = 0
    total_nodes: int = 0
    root_nodes: List[int] = field(default_factory=list)
    nodes: List[NodeInfo] = field(default_factory=list)
    duplicate_node_names: Dict[str, List[int]] = field(default_factory=dict)
    mesh_node_mapping: Dict[int, List[int]] = field(default_factory=dict)
    invalid_node_references: List[str] = field(default_factory=list)
    has_cycles: bool = False
    vehicle_audit: VehicleStructureAudit = field(default_factory=VehicleStructureAudit)


def inspect_hierarchy(gltf_data: Optional[Dict[str, Any]]) -> HierarchyInfo:
    """
    Performs full scene graph hierarchy traversal and semantic vehicle structure audit.
    """
    info = HierarchyInfo()
    if not gltf_data or not isinstance(gltf_data, dict):
        return info

    scenes = gltf_data.get("scenes", [])
    info.scene_count = len(scenes)
    info.active_scene_index = gltf_data.get("scene", 0)

    raw_nodes = gltf_data.get("nodes", [])
    info.total_nodes = len(raw_nodes)

    if info.total_nodes == 0:
        return info

    # Step 1: Initialize NodeInfo structures
    name_tracker: Dict[str, List[int]] = {}
    for idx, raw_node in enumerate(raw_nodes):
        name = raw_node.get("name", f"Node_{idx}")
        node_info = NodeInfo(
            index=idx,
            name=name,
            children=raw_node.get("children", []),
            mesh_index=raw_node.get("mesh"),
        )

        # Parse Transforms
        if "matrix" in raw_node:
            node_info.transform.has_matrix = True
            node_info.transform.matrix = raw_node.get("matrix")
        else:
            node_info.transform.translation = raw_node.get("translation", [0.0, 0.0, 0.0])
            node_info.transform.rotation = raw_node.get("rotation", [0.0, 0.0, 0.0, 1.0])
            node_info.transform.scale = raw_node.get("scale", [1.0, 1.0, 1.0])

        info.nodes.append(node_info)

        # Track name duplicates
        if name in name_tracker:
            name_tracker[name].append(idx)
        else:
            name_tracker[name] = [idx]

        # Mesh-to-node mapping
        if node_info.mesh_index is not None:
            if node_info.mesh_index not in info.mesh_node_mapping:
                info.mesh_node_mapping[node_info.mesh_index] = []
            info.mesh_node_mapping[node_info.mesh_index].append(idx)

    info.duplicate_node_names = {name: indices for name, indices in name_tracker.items() if len(indices) > 1}

    # Step 2: Parent-Child relationship resolution and validity checks
    child_to_parent: Dict[int, int] = {}
    for idx, node in enumerate(info.nodes):
        for child_idx in node.children:
            if not isinstance(child_idx, int) or child_idx < 0 or child_idx >= info.total_nodes:
                info.invalid_node_references.append(
                    f"Node {idx} ('{node.name}') references out-of-bounds child index {child_idx}."
                )
                continue

            if child_idx in child_to_parent:
                info.invalid_node_references.append(
                    f"Node {child_idx} ('{info.nodes[child_idx].name}') has multiple parents: {child_to_parent[child_idx]} and {idx}."
                )
            else:
                child_to_parent[child_idx] = idx
                info.nodes[child_idx].parent = idx

    # Step 3: Identify Root Nodes
    if 0 <= info.active_scene_index < len(scenes):
        active_scene = scenes[info.active_scene_index]
        scene_roots = active_scene.get("nodes", [])
        for r in scene_roots:
            if 0 <= r < info.total_nodes:
                info.root_nodes.append(r)
            else:
                info.invalid_node_references.append(
                    f"Active scene {info.active_scene_index} references out-of-bounds root node index {r}."
                )
    else:
        # Fallback: all nodes without parent
        info.root_nodes = [node.index for node in info.nodes if node.parent is None]

    # Step 4: Cycle detection
    visited: Set[int] = set()
    rec_stack: Set[int] = set()

    def has_cycle_dfs(node_idx: int) -> bool:
        visited.add(node_idx)
        rec_stack.add(node_idx)
        for c in info.nodes[node_idx].children:
            if 0 <= c < info.total_nodes:
                if c not in visited:
                    if has_cycle_dfs(c):
                        return True
                elif c in rec_stack:
                    return True
        rec_stack.remove(node_idx)
        return False

    for root in info.root_nodes:
        if root not in visited:
            if has_cycle_dfs(root):
                info.has_cycles = True
                info.invalid_node_references.append("Cyclic parent-child reference detected in scene graph.")
                break

    # Step 5: Vehicle Structure & Articulation Audit
    audit = info.vehicle_audit
    audit.is_monolithic = (info.total_nodes <= 2 and len(info.mesh_node_mapping) <= 1)

    # Regex patterns for vehicle components
    p_chassis = re.compile(r"(chassis|body|exterior|car_body|paint|shell)", re.IGNORECASE)
    p_door_fl = re.compile(r"(door.*(fl|front_l|left_front|l_front|\b_?l\b|_?l_?color|_?l_?mesh)|(fl|left_front).*door|doorl)", re.IGNORECASE)
    p_door_fr = re.compile(r"(door.*(fr|front_r|right_front|r_front|\b_?r\b|_?r_?color|_?r_?mesh)|(fr|right_front).*door|doorr)", re.IGNORECASE)
    p_door_rl = re.compile(r"(door.*(rl|rear_l|left_rear|l_rear)|(rl|left_rear).*door)", re.IGNORECASE)
    p_door_rr = re.compile(r"(door.*(rr|rear_r|right_rear|r_rear)|(rr|right_rear).*door)", re.IGNORECASE)
    p_bonnet = re.compile(r"(bonnet|hood)", re.IGNORECASE)
    p_boot = re.compile(r"(boot|trunk|tailgate|rear.*(hatch|panel))", re.IGNORECASE)
    p_wheel = re.compile(r"(wheel|rim|tire|tyre|caliper|brake)", re.IGNORECASE)
    p_glass = re.compile(r"(glass|windshield|windscreen|window)", re.IGNORECASE)
    p_light = re.compile(r"(light|headlight|taillight|lamp|turn_signal)", re.IGNORECASE)

    p_pivot_door = re.compile(r"(pivot.*door|door.*pivot|bodydoor[lr])", re.IGNORECASE)
    p_pivot_bonnet = re.compile(r"(pivot.*(bonnet|hood)|(bonnet|hood).*pivot|bodyhood)", re.IGNORECASE)
    p_pivot_boot = re.compile(r"(pivot.*(boot|trunk)|(boot|trunk).*pivot|bodyrearpanels)", re.IGNORECASE)
    p_pivot_wheel = re.compile(r"(pivot.*wheel|wheel.*pivot|spin_pivot|steer_pivot|wheelfront|wheelrear)", re.IGNORECASE)

    for node in info.nodes:
        n_name = node.name
        if p_chassis.search(n_name):
            audit.chassis_nodes.append(n_name)
        if p_door_fl.search(n_name):
            audit.door_fl_nodes.append(n_name)
        if p_door_fr.search(n_name):
            audit.door_fr_nodes.append(n_name)
        if p_door_rl.search(n_name):
            audit.door_rl_nodes.append(n_name)
        if p_door_rr.search(n_name):
            audit.door_rr_nodes.append(n_name)
        if p_bonnet.search(n_name):
            audit.bonnet_nodes.append(n_name)
        if p_boot.search(n_name):
            audit.boot_nodes.append(n_name)
        if p_wheel.search(n_name):
            audit.wheel_nodes.append(n_name)
        if p_glass.search(n_name):
            audit.glass_nodes.append(n_name)
        if p_light.search(n_name):
            audit.light_nodes.append(n_name)

        # Pivots
        if p_pivot_door.search(n_name):
            audit.door_pivots.append(n_name)
        if p_pivot_bonnet.search(n_name) and not audit.bonnet_pivot:
            audit.bonnet_pivot = n_name
        if p_pivot_boot.search(n_name) and not audit.boot_pivot:
            audit.boot_pivot = n_name
        if p_pivot_wheel.search(n_name):
            audit.wheel_pivots.append(n_name)

    # Compute suitability score
    score = 0.0
    if not audit.is_monolithic:
        score += 0.2
    if len(audit.chassis_nodes) > 0:
        score += 0.2
    if len(audit.wheel_nodes) >= 4:
        score += 0.2
    elif len(audit.wheel_nodes) > 0:
        score += 0.1
    if len(audit.door_fl_nodes) > 0 or len(audit.door_fr_nodes) > 0:
        score += 0.2
    if len(audit.door_pivots) > 0 or audit.bonnet_pivot or audit.boot_pivot:
        score += 0.2
    audit.suitability_score = min(1.0, score)

    return info
