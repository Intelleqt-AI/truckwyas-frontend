# TruckWys product brand and CSS rules

Version 1.0.0 · 10 September 2026 · Applies to dashboard, mobile and product UI embedded in marketing. This is the implementation standard requested by David. It supersedes conflicting typography/capitalisation recommendations in the earlier AI/UI guideline document. It does not claim every existing screen has been migrated.

## Start here: instructions for every agent

1. Read this file, `tokens.json`, the applicable repository AGENTS.md and the component being changed before editing UI. Use `truckwys-brand.css` as the web reference; map the same semantic roles to React Native. Native apps do not load CSS.
2. Reuse existing components and the authentic logo/icon. Adopt the rules in scoped component/page changes; do not add a global CSS override that silently restyles the entire app. Keep existing financial, routing, authentication, AI and request-identity guards intact.
3. Use the common font, case and size for each role. No page-specific monospace tabs, tracked all-caps buttons, decorative emojis or new accent colours. Exceptions need a concrete reason in the PR and owner approval if they substantially change the product.
4. One fix per branch/PR. Include affected screens, light/dark and mobile evidence, interaction checks and explicit untested states. A CSS file, typecheck, screenshot or source review alone is not whole-product acceptance.
5. Production is hands off. Saif alone merges and deploys. Use synthetic local data. Do not resume the stopped automation.

## Identity and product language

Use TruckWys in prose; preserve the logo asset's typography and proportions exactly. The product is an AI financial intelligence layer alongside TMS, accounting and fleet systems, not a replacement TMS. Do not claim universal integrations or appointed capital providers. Capital capability, actual availability and eligibility are different states. No speculative monetary benefit, false real-time label or fabricated score is acceptable visual storytelling.

Use the existing line-icon family. Standard inline icon 16px; action icon 20px; standalone 24px, consistent stroke around 1.5–2px according to the existing family. Align icons optically and preserve a 44px minimum standalone target. Hide decorative icons from assistive technology; name icon-only actions. Never reconstruct the logo with text, emoji or a new drawing.

## Capitalisation and copy

Sentence case is mandatory for page titles, card titles, tabs, buttons, labels, table headings and ordinary statuses. Author the correct visible string; CSS `text-transform:none` cannot fix an uppercase source string. Do not run a blanket titleCase/lowercase transformation over customer-entered names or identifiers.

| Instead of | Use |
|---|---|
| ACTIVE ORDERS / Active Orders | Active orders |
| MARGIN ENGINE / Margin Engine | Margin engine |
| TOTAL INVOICED MTD | Total invoiced this month |
| SAVE AS DRAFT | Save as draft |
| IN_TRANSIT | In transit |
| NO DATA FOUND | No invoices yet, when a successful response contains none |

Preserve acronyms and recognised terms: AI, VAT, POD, API, TMS, CSV, PDF, USD, ZAR, iOS, Android, SARS, C-BRTA. Preserve legal names, invoice/quote numbers, registration plates and user content. Metadata can use a concise muted eyebrow in sentence case; uppercase monospace eyebrows are legacy exceptions to migrate, not the new default. Status payload enums remain unchanged; only their presentation is mapped.

Action names describe the action and object: New quote, Save changes, Retry loading, Review costs. Avoid vague Proceed and AI hype. Busy states retain the accessible action name. Errors say what failed and the safe next step without blaming the user. Do not show implementation jargon, raw exceptions, class names or provider stack traces.

## Typography and hierarchy

Use the existing system sans stack. Do not introduce a font download or imitate another brand's typeface. Use tabular numerals for aligned financial columns. Monospace is for identifiers, codes and appropriate diagnostic values, not all labels, money or navigation.

| Role | Size / line height | Weight | Case / treatment |
|---|---|---|---|
| Page title |22/28px |600 | Sentence case; one H1 per screen |
| Section/card title |16/24px |600 | Sentence case; H2/H3 according to hierarchy |
| Body |14/20px web;16/24px native reading/form content |400 | Normal tracking |
| Label |13/20px |500 | Visible, associated with field |
| Subpage tab/navigation |14/20px |400;500 active | Sans, normal tracking |
| Supporting text |13/20px |400 | Muted; never the only place critical costs/errors appear |
| Primary metric |28/36px |600 | Tabular numerals, complete value or clearly labelled abbreviation |
| Identifier |13/20px mono |400 | Preserve case and characters |

Use semantic headings, not a stack of styled divs. Keep page title, description and primary action grouped. Do not communicate hierarchy only through colour. No 8–10px essential labels. Long text wraps; containers grow. Do not reduce font size to fit money or delete cents. Never use CSS truncation for the sole visible critical financial amount.

