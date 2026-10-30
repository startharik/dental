---
name: Clinical Diagnostic Precision
colors:
  surface: '#f7f9fc'
  surface-dim: '#d8dadd'
  surface-bright: '#f7f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f7'
  surface-container: '#eceef1'
  surface-container-high: '#e6e8eb'
  surface-container-highest: '#e0e3e6'
  on-surface: '#191c1e'
  on-surface-variant: '#44474e'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f4'
  outline: '#74777e'
  outline-variant: '#c4c6ce'
  surface-tint: '#4a5f81'
  primary: '#001632'
  on-primary: '#ffffff'
  primary-container: '#142b4a'
  on-primary-container: '#7d93b7'
  inverse-primary: '#b2c7ee'
  secondary: '#006a66'
  on-secondary: '#ffffff'
  secondary-container: '#7bf3ed'
  on-secondary-container: '#006f6b'
  tertiary: '#001a19'
  on-tertiary: '#ffffff'
  tertiary-container: '#00312f'
  on-tertiary-container: '#499f9c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b2c7ee'
  on-primary-fixed: '#021c3a'
  on-primary-fixed-variant: '#324768'
  secondary-fixed: '#7ef5ef'
  secondary-fixed-dim: '#60d9d3'
  on-secondary-fixed: '#00201f'
  on-secondary-fixed-variant: '#00504d'
  tertiary-fixed: '#9cf1ed'
  tertiary-fixed-dim: '#80d5d1'
  on-tertiary-fixed: '#00201f'
  on-tertiary-fixed-variant: '#00504e'
  background: '#f7f9fc'
  on-background: '#191c1e'
  surface-variant: '#e0e3e6'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  data-mono:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-sm: 1rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system delivers a clinical-grade diagnostic environment engineered for dental radiology, pathologies, and automated diagnostic decision workflows. Tailored for dental radiologists, clinical directors, and surgical teams, the user interface rejects consumer SaaS ornament in favor of uncompromising accuracy, optical clarity, and low visual fatigue during high-volume radiographic review.

The aesthetic fuses **Corporate / Modern** enterprise discipline with specialized **Medical Radiology Instrumentation**. The system prioritizes rapid triage, absolute confidence, and high data density. Optical structure relies on crisp, surgical division lines, strict geometric balance, and controlled color discipline. Accent colors serve exclusively as diagnostic signals and procedural calls-to-action, ensuring that radiological radiographs (bitewings, periapicals, CBCT orthopantomograms) remain the central focal point.

## Colors

The color architecture is built around calibrated contrast ratios to support long clinical shifts across ambient operatory lighting and high-contrast darkroom environments.

### Core Swatches
- **Primary Navy (`#142B4A`)**: Anchor tone for foundational system framing, primary navigation, modal headers, and dominant interface commands. Communicates authority and institutional reliability.
- **Accent Teal (`#16A6A1`)**: Precision AI detection indicator, primary active states, and focal diagnostic landmarks. Provides high optical contrast against dark imaging canvases and light clinical dashboards without inducing visual fatigue.
- **Secondary Teal Dark (`#0E7572`)**: Supporting structural state for focused borders, hover states on primary interactive elements, and sub-selection nodes.
- **Neutral Light Grey (`#F5F7FA`)**: Ambient background canvas providing low glare behind high-density patient records.
- **Surface Crisp White (`#FFFFFF`)**: Pure white base for clinical cards, diagnostic dossiers, parameter tables, and slide-over inspectors.
- **Radiology Canvas Charcoal (`#101622`)**: Dedicated deep darkroom tone reserved for DICOM viewing surfaces, panoramic renderers, and dental radiographic arrays.

### Neutral & Border Palette
- **Text Primary (`#172B45`)**: High-contrast slate-navy for diagnostic reports and tabular data headers.
- **Text Muted (`#64748B`)**: Structural secondary text for metadata, tooth numbering standards, and timestamp indicators.
- **Border Crisp (`#E3E9F0`)**: 1px structural separator providing definitive spatial partitioning between modules.
- **Border Subtle (`#EEF2F6`)**: Internal list delimiters and sub-table row dividers.

