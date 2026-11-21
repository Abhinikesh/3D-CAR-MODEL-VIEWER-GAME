"""
GLB Binary File Reader & Low-Level Container Inspector.

Parses the Khronos glTF 2.0 Binary (GLB) 12-byte header and 8-byte chunk headers,
extracting the JSON scene descriptor and binary buffers while validating structural integrity.
"""

from dataclasses import dataclass, field
import json
import os
import struct
from typing import Any, Dict, List, Optional, Tuple

GLB_MAGIC = 0x46546C67  # b"glTF"
GLB_VERSION_2 = 2
CHUNK_TYPE_JSON = 0x4E4F534A  # b"JSON"
CHUNK_TYPE_BIN = 0x004E4942   # b"BIN\x00"


@dataclass
class GLBChunk:
    chunk_type: int
    chunk_type_name: str
    chunk_length: int
    byte_offset: int
    data: bytes


@dataclass
class GLBContainer:
    file_path: str
    actual_file_size: int
    declared_file_size: int = 0
    version: int = 0
    magic: int = 0
    is_valid_header: bool = False
    chunks: List[GLBChunk] = field(default_factory=list)
    json_data: Optional[Dict[str, Any]] = None
    bin_data: Optional[bytes] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0


def read_glb_file(file_path: str) -> GLBContainer:
    """
    Reads and parses a GLB file from disk, performing byte-level integrity checks.
    """
    if not os.path.exists(file_path):
        container = GLBContainer(file_path=file_path, actual_file_size=0)
        container.errors.append(f"File not found: '{file_path}'")
        return container

    if not os.path.isfile(file_path):
        container = GLBContainer(file_path=file_path, actual_file_size=0)
        container.errors.append(f"Target path is not a file: '{file_path}'")
        return container

    file_size = os.path.getsize(file_path)
    container = GLBContainer(file_path=file_path, actual_file_size=file_size)

    if file_size < 12:
        container.errors.append(
            f"File is truncated: actual size ({file_size} bytes) is less than GLB 12-byte header."
        )
        return container

    try:
        with open(file_path, "rb") as f:
            raw_bytes = f.read()
    except Exception as e:
        container.errors.append(f"Failed to read file: {str(e)}")
        return container

    # Parse 12-byte GLB Header: magic (uint32), version (uint32), length (uint32)
    magic, version, declared_length = struct.unpack_from("<III", raw_bytes, 0)
    container.magic = magic
    container.version = version
    container.declared_file_size = declared_length

    if magic != GLB_MAGIC:
        container.errors.append(
            f"Invalid GLB magic header: expected 0x{GLB_MAGIC:08X} ('glTF'), got 0x{magic:08X}."
        )
        return container

    if version != GLB_VERSION_2:
        container.errors.append(
            f"Unsupported GLB version: expected version {GLB_VERSION_2}, got version {version}."
        )

    if declared_length != file_size:
        container.errors.append(
            f"Declared GLB length mismatch: header declares {declared_length} bytes, actual file size is {file_size} bytes."
        )

    container.is_valid_header = len(container.errors) == 0

    # Parse Chunks starting at offset 12
    offset = 12
    chunk_index = 0
    found_json = False

    while offset < file_size:
        if offset + 8 > file_size:
            container.errors.append(
                f"Truncated chunk header at byte offset {offset}: less than 8 bytes remaining."
            )
            break

        chunk_length, chunk_type = struct.unpack_from("<II", raw_bytes, offset)
        chunk_offset = offset + 8

        if chunk_type == CHUNK_TYPE_JSON:
            type_name = "JSON"
        elif chunk_type == CHUNK_TYPE_BIN:
            type_name = "BIN"
        else:
            type_name = f"UNKNOWN(0x{chunk_type:08X})"

        if chunk_offset + chunk_length > file_size:
            container.errors.append(
                f"Truncated {type_name} chunk at byte offset {offset}: chunk length {chunk_length} exceeds remaining file size ({file_size - chunk_offset} bytes)."
            )
            break

        chunk_data = raw_bytes[chunk_offset : chunk_offset + chunk_length]
        chunk = GLBChunk(
            chunk_type=chunk_type,
            chunk_type_name=type_name,
            chunk_length=chunk_length,
            byte_offset=offset,
            data=chunk_data,
        )
        container.chunks.append(chunk)

        if chunk_index == 0:
            if chunk_type != CHUNK_TYPE_JSON:
                container.errors.append(
                    f"First GLB chunk must be JSON (0x{CHUNK_TYPE_JSON:08X}), got {type_name} (0x{chunk_type:08X})."
                )
            else:
                found_json = True
                try:
                    json_str = chunk_data.decode("utf-8")
                    container.json_data = json.loads(json_str)
                except UnicodeDecodeError as ude:
                    container.errors.append(f"Malformed JSON chunk: UTF-8 decode error ({str(ude)}).")
                except json.JSONDecodeError as jde:
                    container.errors.append(f"Malformed JSON chunk: Invalid JSON syntax ({str(jde)}).")
        elif chunk_type == CHUNK_TYPE_BIN:
            if container.bin_data is not None:
                container.warnings.append(
                    f"Multiple BIN chunks found; glTF 2.0 typically specifies a single binary buffer chunk."
                )
            container.bin_data = chunk_data
        elif chunk_type == CHUNK_TYPE_JSON:
            container.warnings.append(
                f"Duplicate JSON chunk found at byte offset {offset}; secondary JSON chunks are ignored."
            )

        # Move to next 4-byte aligned boundary
        # According to glTF spec, chunk data length should be 4-byte aligned
        # But if not aligned, advance by chunk_length
        offset = chunk_offset + chunk_length
        chunk_index += 1

    if not found_json and len(container.errors) == 0:
        container.errors.append("No valid JSON chunk found in GLB container.")

    return container
