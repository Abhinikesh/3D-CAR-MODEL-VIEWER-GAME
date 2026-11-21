#!/usr/bin/env python3
"""
CLI utility to export a comprehensive machine-readable vehicle manifest.
"""

import sys
import os

# Add python directory to module path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from car_pipeline.manifest import generate_car_manifest

def main():
    glb_path = sys.argv[1] if len(sys.argv) > 1 else "public/models/car.glb"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "python/reports/car_manifest.json"

    print(f"[Manifest] Parsing vehicle asset: {glb_path}")
    manifest = generate_car_manifest(glb_path, output_path)

    metrics = manifest["metrics"]
    semantics = manifest["semantic_components"]
    pivots = manifest["pivots"]

    print("✓ Manifest generated successfully:")
    print(f"    Nodes: {metrics['total_nodes']} | Meshes: {metrics['total_meshes']} | Primitives: {metrics['total_primitives']}")
    print(f"    Vertices: {metrics['total_vertices']:,} | Triangles: {metrics['total_triangles']:,}")
    print(f"    Dimensions: {metrics['dimensions']['z_length']}m (L) x {metrics['dimensions']['x_width']}m (W) x {metrics['dimensions']['y_height']}m (H)")
    print(f"    Resolved Semantics: {sum(1 for s in semantics.values() if s['resolved'])}/{len(semantics)}")
    print(f"    Pivots Detected: Door_FL={pivots['door_fl']}, Door_FR={pivots['door_fr']}, Bonnet={pivots['bonnet']}, Boot={pivots['boot']}")
    print(f"    Wheel Assemblies: {pivots['wheels']}")
    print(f"    Output written to: {output_path}")

if __name__ == "__main__":
    main()
