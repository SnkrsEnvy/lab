from __future__ import annotations

from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "ContentSource" / "Textures"
OUT.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(20260722)


def resize_float(arr: np.ndarray, size: tuple[int, int], mode=Image.Resampling.LANCZOS) -> np.ndarray:
    if arr.ndim == 2:
        img = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), mode="L")
        return np.asarray(img.resize(size, mode), dtype=np.float32) / 255.0
    img = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), mode="RGB")
    return np.asarray(img.resize(size, mode), dtype=np.float32) / 255.0


def normal_from_height(height: np.ndarray, strength: float = 3.0) -> np.ndarray:
    gy, gx = np.gradient(height.astype(np.float32))
    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(height)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack((nx / norm, ny / norm, nz / norm), axis=-1)
    return n * 0.5 + 0.5


def save_rgb(path: Path, arr: np.ndarray, quality: int = 96) -> None:
    img = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), mode="RGB")
    if path.suffix.lower() in {".jpg", ".jpeg"}:
        img.save(path, quality=quality, subsampling=0, optimize=True)
    else:
        img.save(path, compress_level=5)


def save_gray(path: Path, arr: np.ndarray) -> None:
    Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), mode="L").save(path, compress_level=5)


def fractal_noise(size: int, sigmas: list[float], weights: list[float]) -> np.ndarray:
    total = np.zeros((size, size), dtype=np.float32)
    for sigma, weight in zip(sigmas, weights):
        base = RNG.normal(0, 1, (size, size)).astype(np.float32)
        layer = gaussian_filter(base, sigma=sigma, mode="wrap")
        layer -= layer.min()
        layer /= max(float(layer.max()), 1e-6)
        total += layer * weight
    total -= total.min()
    total /= max(float(total.max()), 1e-6)
    return total


def make_marble() -> None:
    base_size = 1024
    y, x = np.mgrid[0:base_size, 0:base_size].astype(np.float32)
    u = x / base_size
    v = y / base_size

    macro = fractal_noise(base_size, [180, 80, 30], [0.55, 0.30, 0.15])
    warp = gaussian_filter(RNG.normal(0, 1, (base_size, base_size)).astype(np.float32), 95, mode="wrap")
    warp /= max(float(np.std(warp)), 1e-6)
    fine = fractal_noise(base_size, [16, 5, 1.4], [0.48, 0.32, 0.20])

    # Broad Calacatta-like diagonal veins, then secondary branching.
    phase = (u * 2.9 + v * 1.23) * math.pi * 2 + warp * 1.45 + macro * 2.0
    vein_a = np.abs(np.sin(phase))
    vein_a = np.exp(-((vein_a / 0.090) ** 2))

    phase_b = (u * 5.2 - v * 2.1) * math.pi * 2 + warp * 2.2 + fine * 1.1
    vein_b = np.abs(np.sin(phase_b))
    vein_b = np.exp(-((vein_b / 0.048) ** 2)) * 0.42

    # Sparse hairline branches.
    branch_noise = gaussian_filter(RNG.random((base_size, base_size)).astype(np.float32), 7, mode="wrap")
    branches = np.clip((branch_noise - 0.50) * 11.0, 0, 1) * vein_a
    veins = np.clip(vein_a * (0.62 + macro * 0.38) + vein_b + branches * 0.30, 0, 1)

    warm = np.array([0.925, 0.906, 0.875], dtype=np.float32)
    cool = np.array([0.62, 0.64, 0.65], dtype=np.float32)
    gold = np.array([0.70, 0.57, 0.42], dtype=np.float32)

    albedo = warm[None, None, :] * (0.985 + (macro[..., None] - 0.5) * 0.045)
    albedo = albedo * (1 - veins[..., None] * 0.28) + cool[None, None, :] * veins[..., None] * 0.25
    gold_mask = np.clip((vein_b - 0.25) * 2.8, 0, 1)[..., None]
    albedo = albedo * (1 - gold_mask * 0.10) + gold[None, None, :] * gold_mask * 0.10
    albedo += (fine[..., None] - 0.5) * 0.018
    albedo = np.clip(albedo, 0, 1)

    height = 0.54 + (macro - 0.5) * 0.035 - veins * 0.08 + (fine - 0.5) * 0.014
    normal = normal_from_height(height, strength=5.6)
    roughness = np.clip(0.14 + (fine - 0.5) * 0.05 + veins * 0.08, 0.08, 0.30)
    ao = np.clip(0.96 - veins * 0.06 - (fine - 0.5) * 0.025, 0.84, 1.0)

    # 8K albedo preserves source sharpness while 4K utility maps keep memory reasonable.
    albedo_8k = resize_float(albedo, (8192, 8192))
    save_rgb(OUT / "T_Marble_Calacatta_Albedo_8K.jpg", albedo_8k, 97)
    save_rgb(OUT / "T_Marble_Calacatta_Normal_4K.png", resize_float(normal, (4096,4096)))
    save_gray(OUT / "T_Marble_Calacatta_Roughness_4K.png", resize_float(roughness, (4096,4096)))
    save_gray(OUT / "T_Marble_Calacatta_AO_4K.png", resize_float(ao, (4096,4096)))
    save_gray(OUT / "T_Marble_Calacatta_Height_4K.png", resize_float(np.clip(height, 0, 1), (4096,4096)))


