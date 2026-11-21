"""
PBR Materials & Textures Inspector.

Analyzes materials, PBR parameters (baseColor, metallic, roughness),
automotive shader extensions (clearcoat, transmission, ior), textures, and image sources.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class PBRMetallicRoughnessInfo:
    base_color_factor: List[float] = field(default_factory=lambda: [1.0, 1.0, 1.0, 1.0])
    metallic_factor: float = 1.0
    roughness_factor: float = 1.0
    has_base_color_texture: bool = False
    has_metallic_roughness_texture: bool = False


@dataclass
class ClearcoatExtensionInfo:
    clearcoat_factor: float = 0.0
    clearcoat_roughness_factor: float = 0.0
    has_texture: bool = False


@dataclass
class TransmissionExtensionInfo:
    transmission_factor: float = 0.0
    has_texture: bool = False


@dataclass
class SingleMaterialInfo:
    index: int
    name: str
    double_sided: bool = False
    alpha_mode: str = "OPAQUE"
    pbr: PBRMetallicRoughnessInfo = field(default_factory=PBRMetallicRoughnessInfo)
    clearcoat: Optional[ClearcoatExtensionInfo] = None
    transmission: Optional[TransmissionExtensionInfo] = None
    ior: Optional[float] = None
    has_normal_texture: bool = False
    has_occlusion_texture: bool = False
    has_emissive: bool = False
    emissive_factor: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])


@dataclass
class TextureInfo:
    index: int
    name: str
    sampler_index: Optional[int] = None
    image_index: Optional[int] = None
    is_embedded: bool = False
    uri: Optional[str] = None


@dataclass
class MaterialInfo:
    material_count: int = 0
    texture_count: int = 0
    image_count: int = 0
    materials: List[SingleMaterialInfo] = field(default_factory=list)
    textures: List[TextureInfo] = field(default_factory=list)
    has_clearcoat_materials: bool = False
    has_transmission_materials: bool = False
    invalid_material_references: List[str] = field(default_factory=list)
    invalid_texture_references: List[str] = field(default_factory=list)


def inspect_materials(gltf_data: Optional[Dict[str, Any]]) -> MaterialInfo:
    """
    Parses materials, PBR parameters, extensions, textures, and image references.
    """
    info = MaterialInfo()
    if not gltf_data or not isinstance(gltf_data, dict):
        return info

    raw_materials = gltf_data.get("materials", [])
    raw_textures = gltf_data.get("textures", [])
    raw_images = gltf_data.get("images", [])
    buffer_views = gltf_data.get("bufferViews", [])

    info.material_count = len(raw_materials)
    info.texture_count = len(raw_textures)
    info.image_count = len(raw_images)

    # Step 1: Inspect Textures & Images
    for t_idx, tex in enumerate(raw_textures):
        t_name = tex.get("name", f"Texture_{t_idx}")
        img_idx = tex.get("source")
        is_embedded = False
        uri = None

        if img_idx is not None:
            if isinstance(img_idx, int) and 0 <= img_idx < len(raw_images):
                img = raw_images[img_idx]
                if "bufferView" in img:
                    bv_idx = img["bufferView"]
                    if isinstance(bv_idx, int) and 0 <= bv_idx < len(buffer_views):
                        is_embedded = True
                    else:
                        info.invalid_texture_references.append(
                            f"Image {img_idx} references invalid bufferView index {bv_idx}."
                        )
                elif "uri" in img:
                    uri = img["uri"]
                    if uri.startswith("data:"):
                        is_embedded = True
            else:
                info.invalid_texture_references.append(
                    f"Texture {t_idx} ('{t_name}') references invalid image source index {img_idx}."
                )

        info.textures.append(
            TextureInfo(
                index=t_idx,
                name=t_name,
                sampler_index=tex.get("sampler"),
                image_index=img_idx,
                is_embedded=is_embedded,
                uri=uri,
            )
        )

    # Step 2: Inspect Materials
    for m_idx, mat in enumerate(raw_materials):
        m_name = mat.get("name", f"Material_{m_idx}")
        mat_info = SingleMaterialInfo(
            index=m_idx,
            name=m_name,
            double_sided=mat.get("doubleSided", False),
            alpha_mode=mat.get("alphaMode", "OPAQUE"),
        )

        # Inspect PBR
        pbr = mat.get("pbrMetallicRoughness", {})
        mat_info.pbr.base_color_factor = pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0])
        mat_info.pbr.metallic_factor = float(pbr.get("metallicFactor", 1.0))
        mat_info.pbr.roughness_factor = float(pbr.get("roughnessFactor", 1.0))
        mat_info.pbr.has_base_color_texture = "baseColorTexture" in pbr
        mat_info.pbr.has_metallic_roughness_texture = "metallicRoughnessTexture" in pbr

        # Other channels
        mat_info.has_normal_texture = "normalTexture" in mat
        mat_info.has_occlusion_texture = "occlusionTexture" in mat
        mat_info.emissive_factor = mat.get("emissiveFactor", [0.0, 0.0, 0.0])
        mat_info.has_emissive = any(v > 0.0 for v in mat_info.emissive_factor) or ("emissiveTexture" in mat)

        # Extensions
        extensions = mat.get("extensions", {})

        # Clearcoat
        if "KHR_materials_clearcoat" in extensions:
            cc = extensions["KHR_materials_clearcoat"]
            mat_info.clearcoat = ClearcoatExtensionInfo(
                clearcoat_factor=float(cc.get("clearcoatFactor", 0.0)),
                clearcoat_roughness_factor=float(cc.get("clearcoatRoughnessFactor", 0.0)),
                has_texture="clearcoatTexture" in cc,
            )
            info.has_clearcoat_materials = True

        # Transmission
        if "KHR_materials_transmission" in extensions:
            tr = extensions["KHR_materials_transmission"]
            mat_info.transmission = TransmissionExtensionInfo(
                transmission_factor=float(tr.get("transmissionFactor", 0.0)),
                has_texture="transmissionTexture" in tr,
            )
            info.has_transmission_materials = True

        # IOR
        if "KHR_materials_ior" in extensions:
            mat_info.ior = float(extensions["KHR_materials_ior"].get("ior", 1.5))

        info.materials.append(mat_info)

    return info
