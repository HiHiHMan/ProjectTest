---
name: noise
description: Apply or adjust a reusable SVG fractal-noise overlay on a requested HTML/CSS target class. Use when the user asks to use the noise skill, add noise, grain, or texture to a class or element.
---

# Noise Skill

## Purpose
Apply a subtle, reusable noise/grain texture to the exact HTML element or CSS class named by the user.

## Invocation
Examples:
- "ใช้ skill noise กับ class .a"
- "ใช้ noise กับ .hero"
- "ปรับ noise ของ .card ให้เข้มขึ้น"

When invoked, read this file first, then inspect the target element and its existing styles before editing.

## Required workflow
1. Locate the requested class or selector in the project.
2. Inspect its HTML structure, positioning, stacking context, clipping, existing pseudo-elements, and background styles.
3. Apply the noise overlay to the requested element only. Do not rename or redesign unrelated elements.
4. Prefer a CSS pseudo-element (::after or ::before) when it avoids adding unnecessary markup. If the target already uses both pseudo-elements, use a dedicated child overlay only when needed.
5. Keep the overlay non-interactive with pointer-events: none.
6. Ensure the overlay sits above the target background/content layer as requested, without covering controls or text unintentionally. Explain or adjust z-index based on the actual stacking context.
7. Preserve existing border radius and clipping. If the noise should follow rounded edges, make the overlay inherit the target radius.
8. Make the effect responsive without introducing unnecessary JavaScript, canvas, resize listeners, or device-pixel-ratio compensation.
9. After editing, summarize exactly which selector and properties changed. Do not claim browser testing unless it was actually performed.

## Default implementation
Use an inline SVG turbulence texture as a repeating background. Start with this pattern and tune it to the target's existing design:

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
  border-radius: inherit;
  pointer-events: none;
  opacity: 0.2;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 80px 80px;
}
~~~

The selector .target-class is a placeholder; replace it with the exact selector supplied by the user.

## Tuning rules
- Default opacity: 0.2. Match the existing design if the project already has a noise opacity convention.
- Fine grain: reduce background-size; coarse grain: increase it.
- Stronger texture: increase opacity gradually.
- Softer texture: reduce opacity; do not add blur by default because blur changes grain size and can make it look muddy.
- Keep mix-blend-mode only if it improves contrast on the actual background. Otherwise use normal blending with a suitable low-opacity neutral texture.
- Do not alter the target image's own filter, dimensions, crop, mask, or other effects unless the user explicitly asks.

## Browser zoom requirement
Do not add JavaScript that attempts to compensate for browser zoom by reading devicePixelRatio. Browser zoom changes CSS pixel mapping and device-pixel ratio behavior; compensation can cause the texture to jump or scale inconsistently. Keep the texture defined in CSS and let it scale naturally with the element unless the user explicitly requests a fixed physical-pixel grain size. If fixed physical-pixel behavior is explicitly requested, explain the browser limitations and test the implementation at multiple zoom levels before claiming it works.

## Safety and scope
- Never replace an existing noise implementation without checking what it does and preserving unrelated behavior.
- Do not add a second noise layer if one already exists; modify the existing one when appropriate.
- Do not change global selectors or shared styles unless the requested target requires it.
- Keep changes minimal and consistent with the repository's current CSS organization.
