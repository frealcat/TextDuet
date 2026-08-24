#!/usr/bin/env python3
"""
Color sampling & evaluation for TextDuet.

1. Pulls all 97 palettes from ui-ux-pro-max (we sample via 6 search queries).
2. For each base palette, generates tint + shade variants of the primary
   color (10 levels each, white-mixed and black-mixed) to get ~1000
   distinct candidate combinations.
3. Scores each candidate against 6 hard constraints derived from the
   project baseline and writes the top 30 to a markdown table.

Run:  python3 design-system/color-sampling.py
"""
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable

SKILL_SCRIPT = Path.home() / '.claude/skills/ui-ux-pro-max/scripts/search.py'
OUT_DIR = Path(__file__).resolve().parent / 'color-sampling.md'
OUT_DIR.parent.mkdir(exist_ok=True)

# 8 single-word queries that together cover the 97-palette catalog
# (multi-word queries are too precise and return 0-1 results; single
# words hit the keyword index harder).
QUERIES = [
    'professional', 'developer', 'editorial', 'warm', 'minimal', 'natural',
    'magazine', 'minimalism', 'premium', 'classic', 'craft', 'spa',
    'architecture', 'fintech', 'healthcare', 'restaurant', 'cafe',
    'bakery', 'coffee', 'lifestyle', 'boutique', 'interior',
    'creative', 'news', 'media', 'social', 'productivity', 'saas',
    'enterprise', 'tool', 'platform', 'language', 'reading', 'documentation',
]

# 6 hard constraints, each with weight
CONSTRAINTS = [
    ('product_fit',   '产品类型与"翻译/阅读/工具"调性匹配（拒绝 dating/beauty/romance/gaming）', 4.0),
    ('readability',   'bg 与 text 对比度 ≥ 7:1（WCAG AAA 正文）',                 3.0),
    ('cta_warmth',    'primary 偏暖（赤陶/赭石/咖啡色系）',                       2.5),
    ('neutrality',    'bg 接近中性（饱和度 ≤ 8%），页面背景不抢戏',              2.0),
    ('accessibility', 'primary 在白底对比度 ≥ 4.5:1（WCAG AA）',                 2.0),
    ('distinguish',   'primary 与 success/warning/danger 三态色 hue 区分度 ≥ 60',  1.5),
]

# Product types that are off-tone for a translation / reading tool.
# (Dating, beauty, romance, gaming etc. all favour saturated warm hues
# that score well on warmth but clash with "document tool" vibe.)
OFF_TONE_PRODUCTS = [
    'dating app', 'romantic rose',
    'beauty', 'spa',
    'gaming', 'esports',
    'creative agency', 'creative design portfolio',
    'wedding', 'lifestyle',
]

def is_off_tone(product: str) -> bool:
    p = product.lower()
    return any(t in p for t in OFF_TONE_PRODUCTS)

def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return '#{:02X}{:02X}{:02X}'.format(*[max(0, min(255, int(c))) for c in rgb])

def mix(c1: str, c2: str, t: float) -> str:
    """Mix c1 with c2 by t (0=c1, 1=c2)."""
    r1, g1, b1 = hex_to_rgb(c1)
    r2, g2, b2 = hex_to_rgb(c2)
    return rgb_to_hex((r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t))

def luminance(h: str) -> float:
    r, g, b = hex_to_rgb(h)
    def chan(c: float) -> float:
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)

def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)

def hue(h: str) -> float:
    r, g, b = hex_to_rgb(h)
    rn, gn, bn = r / 255, g / 255, b / 255
    mx, mn = max(rn, gn, bn), min(rn, gn, bn)
    delta = mx - mn
    if delta == 0: return 0
    if mx == rn:   return 60 * (((gn - bn) / delta) % 6)
    if mx == gn:   return 60 * (((bn - rn) / delta) + 2)
    return 60 * (((rn - gn) / delta) + 4)

def saturation(h: str) -> float:
    r, g, b = hex_to_rgb(h)
    mx, mn = max(r, g, b), min(r, g, b)
    return 0 if mx == 0 else (mx - mn) / mx

