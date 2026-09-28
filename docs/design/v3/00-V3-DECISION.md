# Design v3: decision pack

Owner review, 28 September 2026: "doesn't look world class, looks babyish", "far too much text", Insights "horrific", vehicle and driver should be one page. This pack consolidates three builders and three independent critics (visual, UX, data and copy). Full critiques in this folder: `01-VISUAL.md`, `02-UX.md`, `03-DATA-COPY.md`.

## Where it stands

| | Score vs the owner's references |
|---|---|
| Product average before v3 | about 5.3 / 10 |
| Pages rebuilt in v3 (shell, Today, Insights, vehicle and driver) | about 6.5 / 10 when critiqued mid-rebuild; since finished |
| Legacy list, form, settings and admin pages | about 5.0 / 10 |

Built on branch `truckwys/design-v3`: labelled grouped sidebar with a 5-tab + More phone bar, Today page, Insights as a ranked findings feed, single-page vehicle and driver.

## The v3 visual spec (conflicts resolved)

The design lead and the visual critic disagreed in five places. Recommended resolution, each chosen to match the owner's references and remove the "babyish" read:

| Decision | Lead built | Critic proposed | Resolution |
|---|---|---|---|
| Primary buttons | Blue | Near-black (light) / near-white (dark), as Close and Vantage | **Near-black / near-white.** Blue is kept for data, links, focus and one emphasis per screen. |
| Corner radius | Cards 16, controls 10, chips 8, dialogs 20 | 12 / 8 / 6 / 16 | **12 / 8 / 6 / 16.** Larger radii read soft and junior. |
| Weights | 700 titles and figures | 400 / 500 / 600 only | **600 maximum**, titles 28px/600, figures tabular 32px/600, one hero figure 40px. |
| Identifiers | Monospace | Tabular sans | **Tabular sans.** Monospace on every ID reads like developer tooling. |
| Status chips | Tinted fills | Neutral chip with a coloured dot | **Neutral chip with a coloured dot and a label.** |

Also fixed at token level: input borders to 3:1 (`#858C96` light, `#636A76` dark), success is green not blue, a designed dark theme (no glowing emphasis tile; the emphasis tile in dark uses a raised surface with an accent figure), notification badge and workspace monogram contrast, one radius scale everywhere (11 are live today).

## Behaviour fixes (higher priority than styling)

1. **Honest error states everywhere.** Lists that fail must show "Couldn't load" with Retry, never an endless spinner, "No quotes" or R 0,00. No raw JavaScript errors.
2. **Quote builder shows one price.** Today the total (R 11 159) and the suggested price (R 13 949) differ and Send uses the lower one unless Apply is pressed. One price, visible next to Send, with the recommendation as a clearly labelled option. Two-column layout with a sticky price panel; usable on a phone.
3. **Chasing a late invoice works.** One definition of overdue (the list filter shows 3, the card says 22). Remind any unpaid invoice past due, including Sent and part-paid. Every outgoing message gets a preview and confirm.
4. **Keyboard and phone.** Skip link, focusable table rows, focus trapped in drawers, focus rings on selects and dates; Settings and the quote builder usable at 390.
5. **Settings sessions list** paginated, not 150 rows with a red Revoke on each.

## Words

Roughly 40% of non-data text can go. Titles become 2 to 6 word labels (not questions), subtitles one line, methodology behind info icons, and pages stop explaining their own data limits (that problem disappears once the backend returns complete lists). The data and copy critique has the exact rewrite for every title and subtitle.

## Numbers that disagree (needs backend Wave 0)

Owed to you, cash received, margin, active loads and fleet size show different values on different pages. True values from reading every record: owed R 542 140, received R 205 053, margin 23.7%, active loads 11, vehicles 23. Fix: one server-side definition per metric and list endpoints that return complete results.

## Rollout plan once the spec is approved

1. Apply the resolved tokens (one theme change reaches every page).
2. Behaviour fixes 1 to 5 above.
3. Roll the v3 page pattern to every remaining page (Quotes and loads, Get paid, Reports, Customers, Fleet lists, Settings, Admin, auth, public pages) with the copy rewrites.
4. Re-run all three critics; target 8 / 10 or better on every page in both themes before the PR.

## Decisions for the owner

1. Approve the resolved spec (near-black primary buttons, 12px cards, tabular sans IDs, neutral dot chips).
2. Approve the behaviour fixes, especially the quote builder showing one price.
3. Approve backend Wave 0 so the numbers agree.