def make_velvet() -> None:
    base_size = 1024
    y, x = np.mgrid[0:base_size, 0:base_size].astype(np.float32)
    u = x / base_size
    v = y / base_size

    macro = fractal_noise(base_size, [210, 76, 24], [0.58, 0.28, 0.14])
    pile = gaussian_filter(RNG.normal(0, 1, (base_size, base_size)).astype(np.float32), (3.5, 0.75), mode="wrap")
    pile /= max(float(np.std(pile)), 1e-6)
    micro = gaussian_filter(RNG.normal(0, 1, (base_size, base_size)).astype(np.float32), (0.9, 0.28), mode="wrap")
    micro /= max(float(np.std(micro)), 1e-6)

    # Directional nap: dense vertical fibers with slow changes in brushed direction.
    direction = np.sin((u * 1150.0 + macro * 7.5) * math.pi * 2)
    directional_fibers = np.abs(direction) ** 18
    sheen = np.clip(0.55 + pile * 0.06 + directional_fibers * 0.13, 0, 1)

    camel = np.array([0.58, 0.335, 0.145], dtype=np.float32)
    highlight = np.array([0.82, 0.57, 0.30], dtype=np.float32)
    shadow = np.array([0.24, 0.105, 0.045], dtype=np.float32)

    tonal = np.clip(0.60 + (macro - 0.5) * 0.32 + pile * 0.025, 0, 1)
    albedo = shadow[None, None, :] * (1 - tonal[..., None]) + camel[None, None, :] * tonal[..., None]
    albedo = albedo * (1 - sheen[..., None] * 0.13) + highlight[None, None, :] * sheen[..., None] * 0.13
    albedo += micro[..., None] * 0.007
    albedo = np.clip(albedo, 0, 1)

    height = 0.5 + pile * 0.014 + micro * 0.006 + directional_fibers * 0.018
    normal = normal_from_height(height, strength=10.0)
    roughness = np.clip(0.63 - sheen * 0.18 + macro * 0.05, 0.38, 0.78)
    ao = np.clip(0.93 - np.abs(pile) * 0.025 - directional_fibers * 0.035, 0.80, 1.0)
    fuzz = np.clip(0.45 + sheen * 0.50, 0, 1)

    albedo_8k = resize_float(albedo, (8192, 8192))
    save_rgb(OUT / "T_Velvet_Camel_Albedo_8K.jpg", albedo_8k, 97)
    save_rgb(OUT / "T_Velvet_Camel_Normal_4K.png", resize_float(normal, (4096,4096)))
    save_gray(OUT / "T_Velvet_Camel_Roughness_4K.png", resize_float(roughness, (4096,4096)))
    save_gray(OUT / "T_Velvet_Camel_AO_4K.png", resize_float(ao, (4096,4096)))
    save_gray(OUT / "T_Velvet_Camel_Fuzz_4K.png", resize_float(fuzz, (4096,4096)))


def make_plaster() -> None:
    size = 1024
    macro = fractal_noise(size, [155, 48, 12], [0.62, 0.26, 0.12])
    micro = gaussian_filter(RNG.normal(0, 1, (size, size)).astype(np.float32), 1.2, mode="wrap")
    micro /= max(float(np.std(micro)), 1e-6)
    base = np.array([0.91, 0.87, 0.79], dtype=np.float32)
    albedo = base[None, None, :] * (0.96 + (macro[..., None] - 0.5) * 0.075)
    albedo += micro[..., None] * 0.006
    albedo = np.clip(albedo, 0, 1)
    height = 0.50 + (macro - 0.5) * 0.025 + micro * 0.004
    normal = normal_from_height(height, strength=4.0)
    roughness = np.clip(0.62 + (macro - 0.5) * 0.10, 0.48, 0.76)
    save_rgb(OUT / "T_Plaster_Ivory_Albedo_4K.jpg", resize_float(albedo,(4096,4096)), 96)
    save_rgb(OUT / "T_Plaster_Ivory_Normal_4K.png", resize_float(normal,(4096,4096)))
    save_gray(OUT / "T_Plaster_Ivory_Roughness_4K.png", resize_float(roughness,(4096,4096)))


def make_bronze() -> None:
    size = 1024
    macro = fractal_noise(size, [45, 11, 2], [0.52, 0.28, 0.20])
    base = np.array([0.22, 0.095, 0.035], dtype=np.float32)
    warm = np.array([0.48, 0.25, 0.09], dtype=np.float32)
    albedo = base[None, None, :] * (1 - macro[..., None] * 0.52) + warm[None, None, :] * macro[..., None] * 0.52
    height = 0.5 + (macro - 0.5) * 0.02
    normal = normal_from_height(height, strength=3.2)
    roughness = np.clip(0.22 + macro * 0.16, 0.18, 0.42)
    metallic = np.full((size, size), 0.94, dtype=np.float32)
    save_rgb(OUT / "T_Bronze_Dark_Albedo_2K.jpg", albedo, 96)
    save_rgb(OUT / "T_Bronze_Dark_Normal_2K.png", normal)
    save_gray(OUT / "T_Bronze_Dark_Roughness_2K.png", roughness)
    save_gray(OUT / "T_Bronze_Dark_Metallic_2K.png", metallic)


if __name__ == "__main__":
    print("Generating master texture set...")
    make_marble()
    print("Marble complete")
    make_velvet()
    print("Velvet complete")
    make_plaster()
    print("Plaster complete")
    make_bronze()
    print("Bronze complete")
    print(f"Wrote textures to {OUT}")