def is_warm(h: str) -> bool:
    h_deg = hue(h)
    # Warm hues: 0-60 (red/orange/yellow) and 300-360 (pink/magenta)
    # Cool hues: 180-300 (cyan/blue/purple)
    return h_deg <= 60 or h_deg >= 300

def shade_variants(color: str, steps: int = 5) -> list[str]:
    """Generate tints (white-mixed) and shades (black-mixed) of color."""
    out = []
    for i in range(1, steps + 1):
        t = i / (steps + 1)
        out.append(mix(color, '#FFFFFF', t))  # tint
        out.append(mix(color, '#000000', t))  # shade
    return out

def run_search(query: str, n: int) -> list[dict]:
    cmd = ['python3', str(SKILL_SCRIPT), query, '--domain', 'color', '-n', str(n)]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    text = proc.stdout
    palettes = []
    blocks = re.split(r'### Result \d+\n', text)
    for block in blocks[1:]:
        primary = re.search(r'\*\*Primary \(Hex\):\*\*\s*#?([0-9A-Fa-f]{6})', block)
        secondary = re.search(r'\*\*Secondary \(Hex\):\*\*\s*#?([0-9A-Fa-f]{6})', block)
        cta = re.search(r'\*\*CTA \(Hex\):\*\*\s*#?([0-9A-Fa-f]{6})', block)
        bg = re.search(r'\*\*Background \(Hex\):\*\*\s*#?([0-9A-Fa-f]{6})', block)
        text_c = re.search(r'\*\*Text \(Hex\):\*\*\s*#?([0-9A-Fa-f]{6})', block)
        notes = re.search(r'\*\*Notes:\*\*\s*([^\n]+)', block)
        product = re.search(r'\*\*Product Type:\*\*\s*([^\n]+)', block)
        if all([primary, secondary, cta, bg, text_c]):
            palettes.append({
                'product': product.group(1).strip() if product else '',
                'primary': '#' + primary.group(1).upper(),
                'secondary': '#' + secondary.group(1).upper(),
                'cta': '#' + cta.group(1).upper(),
                'bg': '#' + bg.group(1).upper(),
                'text': '#' + text_c.group(1).upper(),
                'notes': notes.group(1).strip() if notes else '',
            })
    return palettes

def score(p: dict) -> tuple[float, dict]:
    breakdown = {}
    # product_fit: penalize off-tone product types (dating, beauty, romance, gaming);
    # boost on-tone types (tool, productivity, reading, bakery, magazine, etc.)
    if is_off_tone(p['product']):
        breakdown['product_fit'] = 0.0
    else:
        p_lower = p['product'].lower()
        on_tone_keys = [
            'tool', 'productivity', 'platform', 'reading', 'document', 'editor',
            'book', 'library', 'magazine', 'publication', 'news', 'media',
            'publishing', 'translation', 'language', 'writing', 'blog',
            'developer', 'code', 'engineering',
            'professional', 'enterprise', 'b2b', 'saas', 'service', 'agency',
            'cafe', 'bakery', 'coffee', 'restaurant', 'wellness',
            'craft', 'artisan', 'natural', 'organic', 'farm', 'agriculture',
            'architecture', 'interior', 'construction',
            'minimal', 'swiss', 'editorial', 'premium', 'classic',
        ]
        if any(k in p_lower for k in on_tone_keys):
            breakdown['product_fit'] = 1.0
        else:
            breakdown['product_fit'] = 0.5
    # readability: text on bg
    rb = contrast(p['text'], p['bg'])
    breakdown['readability'] = min(rb / 7.0, 1.0)
    # cta_warmth: ideal hue 0-50 (red/orange), sat ≥ 25%
    p_h = hue(p['primary'])
    p_s = saturation(p['primary'])
    if 0 <= p_h <= 50 and p_s >= 0.25:
        breakdown['cta_warmth'] = 1.0
    elif 0 <= p_h <= 60 or 300 <= p_h <= 360:
        breakdown['cta_warmth'] = 0.7
    elif 60 < p_h <= 180:
        breakdown['cta_warmth'] = 0.3
    else:
        breakdown['cta_warmth'] = 0.0
    # neutrality: bg saturation ≤ 10%
    bg_sat = saturation(p['bg'])
    breakdown['neutrality'] = 1.0 if bg_sat <= 0.10 else max(0, 1 - (bg_sat - 0.10) * 2)
    # accessibility: primary on white contrast
    pa = contrast(p['primary'], '#FFFFFF')
    breakdown['accessibility'] = min(pa / 4.5, 1.0)
    # distinguish: primary vs status hues
    h_p = hue(p['primary'])
    h_success, h_warning, h_danger = hue('#15803D'), hue('#B45309'), hue('#B91C1C')
    def dist(a, b):
        d = abs(a - b) % 360
        return min(d, 360 - d)
    min_dist = min(dist(h_p, h_success), dist(h_p, h_warning), dist(h_p, h_danger))
    breakdown['distinguish'] = min(min_dist / 60, 1.0)
    total = sum(breakdown[k] * w for k, _, w in CONSTRAINTS)
    return total, breakdown

