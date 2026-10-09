#!/usr/bin/env python3
"""
build_assets.py - turns the Figma export into web-ready assets for the site.

Run once from this folder (it is NOT needed on Vercel):
    pip install pillow
    python build_assets.py

Reads  ../figma_export_27-4940.zip  (or an unzipped figma_export_27-4940 folder next to it)
Writes assets/img/*.jpg, assets/people/*.svg, assets/svg/*.svg and js/scene-data.js.
Commit the generated files to GitHub; Vercel serves them as plain static files.
"""
import io
import json
import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXPORT = "figma_export_27-4940"

# imageRef prefix -> (output name, max width)
IMAGES = {
    "00940a4d5b581aa5": ("hero", 2400),
    "4a832dfafda0231f": ("karaoke", 1600),
    "9e459a40c3d7df6c": ("game-night", 1600),
    "7ae1fb9b503b517c": ("movie", 1600),
    "6ccd3266312dcd73": ("open-mic", 1600),
    "492083b17d16c299": ("workshop", 1600),
    "608b91eaaf3578ad": ("sofa", 1600),
    "b99ac411f95b6a2d": ("studio", 1600),
    "c8542942f583df72": ("lights", 1600),
    "0b07cc053baffe11": ("dch", 600),
    "5a5d0865fc36015a": ("venue", 800),
    "4e1e1f8ada91a658": ("insta-1", 600),
    "5d7c58d55166d305": ("insta-2", 600),
    "29fd35a185c851bc": ("insta-3", 600),
    "ccc0f94a8189ea4d": ("insta-4", 600),
}


# ------------------------------------------------------------------ source
def source():
    for base in (HERE.parent, HERE.parent.parent):
        z = base / f"{EXPORT}.zip"
        if z.exists():
            zf = zipfile.ZipFile(z)
            names = {n.replace("\\", "/"): n for n in zf.namelist()}
            return lambda rel: zf.read(names[f"{EXPORT}/{rel}"])
        d = base / EXPORT
        if d.is_dir():
            return lambda rel: (d / rel).read_bytes()
    sys.exit(f"Could not find {EXPORT}.zip or an {EXPORT} folder next to the website folder.")


# ------------------------------------------------------------------ svg renderer
def color(paints):
    for p in paints or []:
        if p.get("visible", True) and p.get("type") == "SOLID":
            c = p["color"]
            r, g, b = (round(c[k] * 255) for k in "rgb")
            a = c.get("a", 1) * p.get("opacity", 1)
            attr = f'fill="#{r:02x}{g:02x}{b:02x}"'
            return attr + (f' fill-opacity="{a:.3g}"' if a < 0.999 else "")
    return None


def matrix(t):
    return (f"matrix({t[0][0]:.6g} {t[1][0]:.6g} {t[0][1]:.6g} "
            f"{t[1][1]:.6g} {t[0][2]:.6g} {t[1][2]:.6g})")


class Doc:
    def __init__(self, root):
        self.root = root
        self.by_id, self.parent = {}, {}
        stack = [root]
        while stack:
            n = stack.pop()
            self.by_id[n["id"]] = n
            for c in n.get("children", []):
                self.parent[c["id"]] = n["id"]
                stack.append(c)
        bb = root["absoluteBoundingBox"]
        self.ox, self.oy = bb["x"], bb["y"]

    def box(self, nid):
        b = self.by_id[nid]["absoluteBoundingBox"]
        return [round(b["x"] - self.ox, 1), round(b["y"] - self.oy, 1),
                round(b["width"], 1), round(b["height"], 1)]

    def subtree(self, nid):
        out, stack = set(), [self.by_id[nid]]
        while stack:
            n = stack.pop()
            out.add(n["id"])
            stack.extend(n.get("children", []))
        return out

    def ancestors(self, nid):
        out = set()
        while nid in self.parent:
            nid = self.parent[nid]
            out.add(nid)
        return out

    def _render(self, n, draw, keep, skip, is_root):
        if not n.get("visible", True) or n["id"] in skip or n.get("type") == "TEXT":
            return ""
        parts = []
        if n["id"] in draw:
            fa = color(n.get("fills"))
            if fa:
                for g in n.get("fillGeometry", []):
                    rule = "evenodd" if g.get("windingRule") == "EVENODD" else "nonzero"
                    parts.append(f'<path d="{g["path"]}" {fa} fill-rule="{rule}"/>')
            sa = color(n.get("strokes"))
            if sa:
                for g in n.get("strokeGeometry", []):
                    parts.append(f'<path d="{g["path"]}" {sa}/>')
        for c in n.get("children", []):
            if c["id"] in keep or c["id"] in draw:
                parts.append(self._render(c, draw, keep, skip, False))
        body = "".join(parts)
        if not body or is_root:
            return body
        op = n.get("opacity", 1)
        opa = f' opacity="{op:.3g}"' if op < 0.999 else ""
        return f'<g transform="{matrix(n["relativeTransform"])}"{opa}>{body}</g>'

    def region_svg(self, targets, box, skip=frozenset()):
        draw, keep = set(), set()
        for t in targets:
            draw |= self.subtree(t)
            keep |= self.ancestors(t)
        x, y, w, h = box
        body = self._render(self.root, draw, keep, set(skip), True)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" '
                f'width="{w:g}" height="{h:g}">{body}</svg>')