## Spacing, layout and shape

Use 4,8,12,16,20,24,32,40,48px spacing. Label-to-control 6px is a documented optical exception; help/error-to-control 6px. Related controls 12–16px; card padding 24px desktop/16px phone; section separation 24–32px; page padding 32px desktop/20px vertical and 16px horizontal phone. Keep related edges and baselines aligned.

Target radii: controls 6px, cards 8px, dialogs 12px, badges 4px. Fully rounded shapes are reserved for actual pills, avatars, toggles and circular icon targets. These are adoption targets; legacy 2px cards must be migrated by component, not overwritten by a global `*` rule. Do not nest cards simply to create decoration. Use one quiet border or modest light-theme shadow, not both heavy shadows and glowing outlines.

Desktop grids use `minmax(0,1fr)`; children need `min-width:0`. At narrow widths, stack cards before amounts or labels become cramped. Prefer intrinsic layout over device-name breakpoints. Tables may scroll within a labelled local region; the entire page must not acquire horizontal overflow. Preserve genuine table semantics and keyboard access. Mobile prioritises the next action, essential fields and readable values; it is not a shrunken desktop screenshot.

## Colour and themes

`tokens.json` is the reference for new semantic roles; `truckwys-brand.css` implements them with `--tw-*` names. Existing dashboard `theme.css` and native `tokens.ts` remain runtime sources until each migration is reviewed. Do not claim token adoption from a matching screenshot alone.

Retain the recognisable blue action accent: light #2563EB, dark #4D9EFF. Light surfaces #FFFFFF on #F3F4F6; dark surfaces #101215 on #060709. Body text #111827/#EDEDED. Supporting text uses tested roles, not opacity applied to arbitrary parents. Use white text on the light blue action and near-black text on the brighter dark-mode action. Both combinations require contrast checks after state changes.

Separate text colours from chart/decorative hues. Light success/warning/danger text uses #166534/#92400E/#B91C1C on its semantic surface; dark equivalents #86EFAC/#FCD34D/#FCA5A5. Existing saturated green/yellow/red chart swatches are not automatically readable body text. Success is a confirmed successful state, not generic emphasis. Every status includes a text label; no red/green-only meaning.

Theme switching preserves content, focus, selection and unsaved forms. Portals, tooltips, toasts, menus, dialogs, native sheets, system bars and charts must use the active theme. Do not hardcode dark toast colours into light mode. Do not invert photographs/logo assets blindly. The actual logo variant must be legible on its surface.

## Components and states

**Buttons:**40px desktop,48px primary touch; icon target 44px minimum. One clearly dominant primary action per task area. Secondary outlined/quiet, destructive explicitly named. Keep hover, focus, active, disabled and busy distinguishable. Use real disabled behavior and prevent duplicate requests; `aria-disabled` alone does not block activation. Do not wrap critical action text into an unreadable narrow button.

**Fields:** visible label, explicit units, required indication where needed, useful example only as placeholder, help/error connected with `aria-describedby`. Mobile input text 16px minimum; use correct input mode. Focus ring 2px with3px offset; never blanket-remove outlines. Invalid state uses text plus boundary colour. Preserve entered values on network errors. A default numeric zero must not hide absence of data.

**Tabs/navigation:** shared sans 14/20px, normal tracking, sentence case,2px active underline. Route navigation uses links/aria-current; actual in-page tabs use an accessible tab primitive with selection and keyboard behavior. Do not add `role=tab` to buttons without implementing the keyboard/panel contract. On phones, allow intentional local tab scrolling; last tab must remain reachable.

**Cards/metrics:** label then value then contextual comparison/source. State the period, currency/unit and comparison basis. A ratio must have a defined denominator. Redesigning the visual cannot repair incorrect data. Loading is a skeleton/loading label; successful empty is a helpful next action; unavailable is an em dash plus explanation; error offers safe retry. Do not announce every skeleton separately.

**Tables:** sentence-case column headings, numeric columns right aligned, consistent number format, labelled sort controls and pagination/data completeness. Row actions have names. Preserve sticky headers only when they do not hide focus or content. A blank row is not proof of no records if fetching failed. On mobile, retain table scroll or use a deliberate labelled detail layout.

**Dialogs/sheets:** accessible title/description, predictable close control, focus containment/return, safe-area and keyboard handling. No clipped footer actions. Destructive confirmation includes the specific object. No blanket click-outside dismissal during an irreversible request.

