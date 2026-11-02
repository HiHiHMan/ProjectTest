---
name: noise
description: Apply or adjust only blur and SVG noise/grain effects on a requested HTML element or CSS class. Use when the user asks for blur, noise, grain, or texture.
---

# Blur & Noise Skill

## Purpose
Work only with two visual effects:
- **Blur:** soften the requested element or its content using CSS `filter: blur()`.
- **Noise:** add a subtle SVG fractal-noise overlay using CSS.

Do not add, modify, or preserve border styling as part of this skill. Border, border-radius, outline, shadow, and edge/fade treatments are outside its scope.

## Invocation
Examples:
- "ใช้ skill noise กับ class .a"
- "เพิ่ม noise ให้ .hero"
- "เพิ่ม blur ให้ .image"
- "ปรับ blur กับ noise ของ .card"

When invoked, read this file first, then inspect the requested target and its existing styles before editing.

## Required workflow
1. Locate the exact requested class or selector.
2. Inspect its HTML structure, existing filters, pseudo-elements, positioning, stacking context, and background styles.
3. Change only blur and/or noise, according to the user's request.
4. Prefer a CSS pseudo-element (::after or ::before) for the noise overlay when available. If both pseudo-elements are already occupied, use a dedicated child overlay only when necessary.
5. Keep the noise overlay non-interactive with `pointer-events: none`.
6. Place the noise layer correctly without unintentionally covering text or controls. Check the actual stacking context before choosing z-index.
7. Apply blur to the intended visual content. If the noise overlay must remain sharp, put the blur on an inner content element and keep the noise overlay on its parent; do not blur the overlay accidentally.
8. Do not introduce unnecessary JavaScript, canvas, resize listeners, or device-pixel-ratio compensation.
9. Leave all border-related and unrelated styles untouched.
10. After editing, summarize exactly which selector and blur/noise properties changed. Do not claim browser testing unless it was actually performed.

## Noise implementation
Use an inline SVG turbulence texture as a repeating background. Start with this pattern and tune it to the target's design:

~~~css
.target-class {
  position: relative;
  isolation: isolate;
}

.target-class::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.2;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 80px 80px;
}
~~~

The selector `.target-class` is a placeholder; replace it with the exact selector supplied by the user.

## Blur implementation
Apply blur only to the requested element or content:

~~~css
.target-content {
  filter: blur(0.5px);
}
~~~

Use the blur amount requested by the user. If no amount is specified, start subtly (for example, `0.5px`) and avoid changing image dimensions, crop, or other visual properties.

## Tuning rules
- Noise default opacity: `0.2`; match an existing project convention when appropriate.
- Fine grain: reduce `background-size`; coarse grain: increase it.
- Stronger noise: increase opacity gradually.
- Softer noise: reduce opacity.
- Keep `mix-blend-mode` only when it improves contrast on the actual background; otherwise use normal blending with a suitable low-opacity neutral texture.
- Do not add blur to the noise layer by default.
- Do not change borders, border radius, outlines, shadows, masks, edge fades, image dimensions, or crop.

## Browser zoom
Do not add JavaScript that attempts to compensate for browser zoom by reading `devicePixelRatio`. Keep noise defined in CSS and let it scale naturally unless the user explicitly requests fixed physical-pixel grain size. If that behavior is requested, explain browser limitations and test multiple zoom levels before claiming it works.

## Safety and scope
- Never replace an existing blur or noise implementation without checking what it does and preserving unrelated behavior.
- Do not add a second noise layer if one already exists; modify the existing one when appropriate.
- Do not change global selectors or shared styles unless the requested target requires it.
- Keep changes minimal and consistent with the repository's CSS organization.
- This skill is strictly limited to blur and noise; do not implement border or edge styling.