def is_person(node):
    m = re.fullmatch(r"Frame (\d+)", node["name"])
    return bool(m) and 23 <= int(m.group(1)) <= 47


# ------------------------------------------------------------------ main
def main():
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Missing dependency: run  pip install pillow  and try again.")

    read = source()
    doc = Doc(json.loads(read("nodes.json")))
    out = HERE / "assets"
    for sub in ("img", "people", "svg"):
        (out / sub).mkdir(parents=True, exist_ok=True)

    # ---- photos
    for ref, (name, maxw) in IMAGES.items():
        try:
            data = read(f"images/{ref}.png")
        except (KeyError, FileNotFoundError):
            print(f"  missing image {ref} ({name}), skipped")
            continue
        im = Image.open(io.BytesIO(data)).convert("RGB")
        if im.width > maxw:
            im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
        im.save(out / "img" / f"{name}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        print(f"  img/{name}.jpg  {im.width}x{im.height}")

    # ---- people for the floor-plan scene
    def kids(nid):
        return [c["id"] for c in doc.by_id[nid].get("children", [])]

    groups = {
        "row1": [c for c in kids("27:5261") if is_person(doc.by_id[c])],
        "row2": [c for c in kids("27:4968") if is_person(doc.by_id[c])],
        "trail": ["63:247", "63:343", "63:294"],
        "room": [c for c in kids("63:37") if is_person(doc.by_id[c])] + ["63:321", "63:599"],
    }
    people_ids = set()
    for ids in groups.values():
        people_ids |= set(ids)

    written, scene = set(), {}
    for group, ids in groups.items():
        items = []
        for nid in ids:
            n = doc.by_id[nid]
            name = n["name"].replace("Frame ", "p")
            box = doc.box(nid)
            if name not in written:
                (out / "people" / f"{name}.svg").write_text(
                    doc.region_svg([nid], box), encoding="utf-8")
                written.add(name)
            items.append({"n": name, "x": box[0], "y": box[1], "w": box[2], "h": box[3]})
        scene[group] = items
    print(f"  people/: {len(written)} figures")

    # ---- static illustrations
    floor_box = [100, 1755, 1310, 450]
    (out / "svg" / "floor.svg").write_text(doc.region_svg(
        ["63:34", "63:69", "63:71", "63:81"], floor_box, skip=people_ids), encoding="utf-8")
    scene["floor"] = floor_box

    hero_targets = [c for c in kids("27:4941") if doc.by_id[c]["type"] != "TEXT"
                    and doc.by_id[c]["name"] != "Frame 22"] + ["27:5565"]
    (out / "svg" / "hero-overlay.svg").write_text(
        doc.region_svg(hero_targets, [0, 0, 1512, 750]), encoding="utf-8")

    (out / "svg" / "why-shapes.svg").write_text(
        doc.region_svg(["67:847"], doc.box("67:847"), skip={"71:865"}), encoding="utf-8")

    (out / "svg" / "crowd.svg").write_text(
        doc.region_svg(["113:1379"], doc.box("113:1379")), encoding="utf-8")
    print("  svg/: floor, hero-overlay, why-shapes, crowd")

    (HERE / "js").mkdir(exist_ok=True)
    (HERE / "js" / "scene-data.js").write_text(
        "/* generated by build_assets.py */\nwindow.SCENE_DATA = "
        + json.dumps(scene, separators=(",", ":")) + ";\n", encoding="utf-8")
    print("  js/scene-data.js")
    print("\nDone. Commit the assets/ folder and js/scene-data.js.")


if __name__ == "__main__":
    main()
