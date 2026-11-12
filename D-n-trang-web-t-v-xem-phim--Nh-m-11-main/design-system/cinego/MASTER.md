# CINEGO DESIGN SYSTEM MASTER
## ART DIRECTION: CONTEMPORARY CINEMA EDITORIAL

> **Philosophy**: A synthesis of **Cinematic Art Direction**, **Modern Editorial Design**, **International Swiss Design**, and **Premium Entertainment Platforms**. Built like a world-class cinema journal and curation house — prioritizing tactile ivory paper backgrounds, stark obsidian typography, intentional asymmetric compositions, sharp hairlines, and authentic poster journalism.

---

## 1. COLOR TOKENS

| Role | Hex | Token Name | Context & Usage |
| :--- | :--- | :--- | :--- |
| **Editorial Canvas (Ivory)** | `#FAF8F5` | `--bg-ivory` | Main body paper background across customer views |
| **Elevated Surface (Cream)** | `#F3EFE6` | `--bg-cream` | Ticket dossiers, search drawers, filter toolbars |
| **Text Primary (Obsidian)** | `#121316` | `--text-ink` | Display mastheads, titles, primary typography (WCAG AAA) |
| **Text Secondary (Charcoal)** | `#474A54` | `--text-charcoal` | Body copy, technical ledgers, metadata |
| **Text Muted (Pewter)** | `#767A85` | `--text-muted` | Micro labels, edition numbers, timestamps |
| **Editorial Hairline** | `#E5E0D5` | `--border-hairline` | Subtle broadsheet rule dividers and frame lines |
| **Accent Vermilion** | `#BA2D27` | `--accent-vermilion` | Primary booking CTA, live indicators, selected seats |
| **Accent Antique Brass** | `#A6853B` | `--accent-brass` | Curators' choice badges, VIP status, critic rating stars |
| **Auditorium Dark (Selective)**| `#0E1015` | `--bg-auditorium` | Cinema room screening blueprint, stage depth canvas |

### 4-Color Seat Reservation System (SRS Specification)
- **Ghế Trống (Available)**: `#FFFFFF` (White) with subtle `#D3CCC0` border.
- **Ghế Đang Chọn (Selected)**: `#BA2D27` (Vermilion Red) with white label.
- **Ghế Đang Giữ Chỗ (Held)**: `#121316` (Obsidian Black) — optimistic 5-minute lock indicator.
- **Ghế Đã Bán (Sold)**: `#9CA3AF` (Muted Gray) with strikethrough / disabled state.

---

## 2. TYPOGRAPHY MATRIX

| Hierarchy | Font Family | Weights | Tracking / Line Height | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Grand Masthead & Monogram** | `Cinzel`, serif | 600, 700, 900 | `tracking-tight`, 1.05 | Brand identity, film Roman numerals, edition banners |
| **Editorial Display & Quotes** | `Cormorant Garamond`, serif | 500 italic, 600 | `tracking-normal`, 1.15 | Critic quotes, film synopses, curated headlines |
| **Body & UI Controls** | `Be Vietnam Pro`, sans-serif | 400, 500, 600, 700 | `tracking-tight`, 1.5 | Primary reading text, form controls, navigation, tables |
| **Technical Ledger & Timecodes** | `JetBrains Mono`, monospace | 500, 600 | `tracking-widest`, 1.0 | Seat numbers (A01), screening hours (19:30), countdown timers |

---

## 3. LAYOUT & COMPOSITION PRINCIPLES

1. **Broadsheet Mastheads & Asymmetric Hero**:
   - Replaces generic hero sliders with curated, multi-column editorial features.
   - 4-column technical ledger: Director, Cast, Runtime, Audio format.
   - Off-grid film stills, oversized serif titles with contrasting ultra-light subheadings.

2. **Perforated Ticket Passes (Letterpress Aesthetic)**:
   - Realized through CSS radial masks (`mask-image: radial-gradient(...)`) creating genuine scalloped ticket edges.
   - Dashed tear-lines and serial number barcodes.

3. **Restrained Micro-Interactions**:
   - Subtle image zoom on hover (`scale(1.03)` with `duration-500`).
   - Clean border transitions (`transition-colors duration-200`).
   - Pure SVG iconography (Lucide / Heroicons style) — **Strictly zero emojis**.

4. **Swiss Administrative Layout**:
   - High-density, high-legibility admin portal with fixed sidebar navigation.
   - Clean tabular records, operational KPIs, status badges, and POS ticket scanner simulator.

---

## 4. STRICT ANTI-PATTERNS (ELIMINATED)

- ❌ Dark SaaS Dashboard template look on public views.
- ❌ Purple/blue or generic neon gradients.
- ❌ Heavy, blurry Glassmorphism.
- ❌ All-card homogeneous layouts with identical big rounded corners (`rounded-3xl` everywhere).
- ❌ Emoji icons (🎬, 🍿, 🎟️, 🔥) in production typography.
- ❌ Low-contrast gray text on dark backgrounds.
