"""
Unit & Integration Tests for Validation Engine, Geometry, Materials, and CLI.
"""

import os
import subprocess
import sys
import tempfile
import pytest

from car_pipeline.glb_reader import read_glb_file
from car_pipeline.hierarchy import inspect_hierarchy
from car_pipeline.geometry import inspect_geometry
from car_pipeline.materials import inspect_materials
from car_pipeline.validation import (
    validate_model,
    ValidationSeverity,
    ValidationThresholds,
)
from car_pipeline.report import format_json_report, format_terminal_report
from tests.fixtures.glb_generator import (
    build_glb_bytes,
    create_minimal_valid_gltf_dict,
    create_mock_car_gltf_dict,
)


def test_geometry_primitive_counts_and_bounds():
    gltf_dict = create_mock_car_gltf_dict(with_pivots=True)
    geo = inspect_geometry(gltf_dict)

    assert geo.mesh_count == 3
    assert geo.primitive_count == 3
    assert geo.indexed_primitive_count == 3
    assert geo.non_indexed_primitive_count == 0
    assert geo.total_vertices == 36  # 12 per primitive * 3
    assert geo.total_triangles == 18  # 6 per primitive * 3
    assert geo.overall_bounding_box.is_valid
    assert geo.overall_bounding_box.size[0] == pytest.approx(1.9, rel=1e-2)
    assert geo.overall_bounding_box.size[1] == pytest.approx(1.45, rel=1e-2)
    assert geo.overall_bounding_box.size[2] == pytest.approx(4.5, rel=1e-2)


def test_geometry_missing_position_attribute():
    gltf_dict = {
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"NORMAL": 0},  # Missing POSITION!
                        "mode": 4,
                    }
                ]
            }
        ]
    }
    geo = inspect_geometry(gltf_dict)
    assert len(geo.missing_position_primitives) == 1
    assert "missing required 'POSITION'" in geo.missing_position_primitives[0]


def test_material_inspection_pbr_and_clearcoat():
    gltf_dict = create_mock_car_gltf_dict(with_pivots=True)
    mat_info = inspect_materials(gltf_dict)

    assert mat_info.material_count == 2
    assert mat_info.has_clearcoat_materials
    assert not mat_info.has_transmission_materials

    paint = mat_info.materials[0]
    assert paint.name == "Material_Body_Paint"
    assert paint.pbr.metallic_factor == pytest.approx(0.9)
    assert paint.pbr.roughness_factor == pytest.approx(0.2)
    assert paint.clearcoat is not None
    assert paint.clearcoat.clearcoat_factor == pytest.approx(1.0)


def test_validation_severities_and_strict_mode():
    gltf_dict = create_mock_car_gltf_dict(with_pivots=True)
    glb_bytes = build_glb_bytes(gltf_dict)

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        tmp.write(glb_bytes)
        tmp_path = tmp.name

    try:
        container = read_glb_file(tmp_path)
        hierarchy = inspect_hierarchy(container.json_data)
        geometry = inspect_geometry(container.json_data)
        materials = inspect_materials(container.json_data)

        # Standard mode: missing closures pivots are warnings, overall is WARNING (is_valid = True)
        report = validate_model(container, hierarchy, geometry, materials, strict=False)
        assert report.is_valid
        assert report.error_count == 0
        assert report.warning_count > 0
        assert report.overall_status == ValidationSeverity.WARNING

        # Strict mode: elevates warning to ERROR (is_valid = False)
        strict_report = validate_model(container, hierarchy, geometry, materials, strict=True)
        assert strict_report.overall_status == ValidationSeverity.ERROR
    finally:
        os.remove(tmp_path)


def test_json_and_terminal_report_generation():
    gltf_dict = create_minimal_valid_gltf_dict()
    glb_bytes = build_glb_bytes(gltf_dict)

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        tmp.write(glb_bytes)
        tmp_path = tmp.name

    try:
        container = read_glb_file(tmp_path)
        hierarchy = inspect_hierarchy(container.json_data)
        geometry = inspect_geometry(container.json_data)
        materials = inspect_materials(container.json_data)
        validation = validate_model(container, hierarchy, geometry, materials)

        term_output = format_terminal_report(container, hierarchy, geometry, materials, validation)
        assert "3D CAR MODEL — ASSET INSPECTION" in term_output
        assert "GLB Integrity: PASS" in term_output

        json_output = format_json_report(container, hierarchy, geometry, materials, validation)
        assert "file" in json_output
        assert "geometry" in json_output
        assert "validation" in json_output
        assert json_output["validation"]["overall_status"] in ("PASS", "WARNING")
    finally:
        os.remove(tmp_path)


def test_cli_exit_codes():
    gltf_dict = create_mock_car_gltf_dict(with_pivots=True)
    valid_bytes = build_glb_bytes(gltf_dict)
    corrupted_bytes = b"glTF\x02\x00\x00\x00\x00\x00\x00\x00"  # Bad length 0

    python_bin = sys.executable
    script_path = os.path.join(os.path.dirname(__file__), "..", "inspect_model.py")

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f_valid:
        f_valid.write(valid_bytes)
        valid_path = f_valid.name

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f_bad:
        f_bad.write(corrupted_bytes)
        bad_path = f_bad.name

    try:
        # 1. Valid model -> Exit code 0
        res_valid = subprocess.run(
            [python_bin, script_path, valid_path, "--json"],
            capture_output=True,
            text=True,
        )
        assert res_valid.returncode == 0
        assert '"overall_status"' in res_valid.stdout

        # 2. Corrupted model -> Exit code 1
        res_bad = subprocess.run(
            [python_bin, script_path, bad_path],
            capture_output=True,
            text=True,
        )
        assert res_bad.returncode == 1

        # 3. Non-existent file -> Exit code 2
        res_nonexistent = subprocess.run(
            [python_bin, script_path, "/invalid/non_existent_path.glb"],
            capture_output=True,
            text=True,
        )
        assert res_nonexistent.returncode == 2
    finally:
        os.remove(valid_path)
        os.remove(bad_path)
