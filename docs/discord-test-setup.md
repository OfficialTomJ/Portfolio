# Finish the Discord test setup

The local MVP is implemented and enabled in test mode. Test server: `1556786037307613317`. Credentials are saved in the ignored `.env.local`. On 6 October 2026, live OAuth, delivered email codes, Verified assignment, test-segment enrollment, unlink/revocation, and reconnect passed. Three verification/management emails were sent to the approved inbox; no Mentor account was created. Automated tests mock external providers and send no email.

The bot is **Mentor Verification Test** (`1556793022421667880`); Verified is `1556795365913526338`. The test Resend segment is **Discord Community - Test** (`af3fb6f2-4f8a-405b-a229-3ec34e27ad3a`). The separate key **Discord Community Test - Contacts** manages contacts; the existing production sending key is unchanged. Existing contacts, segments, domains and keys were not deleted or edited. Resend contacts, logs and quotas are shared across the workspace; this inbox is enrolled only in the dedicated test segment.

Discord's role preview confirmed read-only onboarding for @everyone and visible member text/voice channels plus a working chat composer for Verified. An actual ordinary-member test, a second Discord account for replacement remain to be checked live; the user has since completed their own E2E and explicitly created their Mentor account. Localhost works only on this computer. Hosted test deployment and recovery setup are tracked in [the deployment runbook](./discord-deployment.md); the scheduler stays paused pending review.

## Latest hosted test — 6 October 2026

The shared read-only test `#verify-first` now has permanent Start verification and Check status buttons. Hosted OAuth, a delivered code, Verified assignment and an automatic private success reply passed. Successful replies show only Check status; the email link disappears. A fresh status click also passed. Public messages remained at two and website users at 28. The test connection is currently active with role/list jobs done; older unlinked/local-only status notes below describe earlier tests. All 47 Discord tests, TypeScript, touched-file lint and the hosted build passed.

