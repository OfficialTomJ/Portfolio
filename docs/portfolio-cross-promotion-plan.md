# Portfolio discovery and promotion plan

Updated 17 November 2026. Implemented and published to [staging](https://mentor.stage.thomas-johnston.com/) for owner review. Production is unchanged. See [staging review](portfolio-cross-promotion-staging-review.md).

## Agreed direction

Make Portfolio the first public destination in navigation and the main cross-promotion destination throughout the mentor site. Replace existing Journal promotions with Portfolio promotions.

Scope:

- Remove Journal links from shared navigation and active promotional placements.
- No contextual cross-links between Portfolio and Journal, in either direction. Do not add Portfolio banners to Journal/trade pages or a Journal link to Portfolio.
- Keep Portfolio's existing Substack links, with no new Blueprint/TJSS promotional block or footer product-link expansion.
- Deliver the navigation, promotion and member placements together.

Retain existing Journal URLs and historical records. Removing their public promotion does not require deleting data, changing results or redirecting Journal pages to Portfolio. Existing record-internal navigation and private administrative links are operational rather than promotional; retain them. The shared header change applies site-wide, including when an old Journal URL is opened directly.

## Review basis and implementation prerequisite

Live browser review covered `/`, `/portfolio`, `/performance`, `/blueprint`, `/dashboard`, `/sign-up` and `/start`; homepage and portfolio screenshots were inspected. The session was signed out. Recommendations for signed-in course, dashboard, account and completion views are based on local source inspection and require staging verification with a real member session.

Observed gaps:

- The homepage header and body promote Performance Journal, while Portfolio lacks an entry point there.
- The portfolio header shows Portfolio, Log in and Sign up free after session loading. Other public pages show Performance Journal instead. The navigation needs to be consistent.
- The course's Final section currently contains a Journal promotional tile.
- The footer contains copyright and legal links; it will retain that structure.
- `/dashboard` currently displays the Blueprint access gate to visitors. This work does not redesign that gate.
- `/start` returns 404 and an existing deferred plan proposes retiring it. Do not build promotional work around it.

Build on the launched portfolio implementation; do not enable preview/mock behavior to make production links appear.

The mentor host rewrites `/portfolio` to `src/app/mentor/portfolio/page.tsx`. The separate `src/app/portfolio/page.tsx` serves the apex personal/career portfolio. Internal mentor links use `/portfolio`; links from another host must use `https://mentor.thomas-johnston.com/portfolio`.

## 1. Shared navigation

Portfolio is the first named destination after the logo, with consistent order and labels across the site.

| State | Desktop navigation, in order | Account actions |
| --- | --- | --- |
| Visitor | **Portfolio** → `/portfolio`; **The Blueprint.** → `/`; **TJSS** → `/dashboard` | Log in; Sign up free |
| Member | **Portfolio** → `/portfolio`; **The Blueprint.** → `/blueprint`; **TJSS** → `/dashboard` | Account/avatar menu with settings and Sign out |

Use the site's existing visual language, with Portfolio first and the active destination marked using `aria-current="page"`. Use **TJSS** in the compact header and **TJSS Dashboard** in an expanded mobile menu. The logo continues to link home. Visitor access to TJSS keeps the existing account gate.

On mobile, keep the logo, a directly visible Portfolio link and Menu. Visitors also retain Sign up free where it fits; members retain their account/avatar. All remaining product/account links remain available in the menu. Check spacing at 320 and 375 pixels rather than hiding destinations. Menu behavior must support keyboard operation, Escape, focus return and expanded state.

Render stable public destinations while session state loads; authentication loading should affect account actions rather than remove the whole product navigation. Decouple production Portfolio visibility from mock/database preview switches. Remove the Journal link in both visitor and member branches, including mobile variants.

## 2. Homepage

### Hero

Keep the Blueprint headline and course explanation. Make Portfolio the first hero action:

- **View public portfolio** → `/portfolio`.
- **Start the free course** → `/sign-up` for visitors; **Continue your course** → `/blueprint` for members.

Use a filled treatment for Portfolio and an outlined treatment for the course action. Remove the duplicate hero Log in action; login remains in the header/menu. The header Sign up free action continues to serve account acquisition.

### Featured Portfolio card

Replace the existing Performance Journal promotional card with a dedicated Portfolio card, and move it immediately below the hero, before the curriculum. Match the site's container width and restrained visual language. Do not create a paired Portfolio/Journal section.

Proposed copy:

> **Public Portfolio**  
> Follow the portfolio and the thinking behind it.  
> Explore performance in USD and against Bitcoin, current allocation, and the ideas behind portfolio decisions.  
> **View public portfolio →**

Use descriptive content rather than copying a return percentage or chart into this card. This keeps it current and avoids another live-data dependency. Retain the course curriculum, members' TJSS card and course access content below it.

## 3. Course and member placements

| Page | Change | Placement |
| --- | --- | --- |
| Course `/blueprint` | Replace the existing Journal tile with a Public Portfolio tile. | In the **Final** section; match existing course-card dimensions and horizontal scrolling. |
| Final course episode | Add **Explore the public portfolio →** and one sentence explaining performance, allocation and ideas. | After lesson content and completion/learning actions. Identify the actual final episode from course data before coding. |
| Completed certificate | Add **Keep exploring: view the public portfolio →**. | Below certificate/share actions, outside the certificate artwork. Only show it for completed courses. |
| Member dashboard `/dashboard` | Add a compact Portfolio card. | After the research interface, before the closing disclosure; outside data controls. |

Compact card copy:

> **Explore my public portfolio**  
> View portfolio performance, current allocation and the ideas behind decisions.  
> **View portfolio →**

Keep Portfolio distinct from the TJSS model. Do not present portfolio returns as results of the course method or its historical simulation.

## 4. Remove Journal promotion

Replace or remove active public Journal entry points found during the implementation audit:

- Both authentication states and responsive variants in `AuthNav`.
- Homepage `PerformanceJournalCard` placement.
- Course Final-section `PerformanceJournalCard` placement.
- Additional public navigation, promotional cards or related-resource links to `/performance` or its archive/query variants in the deployed code.

Create a dedicated Portfolio promotion component with full, course-tile and compact variants. Do not repurpose a mode-dependent Journal card that could revert to Journal content in production.

Do not add a Portfolio CTA inside the Journal introduction, its community block or public trade-detail bodies. Do not add a Journal card or historical-record link to Portfolio. Existing Journal data, trade details and internal record navigation remain available at existing URLs. Private admin/review links remain usable.

## 5. Coverage and exclusions

The existing Portfolio page receives the shared navigation update only. Its chart, allocation, ideas, Substack CTAs and body layout stay focused on the portfolio. There is no new course/dashboard promotion there.

Sign-in, sign-up, verification, password reset, account settings, Discord connection/management, privacy, compliance and public certificate-verification pages receive the shared navigation only. No extra body banners.

Keep the existing footer layout and legal links. No new product-link row.

Do not rebuild `/start`, change Discord joining, redesign signup/auth, add paid products, delete historical records or alter the apex career site. The separate deferred plan for `/links` and Discord entry remains separate.

## 6. One-pass implementation and release

Complete the following as one coherent change:

1. Align implementation with the deployed source and inspect existing workspace changes.
2. Add consistent Portfolio-first visitor/member navigation and mobile behavior.
3. Update homepage hero actions and replace/move the Journal card.
4. Replace the course Final tile and add final-episode, completed-certificate and dashboard links.
5. Remove remaining public Journal promotional entry points and check the exclusions above.
6. Add placement measurement, complete responsive/member verification, and release together.

Likely implementation areas:

- `src/Components/AuthNav.tsx` and `src/app/mentor/layout.tsx`.
- `src/app/mentor/page.tsx`.
- A new reusable Portfolio promotion component; remove public dependencies on `PerformanceJournalCard` where replaced.
- `src/app/mentor/blueprint/page.tsx`.
- `src/app/mentor/blueprint/episode/[slug]/page.tsx`.
- `src/app/mentor/blueprint/certificate/page.tsx`.
- `src/app/mentor/dashboard/page.tsx`.
- `src/lib/track.ts` consumers for placement events.

Before writing application code, read the relevant installed Next.js guides under `node_modules/next/dist/docs/`, as required by `AGENTS.md`. Preserve unrelated workspace work.

## Measurement and acceptance

Track `portfolio_link_click` with a fixed placement value: `header`, `mobile_menu`, `home_hero`, `home_card`, `course_final`, `final_episode`, `course_completion` or `dashboard_related`. Reuse the existing analytics helper. Use event fields for internal attribution rather than UTMs; exclude personal identifiers and portfolio balances. No footer, Journal or reciprocal-resource events are needed.

Review clicks by placement, Portfolio visits/return visits, course signup and lesson continuation after two weeks. If comparing click-through rates, record impressions as well; raw clicks cannot establish placement effectiveness. Establish a baseline before setting numerical targets.

Acceptance checks:

- Portfolio is first and directly accessible in public/member navigation, including mobile.
- Active public product navigation and promotional placements contain no Journal links.
- No new contextual Portfolio ↔ Journal links or Portfolio → Blueprint/TJSS promotion have been introduced.
- The footer retains its existing structure.
- Portfolio works signed out without an account gate or preview flag.
- Visitor, pending-session, unverified and verified-member states show the correct navigation/actions.
- Homepage, course and dashboard links resolve to the mentor portfolio, not the career portfolio.
- Final-episode and certificate links appear only at the intended learning/completion points.
- Layouts fit at 320, 375, 768 and 1280 pixels without horizontal overflow; keyboard focus, current-page states and mobile menu operation work.
- Course progress, TJSS controls, existing Portfolio interactions, Substack links and historical Journal URLs still work.
- Tracking records the correct placement once per click.
- Run TypeScript, touched-file lint, a production build and focused navigation checks; add targeted interaction coverage if introducing a mobile menu. Verify member placements in staging with real authentication.

No application tests are needed for this documentation-only update. Resolve existing production/source metadata differences before release; preview/private pages must retain their intended crawler restrictions.
