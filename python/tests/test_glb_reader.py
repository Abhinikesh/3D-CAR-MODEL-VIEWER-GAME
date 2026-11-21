"""
Unit Tests for GLB Binary Container Reader (glb_reader.py).
"""

import os
import tempfile
import pytest

from car_pipeline.glb_reader import read_glb_file, GLB_MAGIC
from tests.fixtures.glb_generator import (
    build_glb_bytes,
    create_minimal_valid_gltf_dict,
)


def test_read_valid_minimal_glb():
    gltf_dict = create_minimal_valid_gltf_dict()
    bin_data = b"\x00" * 44
    glb_bytes = build_glb_bytes(gltf_dict, bin_data)

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        tmp.write(glb_bytes)
        tmp_path = tmp.name

    try:
        container = read_glb_file(tmp_path)
        assert not container.has_errors
        assert container.is_valid_header
        assert container.magic == GLB_MAGIC
        assert container.version == 2
        assert container.actual_file_size == len(glb_bytes)
        assert container.declared_file_size == len(glb_bytes)
        assert container.json_data is not None
        assert container.json_data["asset"]["version"] == "2.0"
        assert len(container.chunks) == 2
        assert container.chunks[0].chunk_type_name == "JSON"
        assert container.chunks[1].chunk_type_name == "BIN"
        assert container.bin_data is not None
    finally:
        os.remove(tmp_path)


def test_invalid_magic_header():
    gltf_dict = create_minimal_valid_gltf_dict()
    # Bad magic: 0x11223344 instead of 0x46546C67
    glb_bytes = build_glb_bytes(gltf_dict, magic=0x11223344)

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        tmp.write(glb_bytes)
        tmp_path = tmp.name

    try:
        container = read_glb_file(tmp_path)
        assert container.has_errors
        assert not container.is_valid_header
        assert any("Invalid GLB magic header" in err for err in container.errors)
    finally:
        os.remove(tmp_path)


def test_unsupported_glb_version():
    gltf_dict = create_minimal_valid_gltf_dict()
    # Unsupported version 1
    glb_bytes = build_glb_bytes(gltf_dict, version=1)

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        tmp.write(glb_bytes)
        tmp_path = tmp.name

    try:
        container = read_glb_file(tmp_path)
        assert container.has_errors
        assert any("Unsupported GLB version" in err for err in container.errors)
    finally:
        os.remove(tmp_path)


def test_truncated_header():
    # Only 8 bytes (missing length field)
    short_bytes = b"glTF\x02\x00\x00\x00"

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        tmp.write(short_bytes)
        tmp_path = tmp.name

    try:
        container = read_glb_file(tmp_path)
        assert container.has_errors
        assert any("File is truncated" in err for err in container.errors)
    finally:
        os.remove(tmp_path)


def test_declared_length_mismatch():
    gltf_dict = create_minimal_valid_gltf_dict()
    # Claim 99999 bytes when file is smaller
    glb_bytes = build_glb_bytes(gltf_dict, corrupt_declared_length=99999)

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        tmp.write(glb_bytes)
        tmp_path = tmp.name

    try:
        container = read_glb_file(tmp_path)
        assert container.has_errors
        assert any("Declared GLB length mismatch" in err for err in container.errors)
    finally:
        os.remove(tmp_path)


def test_invalid_json_syntax():
    # Pass malformed JSON string
    glb_bytes = build_glb_bytes({}, raw_json_str="{ asset: broken_json without_quotes }")

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        tmp.write(glb_bytes)
        tmp_path = tmp.name

    try:
        container = read_glb_file(tmp_path)
        assert container.has_errors
        assert any("Malformed JSON chunk" in err for err in container.errors)
    finally:
        os.remove(tmp_path)


def test_non_existent_file():
    container = read_glb_file("/non/existent/path/to/test.glb")
    assert container.has_errors
    assert any("File not found" in err for err in container.errors)
