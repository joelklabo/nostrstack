# QR codes (branded + reliable)

nostrstack uses QR codes for Lightning invoices (BOLT11) and other payloads. This repo treats QR as a first‑class UX surface: it should look great *and* scan reliably across phones/wallets.

## Design goals

- **Reliability first**: if a fancy style can’t be decoded, automatically fall back to a safe QR.
- **Customizable**: integrators should be able to theme QR via a serializable config (JSON).
- **Framework‑friendly**: works in the embed package (vanilla DOM) and can be wrapped by React in the web app.

## Chosen stack

- **Renderer**: `qr-code-styling` (MIT) for SVG/canvas rendering with branded styling primitives (rounded modules, corner styles, gradients, logo overlay).
- **Verification** (decode the rendered QR):
  - `BarcodeDetector` when available (fast, browser‑native).
  - `jsQR` as a portable fallback decoder.
- **Fallback renderer**: `qrcode` (already used in the repo) generates a standard high‑contrast QR PNG when verification fails (or if `qr-code-styling` fails to load).

## Reliability rules of thumb

- Preserve a **quiet zone** (margin) around the code (spec commonly recommends **4 modules**).
- Use a conservative **logo size** (small center icon) and hide background dots behind it.
- Understand **error correction tradeoffs**:
  - Higher ECC can tolerate more damage/overlays, but increases symbol density for long payloads.
  - Presets in this repo default to ECC `M` for “brand”, and `H` for “brandLogo”.

## Presets (current)

Defined in `packages/embed/src/qr.ts`:

- `safe`: high‑contrast, square modules, no logo/gradient.
- `brand`: rounded modules + gradient corners/dots (keeps good contrast).
- `brandLogo`: `brand` + small center lightning icon (ECC `H`) + strict verification with fallback.

## API surface

From `@nostrstack/widgets`:

- `renderQrCodeInto(container, data, opts)` renders into a DOM node and (optionally) verifies + falls back.
- `nostrstackQrPresetOptions(preset)` returns the base options used by presets (useful for “QR Lab”).

## QR Lab

The web app includes a **QR Lab** section (Lightning tab) to iterate on presets and JSON overrides with live verification results and copyable config.

## Alternatives considered (notes)

- `@bitjson/qr-code` (MIT): excellent Web Component with animation and branding primitives; less flexible for gradients/module shapes compared to `qr-code-styling`.
- `qrcode.react` / `react-qr-code`: great for “standard” QR rendering; not enough for “all‑out” styling without building our own renderer.
- “Art QR” libraries (background images / heavy distortion): high risk for scanner reliability; not recommended for invoices.
- `qrious` (GPL‑3.0): not a fit for this repo’s distribution needs.
