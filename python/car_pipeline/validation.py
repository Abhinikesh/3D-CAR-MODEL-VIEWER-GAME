"""
Asset Validation Engine.

Executes structural, topological, budget, and automotive semantic rules,
categorizing findings into PASS, WARNING, and ERROR severities.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from .glb_reader import GLBContainer
from .hierarchy import HierarchyInfo
from .geometry import GeometryInfo
from .materials import MaterialInfo


class ValidationSeverity(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    ERROR = "ERROR"


@dataclass
class ValidationIssue:
    rule_id: str
    severity: ValidationSeverity
    message: str
    details: Optional[str] = None


@dataclass
class ValidationThresholds:
    warn_triangles: int = 250_000
    error_triangles: int = 1_500_000
    warn_file_size_mb: float = 35.0
    error_file_size_mb: float = 100.0
    min_car_length_meters: float = 1.0
    max_car_length_meters: float = 25.0


@dataclass
class ValidationReport:
    overall_status: ValidationSeverity = ValidationSeverity.PASS
    pass_count: int = 0
    warning_count: int = 0
    error_count: int = 0
    issues: List[ValidationIssue] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return self.error_count == 0


def validate_model(
    container: GLBContainer,
    hierarchy: HierarchyInfo,
    geometry: GeometryInfo,
    materials: MaterialInfo,
    thresholds: Optional[ValidationThresholds] = None,
    strict: bool = False,
) -> ValidationReport:
    """
    Executes all validation rules against inspected model data.
    """
    if thresholds is None:
        thresholds = ValidationThresholds()

    report = ValidationReport()

    def record_issue(rule_id: str, severity: ValidationSeverity, msg: str, details: Optional[str] = None):
        report.issues.append(ValidationIssue(rule_id=rule_id, severity=severity, message=msg, details=details))
        if severity == ValidationSeverity.ERROR:
            report.error_count += 1
        elif severity == ValidationSeverity.WARNING:
            report.warning_count += 1
        else:
            report.pass_count += 1

    # --- Rule 1: GLB Container Integrity ---
    if container.has_errors:
        for err in container.errors:
            record_issue("GLB_CONTAINER_ERROR", ValidationSeverity.ERROR, err)
    else:
        record_issue("GLB_CONTAINER_PASS", ValidationSeverity.PASS, "GLB header and chunk structure are valid.")

    if container.warnings:
        for warn in container.warnings:
            record_issue("GLB_CONTAINER_WARN", ValidationSeverity.WARNING, warn)

    # If the container itself has fatal errors, abort further checks
    if container.has_errors and container.json_data is None:
        report.overall_status = ValidationSeverity.ERROR
        return report

    # --- Rule 2: Scene & Node References ---
    if hierarchy.invalid_node_references:
        for inv in hierarchy.invalid_node_references:
            record_issue("HIERARCHY_INVALID_REF", ValidationSeverity.ERROR, inv)
    else:
        record_issue("HIERARCHY_REFS_PASS", ValidationSeverity.PASS, "Scene graph parent-child references are consistent.")

    if hierarchy.has_cycles:
        record_issue("HIERARCHY_CYCLE_ERROR", ValidationSeverity.ERROR, "Cyclic parent-child graph detected in nodes.")

    # --- Rule 3: Duplicate Node Names ---
    if hierarchy.duplicate_node_names:
        dupe_summary = ", ".join([f"'{name}' (x{len(idxs)})" for name, idxs in list(hierarchy.duplicate_node_names.items())[:5]])
        record_issue(
            "DUPLICATE_NODE_NAMES",
            ValidationSeverity.WARNING,
            f"Model contains duplicate node names ({len(hierarchy.duplicate_node_names)} duplicated names: {dupe_summary}).",
            "Duplicate names may cause ambiguities when binding Three.js object references.",
        )
    else:
        record_issue("NODE_NAMES_UNIQUE_PASS", ValidationSeverity.PASS, "All scene node names are unique.")

    # --- Rule 4: Geometry Attributes & Accessors ---
    if geometry.missing_position_primitives:
        for mis in geometry.missing_position_primitives:
            record_issue("GEOMETRY_MISSING_POSITION", ValidationSeverity.ERROR, mis)
    elif geometry.primitive_count > 0:
        record_issue("GEOMETRY_ATTRIBUTES_PASS", ValidationSeverity.PASS, "All primitives have required POSITION attributes.")

    if geometry.invalid_accessor_references:
        for acc_err in geometry.invalid_accessor_references:
            record_issue("GEOMETRY_INVALID_ACCESSOR", ValidationSeverity.ERROR, acc_err)

    # --- Rule 5: Non-Empty Geometry Check ---
    if geometry.mesh_count == 0 or geometry.total_vertices == 0:
        record_issue("GEOMETRY_EMPTY_ERROR", ValidationSeverity.ERROR, "Model contains no renderable mesh geometry or 0 vertices.")
    else:
        record_issue("GEOMETRY_NON_EMPTY_PASS", ValidationSeverity.PASS, f"Geometry present: {geometry.total_vertices:,} vertices, {geometry.total_triangles:,} triangles across {geometry.mesh_count} meshes.")

    # --- Rule 6: Budget Diagnostics (Triangles & File Size) ---
    if geometry.total_triangles > thresholds.error_triangles:
        record_issue(
            "BUDGET_TRIANGLES_ERROR",
            ValidationSeverity.ERROR,
            f"Triangle count ({geometry.total_triangles:,}) exceeds critical limit ({thresholds.error_triangles:,}).",
        )
    elif geometry.total_triangles > thresholds.warn_triangles:
        record_issue(
            "BUDGET_TRIANGLES_WARN",
            ValidationSeverity.WARNING,
            f"Triangle count ({geometry.total_triangles:,}) exceeds recommended target ({thresholds.warn_triangles:,}).",
            "Consider mesh decimation or Draco compression to optimize WebGL frame rates.",
        )
    else:
        record_issue("BUDGET_TRIANGLES_PASS", ValidationSeverity.PASS, f"Triangle count ({geometry.total_triangles:,}) is well within budget.")

    file_size_mb = container.actual_file_size / (1024 * 1024)
    if file_size_mb > thresholds.error_file_size_mb:
        record_issue(
            "BUDGET_FILESIZE_ERROR",
            ValidationSeverity.ERROR,
            f"File size ({file_size_mb:.2f} MB) exceeds maximum allowed limit ({thresholds.error_file_size_mb:.1f} MB).",
        )
    elif file_size_mb > thresholds.warn_file_size_mb:
        record_issue(
            "BUDGET_FILESIZE_WARN",
            ValidationSeverity.WARNING,
            f"File size ({file_size_mb:.2f} MB) exceeds recommended showroom target ({thresholds.warn_file_size_mb:.1f} MB).",
        )
    else:
        record_issue("BUDGET_FILESIZE_PASS", ValidationSeverity.PASS, f"File size ({file_size_mb:.2f} MB) is within budget.")

    # --- Rule 7: Materials & Texture References ---
    if materials.invalid_texture_references:
        for t_err in materials.invalid_texture_references:
            record_issue("MATERIAL_INVALID_TEXTURE_REF", ValidationSeverity.ERROR, t_err)
    if materials.invalid_material_references:
        for m_err in materials.invalid_material_references:
            record_issue("MATERIAL_INVALID_REF", ValidationSeverity.ERROR, m_err)
    if not materials.invalid_texture_references and not materials.invalid_material_references:
        record_issue("MATERIALS_REFS_PASS", ValidationSeverity.PASS, f"Material references valid ({materials.material_count} materials, {materials.texture_count} textures).")

    # Check for external resource references
    external_textures = [t for t in materials.textures if t.uri and not t.is_embedded]
    if external_textures:
        record_issue(
            "EXTERNAL_RESOURCES_WARN",
            ValidationSeverity.WARNING,
            f"Model references {len(external_textures)} external resource(s). Embedded binary GLB is preferred for self-contained distribution.",
        )

    # --- Rule 8: Vehicle Structural Articulation & Naming ---
    audit = hierarchy.vehicle_audit
    if audit.is_monolithic:
        record_issue(
            "VEHICLE_MONOLITHIC_WARN",
            ValidationSeverity.WARNING,
            "Model appears to be a monolithic single-mesh asset without component separation.",
            "Independent door, hood, and wheel animations require separate meshes/pivots.",
        )

    # Check for door and wheel pivots (Warnings only, never errors!)
    if not audit.door_pivots:
        record_issue(
            "VEHICLE_DOOR_PIVOTS_MISSING_WARN",
            ValidationSeverity.WARNING,
            "No explicit door pivot nodes (e.g. 'Pivot_Door_FL') detected in hierarchy.",
            "Doors cannot rotate on mechanical hinge axes without configured pivot parent nodes.",
        )
    else:
        record_issue("VEHICLE_DOOR_PIVOTS_PASS", ValidationSeverity.PASS, f"Detected door pivot nodes: {', '.join(audit.door_pivots)}")

    if not audit.bonnet_pivot and not audit.boot_pivot:
        record_issue(
            "VEHICLE_CLOSURES_PIVOTS_WARN",
            ValidationSeverity.WARNING,
            "No bonnet or boot pivot nodes detected.",
            "Hood/trunk opening animations will require pivot configuration in Part 4.",
        )

    if not audit.wheel_nodes and not audit.wheel_pivots:
        record_issue(
            "VEHICLE_WHEEL_ASSEMBLIES_WARN",
            ValidationSeverity.WARNING,
            "No wheel or rim component nodes identified.",
            "Wheel spin and steering animations will require separated wheel meshes.",
        )

    # --- Rule 9: Bounding Box & Scale Diagnostics ---
    bbox = geometry.overall_bounding_box
    if bbox.is_valid:
        # Check vehicle length (typically X or Z dimension)
        max_dim = max(bbox.size)
        min_dim = min(bbox.size)
        if max_dim < thresholds.min_car_length_meters:
            record_issue(
                "BOUNDS_SCALE_SMALL_WARN",
                ValidationSeverity.WARNING,
                f"Model bounding box largest dimension ({max_dim:.3f} m) is unusually small for a car.",
                "Verify if model coordinates were exported in centimeters or millimeters instead of meters.",
            )
        elif max_dim > thresholds.max_car_length_meters:
            record_issue(
                "BOUNDS_SCALE_LARGE_WARN",
                ValidationSeverity.WARNING,
                f"Model bounding box largest dimension ({max_dim:.2f} m) exceeds normal automotive scale.",
                "Verify model scale before rendering in the showroom.",
            )
        else:
            record_issue("BOUNDS_SCALE_PASS", ValidationSeverity.PASS, f"Bounding box dimensions: X={bbox.size[0]:.2f}m, Y={bbox.size[1]:.2f}m, Z={bbox.size[2]:.2f}m.")
    else:
        record_issue(
            "BOUNDS_UNAVAILABLE_WARN",
            ValidationSeverity.WARNING,
            "Bounding box min/max could not be derived from accessor data.",
        )

    # Determine Overall Result
    if report.error_count > 0:
        report.overall_status = ValidationSeverity.ERROR
    elif strict and report.warning_count > 0:
        report.overall_status = ValidationSeverity.ERROR
    elif report.warning_count > 0:
        report.overall_status = ValidationSeverity.WARNING
    else:
        report.overall_status = ValidationSeverity.PASS

    return report