### Clinical Diagnostic Signals
- **Status Critical (`#DC2626`)**: Severe bone loss, periapical abscess, structural fractures, and urgent pathology alerts.
- **Status Warning (`#D97706`)**: Incipient caries, margin overhangs, and indeterminate structural anomalies requiring manual physician validation.
- **Status Confirmed (`#059669`)**: Healthy dental tissue, validated implants, and completed AI consensus scans.
- **Status Info (`#2563EB`)**: Treatment plan sequences, schedule changes, and general diagnostic notes.

## Typography

The typographic engine uses **Inter** across all diagnostic hierarchies. Inter provides unmatched neutral geometry, clear aperture shapes, and robust tabular numeric features vital for clinical measurement grids, tooth numbering, and confidence ratios.

### Typographic Directives
- **Tabular Figures (`tnum`)**: Enable OpenType tabular figures (`font-feature-settings: "tnum"`) across all numerical indicators, millimeter measurements, bone loss percentages, and coordinates.
- **Optical Density**: Body text sits at a compact 13px base (`body-md`) with an 18px line height. This maximizes usable screen real estate on dual-monitor clinical diagnostic workstations without compromising legibility.
- **Hierarchy Distinction**: Headlines utilize negative tracking (`-0.01em` to `-0.02em`) with medium-to-bold weights to firmly establish module anchors. Small diagnostic labels use increased letter spacing (`0.02em` to `0.03em`) and uppercase formatting when indicating anatomical tooth codes (e.g., `#18 MOD`, `#31 DISTAL`).

## Layout & Spacing

The layout is structured around an ultra-disciplined **4px base grid** optimized for high-density multi-pane radiological workstations.

### Layout Model
- **Dual-Pane Diagnostic Framework**: The workspace divides between a fixed/docked patient navigation rail (280px–340px width), a primary clinical workspace (fluid 12-column grid with `1rem` gutters), and an expandable diagnostic findings panel (360px width).
- **Radiology Canvas Viewport**: When transitioning into radiographic analysis (panoramic, bitewing, or CBCT slices), the container overrides dashboard rules to adopt an edge-to-edge canvas with zero outer margins and a strict 8px inner safety margin for tool overlays.

### Responsiveness & Reflow Rules
- **Desktop (1440px and above)**: Full 3-column view active simultaneously (Odontogram/Series Navigator, Full Radiograph/DICOM viewport, Real-time AI findings checklist).
- **Tablet / Operatory Mobile Carts (768px – 1024px)**: Collapses the findings checklist into an overlay drawer. The DICOM canvas claims 75% of visual width; bottom dock houses anatomical teeth selectors.
- **Mobile Handheld (Below 768px)**: Strict vertical stack. Radiographs switch to full-width horizontal pan containers; tabular findings transform into accordions keyed to individual tooth numbers.

## Elevation & Depth

This design system avoids heavy artistic drop shadows that could bleed into grayscale radiographic inspections. Depth is communicated primarily through **tonal layering**, **structural surface separation**, and **crisp 1px borders**.

### Elevation Tiers
- **Flat Ground (`#F5F7FA`)**: The foundation level for outer page framing and background tracks.
- **Level 1 (Card & Module Surfaces - `#FFFFFF`)**: Standard cards, clinical dossier containers, and data grids. Enclosed in a uniform `1px solid #E3E9F0` perimeter with a subtle, non-intrusive ambient shadow: `0 1px 3px 0 rgba(20, 43, 74, 0.04), 0 1px 2px -1px rgba(20, 43, 74, 0.02)`.
- **Level 2 (Hovered Panels & Filter Overlays)**: Interactive card elevations, floating tool palettes, and dropdown menus. Uses `1px solid #E3E9F0` combined with `0 4px 6px -1px rgba(20, 43, 74, 0.07), 0 2px 4px -2px rgba(20, 43, 74, 0.04)`.
- **Level 3 (Diagnostic Inspector Modals & Popovers)**: High-priority clinical intervention dialogs and confirmation modals. Uses `1px solid #E3E9F0` with `0 12px 24px -4px rgba(20, 43, 74, 0.12), 0 4px 8px -2px rgba(20, 43, 74, 0.06)`.
- **Level Canvas (Darkroom Canvas - `#101622`)**: Sunken clinical viewport. Outlined by an internal inset border (`box-shadow: inset 0 0 0 1px #1E293B`) to visually separate diagnostic scans from light administrative controls.

