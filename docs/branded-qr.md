# Branded QR codes

This repo aims to ship **beautiful branded QR codes** without sacrificing scan reliability. The demo app includes a “QR Lab” where you can experiment with presets + overrides and see live verification/fallback behavior.

## Goals

- Great aesthetics: gradients, rounded modules, custom finder patterns, optional center logo.
- High scan reliability: don’t ship a style that looks good but fails to decode on real devices.
- Consumer customization: embedders can supply logo/colors/shapes without forking.
- Small-ish footprint: keep the default integration lightweight, with a safe fallback.

## Current approach (recommended)

We use a **two-engine rendering strategy**:

1. **Primary (branded)**: `qr-code-styling`
   - Supports rounded dots, gradients, “eyes”, embedded images/logos, SVG output, etc.
2. **Fallback (boring but reliable)**: `qrcode`
   - Simple black/white QR generation used when verification fails.

And a **decode verification** step:

- Try the browser `BarcodeDetector` API when available.
- Fall back to `jsQR` when `BarcodeDetector` is unavailable or fails.

This gives us a “looks great” default, but automatically falls back when a given branded configuration becomes hard to scan.

## Why this stack?

- `qr-code-styling` is a popular browser-friendly library for branded QRs (logo + gradients + module styling).
- `qrcode` is a widely used baseline generator that produces dependable QRs.
- `BarcodeDetector` (when available) and `jsQR` give a pragmatic verification pipeline without adding a heavyweight decoder dependency by default.

## Alternatives considered (high-level)

- `qrcode` only: very reliable, but limited styling (no “branded” look).
- `awesome-qr` / similar: can produce pretty results, but often depends on heavier rendering stacks (e.g. node-canvas) and is less ideal for a browser-first embed.
- ZXing decoders (`@zxing/*`): robust decode support, but typically heavier; we prefer `BarcodeDetector` + `jsQR` unless/until we need more.

## Implementation notes / gotchas

- **Logo implies higher ECL**: when placing a center logo, use a high error correction level (`H`) and hide background dots behind the logo.
- **Quiet zone matters**: keep sufficient margin around the QR.
- **Avoid render flicker**: verification can be async; make QR rendering abortable to prevent outdated renders from mutating the DOM after a newer render starts.
- **Cross-origin images**: logos from URLs may require `crossOrigin: 'anonymous'` and a server that sends CORS headers.

## Where to look in code

- `packages/embed/src/qr.ts`: branded QR rendering + verification + fallback.
- `apps/gallery/src/QrLabCard.tsx`: demo “QR Lab” UI for trying configs.
