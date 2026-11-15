"""Ruta Shuttle photo pipeline: one shared color grade + responsive exports.

Usage (from the project folder):
    python3 src/photos.py

Edit JOBS to add or change photos. Originals are read from their own path;
outputs go to assets/<folder>/<name>-<width>.(avif|webp|jpg).
"""
import os
import numpy as np
from PIL import Image, ImageFilter

UP = "/mnt/user-data/uploads/"
CUENCA, QUITO, GYE = UP + "737f6d59-image.jpg", UP + "08425038-image.jpg", UP + "078c9ca5-image.jpg"

# name, source, crop box (left, top, right, bottom), white-balance strength, folder, widths
JOBS = [
    # 3:2 cards
    ("cuenca", CUENCA, (226, 339, 2260, 1695), .35, "cities", (480, 960)),
    ("quito", QUITO, (100, 0, 1900, 1200), .35, "cities", (480, 960)),
    ("guayaquil", GYE, (442, 291, 2538, 1689), .15, "cities", (480, 960)),
    # 16:9 city page covers (subject kept right of center, text sits on the left)
    ("cuenca", CUENCA, (0, 330, 2500, 1736), .35, "covers", (800, 1280, 1920)),
    ("quito", QUITO, (0, 80, 1500, 924), .35, "covers", (800, 1280, 1500)),
    ("guayaquil", GYE, (0, 250, 2576, 1699), .15, "covers", (800, 1280, 1920)),
]

T_MEAN, T_SD, T_SAT = .54, .235, .095


def luma(a):
    return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722


def grade(im, wb):
    a = np.asarray(im).astype(np.float32) / 255
    m = a.reshape(-1, 3).mean(0)
    a = a * (1 + wb * (m.mean() / m - 1))                      # gentle white balance
    L = luma(a)
    lo, hi = np.percentile(L, [0.5, 99.6])
    a = np.clip((a - lo) / (hi - lo) * (0.955 - 0.035) + 0.035, 0, 1)  # levels, lifted blacks
    L = luma(a)
    a = (a - L.mean()) * np.clip(T_SD / L.std(), 0.9, 1.25) + L.mean()  # common contrast
    a = np.clip(a, 0.001, 1)
    a = a ** (np.log(T_MEAN) / np.log(luma(a).mean()))          # common brightness
    a = a + 0.12 * (a - 0.5) * (1 - np.abs(2 * a - 1))           # soft S-curve
    a = 0.03 + 0.95 * np.clip(a, 0, 1)
    L = luma(a)[..., None]
    d = a - L
    d = d * np.clip(T_SAT / np.abs(d).mean(), 0.82, 1.06)       # common saturation
    mag = np.abs(d).max(-1, keepdims=True)
    d = d * (1 / (1 + np.maximum(mag - 0.22, 0) * 1.6))          # protect strong reds
    a = L + d
    a[..., 0] *= 1.015                                           # shared warm tone
    a[..., 2] *= 0.985
    return Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8))


def run():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for name, src, box, wb, folder, widths in JOBS:
        out = os.path.join(root, "assets", folder)
        os.makedirs(out, exist_ok=True)
        g = grade(Image.open(src).convert("RGB").crop(box), wb)
        for w in widths:
            h = round(w * g.height / g.width)
            r = g.resize((w, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=0.7, percent=45, threshold=2))
            base = os.path.join(out, f"{name}-{w}")
            r.save(base + ".avif", quality=58, speed=4)
            r.save(base + ".webp", quality=80, method=6)
            if w == widths[-1]:
                r.save(base + ".jpg", quality=82, optimize=True, progressive=True)
        print("done", folder, name, widths)


if __name__ == "__main__":
    run()