Start from [the test Discord message](https://discord.com/channels/1556786037307613317/1556796471767081020/1556865921342247004). The recovery scheduler remains paused. An ordinary-member permission test and second-account replacement remain live acceptance checks. Only the test server is configured; the owner will perform the next real-server test after explicitly requesting its preparation. See [deployment details](./discord-deployment.md).

## Your own E2E test before any real-server pilot

The user must have a chance to test this MVP personally before any test or configuration change in the real Discord server. Keep the local pilot enabled and scoped to the test server/inbox. The current test Discord has Verified independently of its email link: only the owner was recorded as a trusted existing member in this test server. The live signed-in unlink test passed without email; the connection is currently unlinked.

1. Open http://localhost:3000/discord/manage while signed in. The connection currently shows unlinked; linking again in step 2 lets you repeat the direct Unlink Discord test without receiving another management email. Because this test Discord is recorded as an existing member, Verified must remain after unlink. Your Resend contact must also remain. In a signed-out browser, management still requires a fresh email code.
2. Open http://localhost:3000/discord/verify in a fresh browser window. Connect the intended Discord, enter the same approved email, and send a code. The page should show the email-list notice and no account/password creation.
3. Try one wrong six-digit code, then the correct code. The wrong code must not activate access; the correct code should add Verified. Refresh and confirm the result remains successful with one Resend contact.
4. For the permission gate, use Discord's View Server as Role: @everyone should see only read-only onboarding; Verified should reveal member text/voice channels. An actual non-admin member is still the strongest final acceptance check.
5. Your own explicit Mentor signup has already been completed. Confirm the profile displays the connection after relinking; verification alone must never create a Mentor account. An ordinary member outside the trusted roster still loses Verified when unlinked.

Only `thomas.johnston246@gmail.com` is currently allowed to receive pilot codes. Local limits permit five community emails per address per UTC hour. Signed-in unlink uses no email; anonymous management and linking use codes. Resend's existing shared daily quota also applies. Resend a new code only if needed. Mobile/remote E2E testing needs staging first; localhost refers to the device opening the link.

## 1. Create and install the test bot

Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application named **Mentor Verification Test**.

- **General Information:** copy Application ID into `DISCORD_CLIENT_ID`.
- **OAuth2:** copy the client secret into `DISCORD_CLIENT_SECRET`. Add the exact redirect `http://localhost:3000/api/discord/connect/callback`.
- **Bot:** generate its token and save it as `DISCORD_BOT_TOKEN`. No privileged intents or Gateway process are needed for this REST-based MVP.
- **Installation / OAuth2 URL Generator:** select server installation, the `bot` scope, and **Manage Roles** only. Open the generated install link and select the test server. Do not grant Administrator.

Keep tokens and client secrets in `.env.local`, never in chat, screenshots, browser URLs, or `NEXT_PUBLIC_*` variables.

## 2. Configure the test server

Create a regular **Verified** role with no moderation or administrative permissions. Move the bot's role above it. Copy its role ID to `DISCORD_VERIFIED_ROLE_ID` using Developer Mode.

Create public read-only `#welcome` and `#verify` channels. For `@everyone`, allow viewing/history but deny sending, reactions, and thread creation/participation in onboarding. Create a private member category: deny `@everyone` **View Channel**, allow **Verified** to view and participate. Check voice connect/speak and thread/forum permissions if used. Confirm other auto-assigned roles cannot bypass this gate.

The pilot invite is configured in `DISCORD_INVITE_URL` (24 hours, 10 uses). Instructions are posted in test `#verify`; renew the invite for later testing. The onboarding copy is:

> To join the conversation, open http://localhost:3000/discord/verify on the computer running the test site. Connect Discord and verify your email code. Verification joins the community email list and does not create a Mentor account.

Localhost is for a pilot on the same computer. For other testers/mobile devices, deploy to staging and register/configure its exact HTTPS callback instead.

Use an ordinary member account for permission testing. A server owner/admin bypasses restrictions, so your owner account alone cannot prove the gate works.

## 3. Finish Resend setup

In your [Resend dashboard](https://resend.com/segments), create **Discord Community - Test** and save its ID as `RESEND_COMMUNITY_SEGMENT_ID`. Keep broadcasts and contact-triggered automations off during the pilot.

Create a separate **Full access** key for contact management and save it as `RESEND_CONTACTS_API_KEY`. Keep your existing send-only `RESEND_API_KEY`; its inability to read/manage contacts explains the earlier error even though email sending works.

Set `EMAIL_FROM` to an address on your verified sender domain, for example `The Blueprint <noreply@your-verified-domain>`. This is required; the MVP does not silently use the shared development sender.

## 4. Check, enable, and run

The project expects Node 24. Keep the development database configured as `blueprint_dev`.

```bash
npm run community:check
npm run community:check -- --live
npm run community:test:mongo
```

The live setup check only reads bot identity, membership, role hierarchy, and the Resend segment. It does not send email, change roles, or add contacts. It cannot prove inbox delivery, OAuth portal settings, or channel restrictions.

After setup checks pass, set `COMMUNITY_VERIFICATION_ENABLED="true"` in `.env.local`, then restart the application:

```bash
DEV_REAL_AUTH=1 npm run dev
```

Open [the verification page](http://localhost:3000/discord/verify). Connect your test Discord, send a code to the configured inbox, enter it, and confirm **Verified** appears and the contact is in the test Resend segment. Check the Mentor account/profile is still inaccessible unless you explicitly sign up and verify its separate website email.

Use [connection management](http://localhost:3000/discord/manage) to test unlinking. Ordinary members lose old access before linking a replacement. Recorded existing members retain access independently of a link. A new Discord identity does not inherit that trusted status. Only an explicit website signup and verified email can claim a community contact.

For delayed jobs, run `npm run community:process`. It recovers incomplete enrollment and processes up to three due contacts per run, with status counts and redacted failure messages. The protected `/api/discord/process` endpoint uses a dedicated `COMMUNITY_PROCESS_SECRET` plus matching environment/guild headers. GET is read-only health; POST runs recovery. A paused GitHub Actions workflow is implemented for independent recovery; see [deployment and activation](./discord-deployment.md).

For the full acceptance matrix and production limitations, see [the MVP runbook](./discord-verification-mvp.md).

All five branded email previews are available at http://localhost:8766/index.html. Review these before PRs and any real-server pilot. The existing-member migration command and direct-unlink behavior are documented in the MVP runbook.