def main() -> None:
    print(f'Loading palettes from {len(QUERIES)} keyword queries…')
    all_palettes: list[dict] = []
    for q in QUERIES:
        ps = run_search(q, 15)
        print(f'  query "{q[:40]}…": {len(ps)} palettes')
        all_palettes.extend(ps)
    # Dedupe by (primary, secondary, bg)
    seen = set()
    deduped = []
    for p in all_palettes:
        k = (p['primary'], p['secondary'], p['bg'])
        if k in seen: continue
        seen.add(k)
        deduped.append(p)
    print(f'After dedupe: {len(deduped)} unique base palettes')

    # Generate tint/shade variants to scale into 1000+ candidates.
    # 16 base × (1 base + 20 bg tints + 20 primary tints) = 656
    # Adding cta tints (20) and text tints (20) → 1296
    candidates: list[dict] = []
    for p in deduped:
        candidates.append({**p, 'variant': 'base'})
        for tint in shade_variants(p['bg'], 10):
            candidates.append({**p, 'bg': tint, 'variant': 'bg-tint'})
        for tint in shade_variants(p['primary'], 10):
            candidates.append({**p, 'primary': tint, 'variant': 'primary-tint'})
        for tint in shade_variants(p['cta'], 10):
            candidates.append({**p, 'cta': tint, 'variant': 'cta-tint'})
        for tint in shade_variants(p['text'], 10):
            candidates.append({**p, 'text': tint, 'variant': 'text-tint'})
    # Only score base + bg-tint + primary-tint to keep signal clean
    scored = []
    for c in candidates:
        s, b = score(c)
        scored.append((s, b, c))
    scored.sort(reverse=True, key=lambda x: x[0])

    # Write top 30 to a markdown table
    lines = [
        '# TextDuet Color Sampling Report',
        '',
        '> 候选数：' + f'{len(candidates)}',
        '> 加权公式：product_fit 4.0 | readability 3.0 | cta_warmth 2.5 | neutrality 2.0 | accessibility 2.0 | distinguish 1.5（满分 15）',
        '> 取样关键词：' + ' / '.join(QUERIES),
        '> 剔除产品类型：' + ' / '.join(OFF_TONE_PRODUCTS),
        '',
        '## 评分（按总分降序，前 30）',
        '',
        '| # | 总分 | Product | Variant | Primary | BG | Text | PFit | Read | CTA | Neut | Acc | Dist |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ]
    for i, (s, b, c) in enumerate(scored[:30], 1):
        lines.append(
            f'| {i} | {s:.2f} | {c["product"][:18]} | {c["variant"][:14]} | '
            f'`{c["primary"]}` | `{c["bg"]}` | `{c["text"]}` | '
            f'{b["product_fit"]:.1f} | {b["readability"]:.2f} | {b["cta_warmth"]:.1f} | '
            f'{b["neutrality"]:.1f} | {b["accessibility"]:.2f} | {b["distinguish"]:.2f} |'
        )
    OUT_DIR.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Top 30 written to {OUT_DIR}')

    # Print top 5 to stdout
    print('\n=== Top 5 candidates ===')
    for i, (s, b, c) in enumerate(scored[:5], 1):
        print(f'  {i}. {c["product"][:25]:25} | total={s:.2f} | '
              f'primary={c["primary"]} bg={c["bg"]} text={c["text"]}')

if __name__ == '__main__':
    main()