**Feedback:** local field errors near fields; page/request errors close to the affected region; concise toast for a confirmed event. Appropriate live-region announcements without forcing focus. Keep pending versus failed versus unknown settlement distinct. Retry must reuse the existing idempotency/request identity where required.

**Charts:** labels and units in the sans scale, chronological axes, zero/negative values preserved, accessible data alternative, hover/focus details with exact values. Consistent semantic series colours across screens, period/source/coverage visible. Do not smooth sparse data into invented trends or show a prediction as measured history. Missing data is a gap/unavailable state, not zero.

**AI and quote evidence:** facts, calculations, assumptions, suggestions and missing evidence are visibly different. Scores show sample/supporting evidence when available; no fake confidence. Tolls/fuel must carry source, effective date, unit/grade and verification state. Unreviewed missing costs label a subtotal as incomplete; a plausible number is not proof of a verified quote. Preserve draft availability and the agreed cost review workflow. No decorative magic badges or fabricated “live” indicators.

## Financial and regional formatting

Use existing shared formatters and a declared locale/currency policy. Use two decimals for exact ZAR totals; use sufficient precision for per-litre inputs and show their units. Currency symbols alone must not confuse USD/ZAR/MZN. Preserve negative signs and meaningful zeros. Dates follow the application's South African presentation consistently; stored ISO dates and API enums stay machine-readable. Avoid ambiguous two-digit years. Abbreviations such as R 1.2m need an exact accessible value. A foreign fee retains native currency and its dated conversion alongside the rand estimate.

## Native mapping

React Native uses the semantic token values and shared Text/Button/Input components. Use native system fonts; `fontVariant:['tabular-nums']` for financial columns where supported, platform-specific mono only for IDs. Numeric spacing/radius values map to density-independent units, not raw device pixels. Respect safe-area insets, keyboard avoidance, reduced motion, screen-reader names/state and font scaling. Do not disable `allowFontScaling` to force a design to fit. Touch actions 48px, icon targets 44px minimum; verify hitSlop does not overlap another action.

NativeWind/theme-provider roles must agree with JS chart/icon/navigation tokens. A colour changed in only one of those layers is incomplete work. Expo web is a useful preview, not iOS/Android acceptance. Test both actual native builds separately before release.

## CSS adoption example

```html
<section class="tw-ui" data-theme="light">
  <div class="tw-page">
    <header class="tw-page-header">
      <div><p class="tw-eyebrow">Bookings</p><h1 class="tw-page-title">Active orders</h1></div>
      <button class="tw-button" type="button">New quote</button>
    </header>
    <article class="tw-card">
      <h2 class="tw-section-title">Costs to review</h2>
      <p class="tw-body">Confirm the missing border charges before sending this quote.</p>
    </article>
  </div>
</section>
```

The CSS provides presentation, not accessibility behavior, data validation or authorization. Import it within an isolated component migration; do not replace the application's theme framework without a separate reviewed change. Avoid competing `.tw-ui` nested theme roots. Prefer existing components over copying markup into every page.

## Acceptance required in each UI PR

- Name the concrete problem and list every component/route affected; identify token changes and legacy exceptions.
- Compare the same content in light/dark at 320,390,768 and 1440px where applicable; test long names, large/negative monetary values and 200%zoom/text scaling. Record actual dimensions and evidence.
- Check normal, loading, successful empty, request error, validation error, disabled, busy, success and incomplete-data states. List unrun states explicitly.
- Exercise primary action, navigation, keyboard Tab/Enter/Space/Escape, focus visibility/return, last scrollable tab, modal footer and mobile keyboard/safe area.
- Check normal text contrast>=4.5:1, large text>=3:1 and essential control/focus graphical boundaries>=3:1 against adjacent colours; measure actual composed surfaces. Decorative borders may be subtler. These thresholds do not by themselves certify accessibility.
- Run appropriate type/build checks and targeted behavioral tests; no snapshot count or agent count as a substitute for judgment. Independent review must inspect the exact diff; visual acceptance must inspect rendered states.
- Do not declare full product readiness while critical financial/AI/security or native acceptance is open. Record regressions and unresolved cases in the existing repair state.

Reference accessibility requirements: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/). Standards must be checked against the implemented interaction, not simply linked in a PR.

## Ownership and change log

David owns product direction; Saif owns merge/release. Version 1.0.0 establishes explicit sentence case, type roles, semantic theme colours, opt-in CSS primitives, native mapping and acceptance rules. It intentionally distinguishes target rules from legacy runtime state. Changes to these rules require an explained versioned update and corresponding review, not a silent page-level exception.
