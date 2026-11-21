# 3D Asset Licenses & Attribution

This document records the legal provenance, authorship, licensing, and attribution terms for 3D models and textures utilized in the **3D Car Model and Viewer** project.

---

## Primary Vehicle Model: Khronos "Car Concept"

| Field | Detail |
| :--- | :--- |
| **Model Name** | Car Concept (`CarConcept.glb`) |
| **Original 3D Design** | Unity Fan (Public Domain / CC0) |
| **glTF Optimization & Rigging** | Darmstadt Graphics Group GmbH (DGG) & Eric Chadwick |
| **Repository** | [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) |
| **Direct Asset Source** | `Models/CarConcept/glTF-Binary/CarConcept.glb` |
| **Source URL** | https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb |
| **License** | Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode)) |
| **Copyright Declaration** | &copy; 2024, Darmstadt Graphics Group GmbH & Eric Chadwick |
| **Trademark Notice** | Non-copyrightable logos for Khronos Group and 3D Commerce &copy; 2015, 2017 Khronos Group |

### Attribution Notice (as required by CC-BY 4.0)
> *The 3D concept car model used in this application is based on the "Car Concept" showcase asset from the official Khronos Group glTF Sample Assets repository, originally designed by Unity Fan (CC0) and optimized, structured, and textured by Darmstadt Graphics Group GmbH and Eric Chadwick under the Creative Commons Attribution 4.0 International License (CC BY 4.0).*

---

## Comparison Candidate: Ferrari 458 Italia (Reference Asset)

| Field | Detail |
| :--- | :--- |
| **Model Name** | Ferrari 458 Italia (`ferrari.glb`) |
| **Original Creator** | `vicent091036` (Sketchfab) |
| **Repository** | [mrdoob/three.js](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf) |
| **License** | Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode)) |
| **Notes** | Retained in `assets/raw/` for benchmark comparison. Doors and closures are merged into chassis geometry and cannot be articulated. |

---

## Comparison Candidate: 1975 Porsche 911 930 Turbo (Evaluation Only)

| Field | Detail |
| :--- | :--- |
| **Model Name** | Porsche 911 (930) Turbo 1975 |
| **Original Creator** | Karol Miklas (Sketchfab) |
| **License** | Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode)) |
| **Notes** | Evaluated during candidate research; unbundled texture architecture and welded closures led to selection of Car Concept as primary asset. |

---

## Environment Map: Studio Small 08 (HDR Environment)

| Field | Detail |
| :--- | :--- |
| **Asset Name** | Studio Small 08 (`studio_small_08_1k.hdr`) |
| **Author / Creator** | Andreas Mischok / Poly Haven |
| **Source Platform** | [Poly Haven](https://polyhaven.com/a/studio_small_08) |
| **Direct Asset URL** | https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr |
| **License** | Creative Commons 0 (CC0 1.0 Universal - Public Domain Dedication) |
| **Resolution & Format**| 1024x512 Radiance HDR (32-bit floating point, 1.44 MB) |
| **Application Role** | Physically based environment reflections for automotive car paint, clearcoat, glass transmission, and metallic rim surfaces. |