## Shapes

The design system uses structured, subtle curvature to communicate modern software capability while retaining the stability of an institutional medical tool.

### Geometry Standards
- **Containers and Cards**: Standardized at **12px radius** (`rounded-lg`). Creates distinct anatomical groupings for individual patient records, series overviews, and radiographic review zones without clipping internal corner data.
- **Interactive Controls & Fields**: Standardized at **8px radius** (base token). Applied to text inputs, dropdown triggers, segmented buttons, and standard clinical action buttons.
- **Badges, Pills, and Tags**: Standardized at **6px radius** (`rounded-sm`). Reserved for tooth identification chips (e.g., `#19`), pathology status chips (e.g., `Caries 94%`), and DICOM metadata tags.
- **Selection Overlays**: Crosshair targets and AI bounding box tags within image viewports maintain **4px radius** corners to preserve precise visual margins against radiographic details.

## Components

### Buttons & Interactive Controls
- **Primary Clinical Action**: Background `#142B4A`, foreground `#FFFFFF`, border `1px solid transparent`, corner radius 8px. Hover state changes background to `#1F3E69`. Focus ring: 2px offset with `#16A6A1`.
- **Diagnostic Accent (AI Execute/Accept)**: Background `#16A6A1`, foreground `#FFFFFF`. Hover state `#0E7572`. Active state triggers an illuminated glow `0 0 0 3px rgba(22, 166, 161, 0.25)`.
- **Secondary Neutral**: Background `#FFFFFF`, foreground `#172B45`, border `1px solid #E3E9F0`. Hover state `#F8FAFC` with border `#CBD5E1`.
- **Destructive/Critical**: Background `#FFFFFF`, foreground `#DC2626`, border `1px solid #FECACA`. Hover state background `#FEF2F2`.

### Chips & Clinical Badges
- **Tooth Number Badge**: Compact pill with 6px radius. Dark navy outline (`1px solid #142B4A`), subtle background `#EEF2F6`, text `#142B4A`, font weight 600, tabular figures enabled.
- **AI Probability Pill**: Background tint mapped directly to diagnostic status. For verified detections: background `#ECFDF5`, text `#059669`, border `1px solid #A7F3D0`. For uncertain anomalies: background `#FFFBEB`, text `#D97706`, border `1px solid #FDE68A`.
- **Metric Indicator**: Background `#101622`, text `#16A6A1`, border `1px solid rgba(22, 166, 161, 0.3)`. Applied across dark DICOM canvases to indicate zoom ratio, slice index, and contrast density.

### Tables & Data Grids
- **Header**: Background `#F8FAFC`, bottom border `1px solid #E3E9F0`, text 11px uppercase (`label-sm`), color `#64748B`.
- **Rows**: Alternating hover highlights using `#F8FAFC`. Explicit bottom border `1px solid #EEF2F6`. Cell padding 10px vertical, 14px horizontal.
- **Numerical Alignment**: Right-aligned, formatted with tabular Inter numbers. Confidence percentages use an integrated horizontal 32px progress bar alongside text.

### Form Inputs & Selectors
- **Input Fields**: Height 36px (compact clinical standard), background `#FFFFFF`, border `1px solid #E3E9F0`, 8px radius. Text `#172B45`, placeholder `#94A3B8`.
- **Focused State**: Border shifts to `#16A6A1` with an outer ring `0 0 0 2px rgba(22, 166, 161, 0.15)`.

### Radiology Viewport & Canvas Controls
- **Canvas Container**: Solid background `#101622`, border `1px solid #1E293B`, radius 12px.
- **Floating Toolbar**: Glass-tinted dark plate (`background: rgba(16, 22, 34, 0.85); backdrop-filter: blur(8px)`), border `1px solid rgba(255, 255, 255, 0.12)`, radius 8px. Houses DICOM tool toggles (window level, invert, measuring calipers, AI segmentation overlay).
- **Icons**: Clean geometric stroke aesthetic (Lucide style) with uniform 1.5px stroke width, sized at 16px for secondary controls and 20px for primary tool triggers.