"""
3D Car Model and Viewer — Asset Inspection & Validation Engine
"""

__version__ = "0.1.0"

from .glb_reader import read_glb_file, GLBContainer
from .hierarchy import inspect_hierarchy, HierarchyInfo
from .geometry import inspect_geometry, GeometryInfo
from .materials import inspect_materials, MaterialInfo
from .validation import validate_model, ValidationReport, ValidationSeverity
from .report import format_terminal_report, format_json_report
from .manifest import generate_car_manifest

__all__ = [
    "read_glb_file",
    "GLBContainer",
    "inspect_hierarchy",
    "HierarchyInfo",
    "inspect_geometry",
    "GeometryInfo",
    "inspect_materials",
    "MaterialInfo",
    "validate_model",
    "ValidationReport",
    "ValidationSeverity",
    "format_terminal_report",
    "format_json_report",
    "generate_car_manifest",
]
