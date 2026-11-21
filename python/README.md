# Python 3D Asset Pipeline Tooling

This directory contains the Python inspection, validation, and Blender automation pipeline for the **3D Car Model and Viewer** project.

---

## 1. Environment Setup

The Python pipeline is isolated in a dedicated virtual environment using **Python 3.12**:

```bash
# From the project root
source python/venv/bin/activate

# Verify Python version
python --version   # Python 3.12.x
```

### Installed Dependencies (`requirements.txt`)
- `pygltflib` — Khronos glTF 2.0 schema and binary container reader/writer.
- `pytest` — Automated test runner for unit and integration testing.

---

## 2. Tools Overview

### A. Model Inspector & Validator (`inspect_model.py`)
Standalone binary GLB inspector and validation engine. Operates directly on the 12-byte GLB container, chunk hierarchy, JSON scene descriptor, and binary accessors without requiring Blender.

**Usage:**
```bash
# Standard terminal human-readable diagnostic report
python python/inspect_model.py path/to/model.glb

# Machine-readable JSON output to stdout
python python/inspect_model.py path/to/model.glb --json

# Save report directly to file
python python/inspect_model.py path/to/model.glb --output reports/car_audit.json

# Strict validation mode (elevates warnings to error exit code 1)
python python/inspect_model.py path/to/model.glb --strict

# Custom triangle and size budget thresholds
python python/inspect_model.py path/to/model.glb --warn-triangles 300000 --warn-size-mb 40.0
```

**Exit Codes:**
- `0`: Valid asset (status `PASS` or `WARNING` in standard mode).
- `1`: Validation errors present (or warnings in `--strict` mode).
- `2`: Invalid CLI arguments or target file unreadable.

---

### B. Headless Blender Automation Tool (`blender_process_car.py`)
Headless Blender script designed for Blender 3.6 LTS+ to automate:
- Scale normalization (e.g. cm/mm to meters).
- Automated empty pivot node generation (`Pivot_Door_FL`, `Pivot_Bonnet`, etc.) based on an explicit configuration file.
- Re-parenting meshes to mechanical hinge pivot empties.
- Sanitized GLB export with optional Draco compression.

**Headless Blender Command:**
```bash
blender --background --python python/blender_process_car.py -- \
    --input assets/raw/vehicle.blend \
    --output assets/processed/car_rigged.glb \
    --config assets/raw/car_pivots.json \
    --draco
```

*Note: In environments where Blender is not installed, running `python python/blender_process_car.py --help` prints the configuration schema template.*

---

## 3. Automated Test Suite

Run the full pytest suite:

```bash
source python/venv/bin/activate
python -m pytest python/tests -v
```
