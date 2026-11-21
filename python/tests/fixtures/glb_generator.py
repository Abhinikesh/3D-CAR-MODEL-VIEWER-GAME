"""
Programmatic Synthetic GLB Fixture Generator for Unit & Integration Tests.

Constructs valid and intentionally corrupted GLB byte streams according to the
Khronos glTF 2.0 specification without external network assets.
"""

import json
import struct
from typing import Any, Dict, Optional

GLB_MAGIC = 0x46546C67  # b"glTF"
GLB_VERSION_2 = 2
CHUNK_TYPE_JSON = 0x4E4F534A
CHUNK_TYPE_BIN = 0x004E4942


def pad_bytes(data: bytes, pad_char: bytes = b" ") -> bytes:
    """Pad byte string to 4-byte boundary."""
    remainder = len(data) % 4
    if remainder != 0:
        return data + (pad_char * (4 - remainder))
    return data


def build_glb_bytes(
    json_dict: Dict[str, Any],
    bin_bytes: Optional[bytes] = None,
    magic: int = GLB_MAGIC,
    version: int = GLB_VERSION_2,
    corrupt_declared_length: Optional[int] = None,
    raw_json_str: Optional[str] = None,
    first_chunk_type: int = CHUNK_TYPE_JSON,
) -> bytes:
    """
    Constructs raw GLB bytes from a JSON dict and optional binary buffer.
    """
    if raw_json_str is not None:
        json_bytes = pad_bytes(raw_json_str.encode("utf-8"), b" ")
    else:
        json_bytes = pad_bytes(json.dumps(json_dict).encode("utf-8"), b" ")

    chunks = []
    # Chunk 0
    chunks.append((first_chunk_type, json_bytes))

    # Chunk 1 (BIN)
    if bin_bytes is not None:
        padded_bin = pad_bytes(bin_bytes, b"\x00")
        chunks.append((CHUNK_TYPE_BIN, padded_bin))

    total_chunks_length = sum(8 + len(data) for _, data in chunks)
    total_file_length = 12 + total_chunks_length

    if corrupt_declared_length is not None:
        header_length = corrupt_declared_length
    else:
        header_length = total_file_length

    header = struct.pack("<III", magic, version, header_length)

    out = bytearray(header)
    for c_type, c_data in chunks:
        out.extend(struct.pack("<II", len(c_data), c_type))
        out.extend(c_data)

    return bytes(out)


def create_minimal_valid_gltf_dict() -> Dict[str, Any]:
    """Returns minimal valid glTF 2.0 dictionary."""
    return {
        "asset": {"version": "2.0", "generator": "TestGLBGenerator"},
        "scenes": [{"name": "DefaultScene", "nodes": [0]}],
        "scene": 0,
        "nodes": [{"name": "RootNode", "mesh": 0}],
        "meshes": [
            {
                "name": "TriangleMesh",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0},
                        "indices": 1,
                        "mode": 4,
                    }
                ],
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,  # FLOAT
                "count": 3,
                "type": "VEC3",
                "max": [1.0, 1.0, 0.0],
                "min": [-1.0, -1.0, 0.0],
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5123,  # UNSIGNED_SHORT
                "count": 3,
                "type": "SCALAR",
                "max": [2],
                "min": [0],
            },
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": 36, "target": 34962},
            {"buffer": 0, "byteOffset": 36, "byteLength": 6, "target": 34963},
        ],
        "buffers": [{"byteLength": 44}],
    }


def create_mock_car_gltf_dict(with_pivots: bool = True) -> Dict[str, Any]:
    """Returns a glTF dictionary representing a structured automotive model."""
    nodes = [
        {"name": "Car_Root", "children": [1, 2, 3, 4]},
        {"name": "Chassis_Body_Static", "mesh": 0},
        {"name": "Wheel_Assembly_FL", "mesh": 1},
    ]

    if with_pivots:
        nodes.append({"name": "Pivot_Door_FL", "children": [4]})
        nodes.append({"name": "Door_FL_Mesh", "mesh": 2})
        nodes[0]["children"] = [1, 2, 3]  # root points to chassis, wheel, pivot
    else:
        nodes.append({"name": "Door_FL_Mesh", "mesh": 2})
        nodes[0]["children"] = [1, 2, 3]

    return {
        "asset": {"version": "2.0", "generator": "TestCarGenerator"},
        "scenes": [{"name": "ShowroomScene", "nodes": [0]}],
        "scene": 0,
        "nodes": nodes,
        "meshes": [
            {
                "name": "Chassis_Mesh",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0},
                        "indices": 1,
                        "material": 0,
                    }
                ],
            },
            {
                "name": "Wheel_Mesh",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0},
                        "indices": 1,
                        "material": 1,
                    }
                ],
            },
            {
                "name": "Door_Mesh",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0},
                        "indices": 1,
                        "material": 0,
                    }
                ],
            },
        ],
        "materials": [
            {
                "name": "Material_Body_Paint",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.1, 0.2, 0.5, 1.0],
                    "metallicFactor": 0.9,
                    "roughnessFactor": 0.2,
                },
                "extensions": {
                    "KHR_materials_clearcoat": {
                        "clearcoatFactor": 1.0,
                        "clearcoatRoughnessFactor": 0.05,
                    }
                },
            },
            {
                "name": "Material_Rim_Chrome",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.9, 0.9, 0.9, 1.0],
                    "metallicFactor": 1.0,
                    "roughnessFactor": 0.1,
                },
            },
        ],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,
                "count": 12,
                "type": "VEC3",
                "max": [0.95, 1.45, 2.25],
                "min": [-0.95, 0.0, -2.25],
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5123,
                "count": 18,
                "type": "SCALAR",
                "max": [11],
                "min": [0],
            },
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": 144},
            {"buffer": 0, "byteOffset": 144, "byteLength": 36},
        ],
        "buffers": [{"byteLength": 180}],
    }
