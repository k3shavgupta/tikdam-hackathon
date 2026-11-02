# Tikdam brand identity

Tikdam means a clever move. The visual idea is a small, useful receipt: something you can check before the purchase becomes a tax question. The brand is clever, friendly, clear, Desi-smart, and trustworthy. Its jokes stay in the framing, never in the tax result.

## Voice

- Say what the user can check, what is still unknown, and what to keep.
- Use everyday words such as **bill**, **work use**, and **proof** before specialist terms.
- Never imply that an estimate is an approved claim or that AI decides tax law.
- Product line: **Check before you buy.** Supporting line: **Can you claim it? Check first.**

## Logo explorations

All concepts are original inline SVG and use a 32 by 32 viewBox so they can be judged at 16px. SVG text is not used for the icon.

### Concept A: folded bill

A receipt silhouette with a folded corner and a compact check. Clear as a receipt, but the T is weak at favicon size.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-label="Tikdam folded bill concept">
  <path d="M6 3h16l4 4v22l-5-2-5 2-5-2-5 2V3Z" fill="#B6F09C" stroke="#121212" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M21 3v5h5" stroke="#121212" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="m10 17 4 4 8-9" stroke="#121212" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### Concept B: check T receipt, selected

The bold top bar makes the T legible; the descending stroke resolves into a check. Two clipped lower corners hint at a receipt without tiny perforations. This is the primary mark.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-label="Tikdam check T concept">
  <path d="M5 3h22a2 2 0 0 1 2 2v19l-4 5-5-3-4 3-4-3-5 3-4-5V5a2 2 0 0 1 2-2Z" fill="#B6F09C" stroke="#121212" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M9 10h14M16 10v9l-3 3-3-3m6 0 2 2 6-7" stroke="#121212" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### Concept C: check coin

A simpler coin with a T-check monogram. Strong at small size, but less distinctive to the purchase and bill context.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-label="Tikdam check coin concept">
  <circle cx="16" cy="16" r="13" fill="#B6F09C" stroke="#121212" stroke-width="2.4"/>
  <path d="M9 10h14M16 10v10l-3 3-3-3m6 0 2 2 5-6" stroke="#121212" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

## Selected logo assets

The production SVG files live under `landing/public/brand/`; these are the exact inline forms used to make them. The wordmark is live text on the site, set in Bricolage Grotesque, so it remains crisp and accessible.

### Main logo: icon and wordmark

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40" role="img" aria-label="Tikdam">
  <path d="M5 3h26a2 2 0 0 1 2 2v25l-5 6-6-4-5 4-5-4-6 4-5-6V5a2 2 0 0 1 2-2Z" fill="#B6F09C" stroke="#121212" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M10 12h15M17.5 12v11l-3.5 3-3-3m6.5 0 3 2 6-8" fill="none" stroke="#121212" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="44" y="29" fill="#121212" font-family="Bricolage Grotesque, sans-serif" font-size="29" font-weight="800" letter-spacing="-1.5">tikdam</text>
</svg>
```

### Icon only and favicon

Use selected Concept B. The favicon uses the same paths, with no wordmark or small decorative details. Serve as `icon.svg` and at 16px keep at least one pixel of breathing room.

### Black version

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-label="Tikdam icon black">
  <path d="M5 3h22a2 2 0 0 1 2 2v19l-4 5-5-3-4 3-4-3-5 3-4-5V5a2 2 0 0 1 2-2Z" fill="#121212"/>
  <path d="M9 10h14M16 10v9l-3 3-3-3m6 0 2 2 6-7" stroke="#FFFBEB" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### White version

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-label="Tikdam icon white">
  <path d="M5 3h22a2 2 0 0 1 2 2v19l-4 5-5-3-4 3-4-3-5 3-4-5V5a2 2 0 0 1 2-2Z" fill="#FFFBEB"/>
  <path d="M9 10h14M16 10v9l-3 3-3-3m6 0 2 2 6-7" stroke="#121212" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

## Colour system

| Role | Hex | Use |
| --- | --- | --- |
| Warm paper | `#FFFBEB` | Main canvas and large quiet areas |
| Ink | `#121212` | Text, strong borders, dark sections |
| Electric lime | `#B6F09C` | Primary actions and key result emphasis |
| Receipt white | `#FFFFFF` | Cards and chat surfaces |
| Coral | `#FF6B4A` | Small playful accents and sticker edges |
| Subdued ink | `#4B4B45` | Secondary body copy on paper |
| Success | `#267A42` | Eligible status, always with text |
| Warning | `#925400` | Conditional status, always with text |
| Danger | `#B83A36` | Not eligible status, always with text |

**60 / 30 / 10:** 60% warm paper and white breathing room, 30% ink for type and structure, 10% lime and coral combined for actions and emphasis. Status colours are reserved for verdicts. Never rely on colour alone.

## Typography

- **Bricolage Grotesque**, Google Fonts, headings and wordmark. Use 700 to 800 for large, compact headlines.
- **Space Grotesk**, Google Fonts, body and controls. Use 400 to 600. Keep the base at 16px and line height near 1.5.
- Display type is left aligned and oversized. Body measure stays under about 70 characters. Keep labels in sentence case.

## Shape and motion

- Receipt edges, dashed rules, black outlines, and one hard offset shadow are the signature materials.
- Buttons depress by two pixels on press. Scenario cards may tilt a little on hover, while all important content remains static and readable.
- Marquee pauses on hover and focus, and becomes static when reduced motion is requested.
- No purple or blue gradient, glass card, stock finance photo, invented testimonial, or decorative icon without a job.

## Product truth in the design

The marketing preview is a front-end illustration. Its mock inputs and outcomes must say so. The existing India app has narrow confirmed-invoice numerical coverage for office stationery; a laptop or phone example must not imply the current calculator supports a numerical claim. The second jurisdiction can be shown as a limited demo preview, with unsupported cases named plainly. Never call a conditional candidate amount a tax saving.
