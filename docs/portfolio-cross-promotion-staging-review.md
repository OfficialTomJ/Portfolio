# Portfolio discovery — staging review

Reviewed 17 November 2026. Staging uses the development database and real authentication. Production release is pending.

## Review links

- [Homepage](https://mentor.stage.thomas-johnston.com/): Portfolio-first navigation, primary hero action and featured card before the curriculum.
- [Portfolio](https://mentor.stage.thomas-johnston.com/portfolio): shared navigation; existing chart, allocation, ideas and Substack links.
- [Course](https://mentor.stage.thomas-johnston.com/blueprint): Portfolio tile in the Final section.
- [Final video](https://mentor.stage.thomas-johnston.com/blueprint/episode/lesson-13): related Portfolio card after the lesson/actions. The implementation resolves the final published video from season data rather than hardcoding this slug.
- [Certificate](https://mentor.stage.thomas-johnston.com/blueprint/certificate): onward Portfolio link for completed courses only.
- [TJSS](https://mentor.stage.thomas-johnston.com/dashboard): Portfolio card below the member research interface.

Use an existing verified staging account for member pages. Temporary QA accounts and their sessions, progress, disclosures and certificates were removed after testing.

## Navigation

The desktop course label is **The Blueprint.**; the mobile list uses **The Blueprint. (free course)**. Portfolio remains directly visible on mobile. The full-width menu unfolds from the navbar and closes on toggle, selection, outside tap, Escape, focus leaving the navigation, or switching to desktop. Closed links are inert; reduced-motion preferences disable the animation.

Journal links were removed from shared navigation and homepage/course promotion. Existing historical Journal URLs and their internal navigation remain available. No contextual links between Journal and Portfolio, footer product row or Portfolio-to-course/dashboard promotional block were added. Portfolio calculations, financial inputs and published records were not changed.

## Authentication

Login and signup capture the originating local page, query and anchor in a validated `returnTo` parameter. Email/password login, signup, verification/resend, Google existing/new-user callback state and switches between auth screens retain it. Verification links carry the destination across browsers without depending on original-tab storage. Account and password-reset entry points also retain their destination. Direct auth URLs without context fall back to `/blueprint`.

External URLs, encoded paths, auth loops and API destinations are rejected. Verification resend reports provider/network errors instead of always showing success.

## Validation

- Touched-file ESLint, TypeScript and production builds passed; the hosted preview reached READY.
- Six committed tests cover valid/invalid destinations, auth-screen transitions, email signup and cross-browser verification, password login/resend, and Google OAuth initiation state. Run `npx tsx --test src/lib/auth-return.test.ts`.
- Email tests capture messages in memory and send no real mail. Google initiation state is tested; a real Google provider exchange was not performed.
- HTTP checks passed for public Portfolio access and staging noindex, homepage hierarchy, direct historical Journal access, anonymous/unverified member gates, verified member cards, final-video placement and completion-only certificate links.
- Browser checks covered 320, 375, 768, 1280 and 1440px layouts, visitor/member navigation, menu dismissal and desktop account controls. No horizontal overflow or browser console errors were observed in the reviewed views.
- A real browser flow from Portfolio through signup → sign-in → password login returned to `/portfolio?year=2025#allocation`. Hosted API checks confirmed the same destination and `/account` return handling.
- Preview analytics IDs are empty so staging traffic does not enter production reports. Portfolio links retain fixed placement events through the existing analytics helper.

## Reviewed deployment

[Immutable preview](https://thomasjohnston-50tb1wn06-thomas-johnstons-projects-d78bf4d9.vercel.app), deployment `dpl_DPgtJ7G7sd91PEVcLLthk29YbW4t`.

The stable review alias is `mentor.stage.thomas-johnston.com`. Only staging was updated; no production deployment or database migration is included in this change.
