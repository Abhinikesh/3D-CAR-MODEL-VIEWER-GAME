"""
Geometry & Mesh Topology Inspector.

Analyzes meshes, primitives, vertex/triangle counts, primitive topology,
attributes (POSITION, NORMAL, etc.), accessor references, and bounding box dimensions.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# glTF Primitive Rendering Modes
MODE_POINTS = 0
MODE_LINES = 1
MODE_LINE_LOOP = 2
MODE_LINE_STRIP = 3
MODE_TRIANGLES = 4
MODE_TRIANGLE_STRIP = 5
MODE_TRIANGLE_FAN = 6


@dataclass
class BoundingBox:
    min_point: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    max_point: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    size: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    center: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    is_valid: bool = False

    def update(self, other_min: List[float], other_max: List[float]):
        if not self.is_valid:
            self.min_point = list(other_min)
            self.max_point = list(other_max)
            self.is_valid = True
        else:
            for i in range(3):
                self.min_point[i] = min(self.min_point[i], other_min[i])
                self.max_point[i] = max(self.max_point[i], other_max[i])

        self.size = [self.max_point[i] - self.min_point[i] for i in range(3)]
        self.center = [(self.max_point[i] + self.min_point[i]) / 2.0 for i in range(3)]


@dataclass
class PrimitiveInfo:
    mesh_index: int
    primitive_index: int
    mode: int
    mode_name: str
    attributes: List[str]
    has_position: bool
    is_indexed: bool
    vertex_count: int
    triangle_count: int
    material_index: Optional[int]
    bounding_box: Optional[BoundingBox] = None


@dataclass
class GeometryInfo:
    mesh_count: int = 0
    primitive_count: int = 0
    total_vertices: int = 0
    total_triangles: int = 0
    indexed_primitive_count: int = 0
    non_indexed_primitive_count: int = 0
    primitives: List[PrimitiveInfo] = field(default_factory=list)
    overall_bounding_box: BoundingBox = field(default_factory=BoundingBox)
    missing_position_primitives: List[str] = field(default_factory=list)
    invalid_accessor_references: List[str] = field(default_factory=list)


def inspect_geometry(gltf_data: Optional[Dict[str, Any]]) -> GeometryInfo:
    """
    Parses meshes, primitives, vertex counts, triangle counts, and bounding dimensions.
    """
    info = GeometryInfo()
    if not gltf_data or not isinstance(gltf_data, dict):
        return info

    raw_meshes = gltf_data.get("meshes", [])
    accessors = gltf_data.get("accessors", [])
    info.mesh_count = len(raw_meshes)

    mode_names = {
        MODE_POINTS: "POINTS",
        MODE_LINES: "LINES",
        MODE_LINE_LOOP: "LINE_LOOP",
        MODE_LINE_STRIP: "LINE_STRIP",
        MODE_TRIANGLES: "TRIANGLES",
        MODE_TRIANGLE_STRIP: "TRIANGLE_STRIP",
        MODE_TRIANGLE_FAN: "TRIANGLE_FAN",
    }

    for m_idx, mesh in enumerate(raw_meshes):
        mesh_name = mesh.get("name", f"Mesh_{m_idx}")
        primitives = mesh.get("primitives", [])

        for p_idx, prim in enumerate(primitives):
            info.primitive_count += 1
            mode = prim.get("mode", MODE_TRIANGLES)
            mode_name = mode_names.get(mode, f"UNKNOWN({mode})")

            attributes = prim.get("attributes", {})
            attr_keys = list(attributes.keys())
            has_pos = "POSITION" in attributes

            prim_bbox = BoundingBox()
            vertex_count = 0
            triangle_count = 0
            is_indexed = "indices" in prim

            # Check POSITION accessor
            if has_pos:
                pos_acc_idx = attributes["POSITION"]
                if isinstance(pos_acc_idx, int) and 0 <= pos_acc_idx < len(accessors):
                    pos_acc = accessors[pos_acc_idx]
                    vertex_count = pos_acc.get("count", 0)

                    # Extract Bounding Box from accessor min/max
                    if "min" in pos_acc and "max" in pos_acc:
                        min_vals = pos_acc["min"]
                        max_vals = pos_acc["max"]
                        if (
                            isinstance(min_vals, list)
                            and isinstance(max_vals, list)
                            and len(min_vals) >= 3
                            and len(max_vals) >= 3
                        ):
                            prim_bbox.update(min_vals[:3], max_vals[:3])
                            info.overall_bounding_box.update(min_vals[:3], max_vals[:3])
                else:
                    info.invalid_accessor_references.append(
                        f"Mesh {m_idx} ('{mesh_name}'), Prim {p_idx} references invalid POSITION accessor index {pos_acc_idx}."
                    )
            else:
                info.missing_position_primitives.append(
                    f"Mesh {m_idx} ('{mesh_name}'), Primitive {p_idx} is missing required 'POSITION' attribute."
                )

            # Check INDICES accessor and compute triangle count
            if is_indexed:
                info.indexed_primitive_count += 1
                idx_acc_idx = prim["indices"]
                if isinstance(idx_acc_idx, int) and 0 <= idx_acc_idx < len(accessors):
                    idx_acc = accessors[idx_acc_idx]
                    indices_count = idx_acc.get("count", 0)
                    if mode == MODE_TRIANGLES:
                        triangle_count = indices_count // 3
                    elif mode in (MODE_TRIANGLE_STRIP, MODE_TRIANGLE_FAN):
                        triangle_count = max(0, indices_count - 2)
                    else:
                        triangle_count = 0
                else:
                    info.invalid_accessor_references.append(
                        f"Mesh {m_idx} ('{mesh_name}'), Prim {p_idx} references invalid indices accessor index {idx_acc_idx}."
                    )
            else:
                info.non_indexed_primitive_count += 1
                if mode == MODE_TRIANGLES:
                    triangle_count = vertex_count // 3
                elif mode in (MODE_TRIANGLE_STRIP, MODE_TRIANGLE_FAN):
                    triangle_count = max(0, vertex_count - 2)
                else:
                    triangle_count = 0

            info.total_vertices += vertex_count
            info.total_triangles += triangle_count

            prim_info = PrimitiveInfo(
                mesh_index=m_idx,
                primitive_index=p_idx,
                mode=mode,
                mode_name=mode_name,
                attributes=attr_keys,
                has_position=has_pos,
                is_indexed=is_indexed,
                vertex_count=vertex_count,
                triangle_count=triangle_count,
                material_index=prim.get("material"),
                bounding_box=prim_bbox if prim_bbox.is_valid else None,
            )
            info.primitives.append(prim_info)

    return info
