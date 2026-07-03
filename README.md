# Maison Célestine — Sérum Précieux Régénérant (PDP)

A premium cosmetics product page built on Shopify, on top of the default Dawn theme.

## Stack & constraints

- Liquid + plain CSS + vanilla JS (no Tailwind / React / jQuery)
- Fonts: Inter (body) and Jost (wordmark), via Google Fonts
- Everything dynamic through Liquid objects — product, variants, compare-at price,
  cart, menus, blog articles and section blocks. Nothing hardcoded.

## How it's organised

- `templates/product.knr-default.json` — the product template
- `sections/knr-*.liquid` — one file per page section, each with its own scoped
  `{% stylesheet %}` and schema blocks
- `assets/knr-base.css` — design tokens and shared primitives
- `assets/knr.js` — behaviour: cart drawer, variant/price switch, accordions,
  carousels, before/after slider, image zoom
- `snippets/knr-*.liquid` — reusable icon, star rating, image and footer helpers

Header, footer and announcement live in the `header`/`footer` section groups.

## Local development

```bash
shopify theme dev --store <your-store>.myshopify.com
```

Assign the `knr-default` template to a product (with at least two variants and a
few images) to render the page.
