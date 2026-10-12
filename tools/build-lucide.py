#!/usr/bin/env python3
"""Build icon-sets/lucide.json: the Lucide icon set (https://lucide.dev, ISC License) for Sigma.

  python3 tools/build-lucide.py [version]

Reads, for one pinned version of lucide-static: icon-nodes.json (the shapes of every icon), tags.json
(search keywords) and LICENSE from jsDelivr, the icons' categories from lucide.dev, and the category
titles from the Lucide repository. Each icon's group is its first category; its other categories go into
its keywords. Sigma loads the result when you choose + Sigma Icons ▾ → Lucide.
"""
import json
import sys
import urllib.request
from html import escape
from pathlib import Path

VERSION = sys.argv[1] if len(sys.argv) > 1 else '1.55.0'
NPM = f'https://cdn.jsdelivr.net/npm/lucide-static@{VERSION}'
REPO = f'https://cdn.jsdelivr.net/gh/lucide-icons/lucide@{VERSION}'
OUT = Path(__file__).resolve().parent.parent / 'icon-sets' / 'lucide.json'

# Only plain shapes and their geometry, like Sigma's SVG import (any color becomes currentColor).
SHAPES = {
    'path': ['d'], 'circle': ['cx', 'cy', 'r'], 'ellipse': ['cx', 'cy', 'rx', 'ry'],
    'rect': ['x', 'y', 'width', 'height', 'rx', 'ry'], 'line': ['x1', 'y1', 'x2', 'y2'],
    'polyline': ['points'], 'polygon': ['points'],
}


def get(url, as_json=True):
    with urllib.request.urlopen(url, timeout=60) as r:
        data = r.read().decode('utf-8')
    return json.loads(data) if as_json else data


def body(nodes):
    out = []
    for tag, attrs in nodes:
        if tag not in SHAPES:
            raise ValueError(f'unexpected element {tag}')
        parts = [f'{k}="{escape(str(attrs[k]), quote=True)}"' for k in SHAPES[tag] if k in attrs]
        if 'fill' in attrs:
            parts.append('fill="none"' if attrs['fill'] == 'none' else 'fill="currentColor"')
        out.append(f'<{tag} {" ".join(parts)}/>')
    return ''.join(out)


def main():
    nodes = get(f'{NPM}/icon-nodes.json')
    tags = get(f'{NPM}/tags.json')
    license_text = get(f'{NPM}/LICENSE', as_json=False).strip()
    categories = get('https://lucide.dev/api/categories')
    titles = {}
    for slug in sorted({c for cs in categories.values() for c in cs}):
        try:
            titles[slug] = get(f'{REPO}/categories/{slug}.json')['title']
        except Exception:
            titles[slug] = slug.replace('-', ' ').capitalize()
    icons = []
    for name in sorted(nodes):
        cats = categories.get(name) or []
        group = titles.get(cats[0], '') if cats else ''
        words = list(dict.fromkeys([*(tags.get(name) or []), *(titles[c] for c in cats[1:] if c in titles)]))
        icons.append([name, group, ', '.join(words), body(nodes[name])])
    data = {
        'name': 'Lucide', 'version': VERSION, 'url': 'https://lucide.dev', 'license': 'ISC',
        'licenseText': license_text, 'viewBox': '0 0 24 24', 'style': 'outline', 'strokeWidth': 2,
        'cap': 'round', 'join': 'round', 'icons': icons,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False))
    print(f'{len(icons)} icons in {len(set(i[1] for i in icons))} groups → {OUT} ({OUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
