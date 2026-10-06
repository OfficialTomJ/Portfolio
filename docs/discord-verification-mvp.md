# Discord verification MVP — setup, build, and test

Updated 6 October 2026. The local MVP is implemented: verification and management pages, Discord OAuth/REST integration, email codes, durable contact/jobs, profile claiming, recovery processor, and setup checks. Automated tests use isolated development MongoDB collections and mocked external providers, so no live emails, subscribers, roles, or permissions are changed by them. Live OAuth, delivered codes, role assignment, test-list enrollment, unlink and reconnect passed. Start with [the short test setup guide](./discord-test-setup.md).

The test server `1556786037307613317`, bot/application `1556793022421667880`, Verified role `1556795365913526338`, test invite, local callback, approved inbox, secrets, sender and test segment are configured locally. Verification is enabled only in local test mode. The bot has Manage Roles without Administrator and sits above Verified. Public onboarding denies participation; member text/voice channels inherit a private category requiring Verified.

## Latest hosted test — 6 October 2026

The shared read-only test `#verify-first` now has permanent Start verification and Check status buttons. Hosted OAuth, a delivered code, Verified assignment and an automatic private success reply passed. Successful replies show only Check status; the email link disappears. A fresh status click also passed. Public messages remained at two and website users at 28. The test connection is currently active with role/list jobs done; older unlinked/local-only status notes below describe earlier tests. All 47 Discord tests, TypeScript, touched-file lint and the hosted build passed.

Start from [the test Discord message](https://discord.com/channels/1556786037307613317/1556796471767081020/1556865921342247004). The recovery scheduler remains paused. An ordinary-member permission test and second-account replacement remain live acceptance checks. Only the test server is configured; the owner will perform the next real-server test after explicitly requesting its preparation. See [deployment details](./discord-deployment.md).

## Confirmed MVP behavior

Discord join → read-only onboarding → Mentor verification page → authorize Discord → enter email → verify code → save community contact → assign `Verified` → add to Resend community segment.

Community-list enrollment is part of entry, with a visible notice and no optional checkbox. No Mentor account is created. Later signup using the same email attaches the contact/Discord connection only after website email verification. Existing unsubscribe status survives retries and reverification.

## 1. Set up the test environment

### Resend

1. Use **Discord Community - Test** (`af3fb6f2-4f8a-405b-a229-3ec34e27ad3a`) for the pilot. A production community segment has not been created. The current Contacts/Segments model replaces the legacy Audiences API. See [Managing Segments](https://resend.com/docs/dashboard/contacts/manage-segments).
2. Confirm the sender domain is verified and set an explicit `EMAIL_FROM` using that domain. The shared `onboarding@resend.dev` sender is restricted to test recipients and must not be relied on for public verification.
3. Keep the existing send-only key for emails. Configure a separate server-side key with Resend's Full access permission for Contacts/Segments, and store it as `RESEND_CONTACTS_API_KEY`. Resend currently distinguishes Full access from Sending access; the send-only key cannot call contact-management APIs. Keep keys in `.env.local` and deployment secrets, never in chat or client-side variables. See [Resend API-key permissions](https://resend.com/docs/dashboard/api-keys/introduction).
4. Store the test segment ID in the local/staging environment. Use only addresses controlled by the tester. Do not use an existing real subscriber to test unsubscribing: contacts and global unsubscribe status span all segments.
5. Leave Broadcasts and contact-triggered Automations off for the pilot. Adding a contact should not start unsolicited test mail.

Read-only investigation result: the original sending key returned HTTP 401 with `restricted_api_key`: “This API key is restricted to only send emails.” This was a Segments permission restriction, not failed email sending. The original key was retained. With explicit user approval, a separate Full access key **Discord Community Test - Contacts** was created and saved locally. `EMAIL_FROM` uses the verified domain: `The Blueprint <noreply@thomas-johnston.com>`. No Resend automations were present. One new contact was created only in the test segment, and reverification reused it. Existing production keys, segments, contacts and domains were not edited or deleted. Full access is workspace-wide; segments separate membership but do not isolate global contacts, unsubscribe state, logs or quotas.

### Discord

1. Confirmed choice: use a new bot and the separate test server already created (`1556786037307613317`). Configure `#welcome`, `#verify`, and a member-only text channel. Add a voice channel if the live community uses voice.
2. Create a Discord application and bot in the [Developer Portal](https://discord.com/developers/applications). Configure it for server installation, not user installation.
3. Create the `Verified` role. Give the bot `Manage Roles`, place its role above `Verified`, and keep staff roles above the bot. Do not grant Administrator. See [Discord permission hierarchy](https://docs.discord.com/developers/topics/permissions).
4. Configure onboarding as read-only for `@everyone` and the member channels for `Verified`. Make sure another auto-assigned role cannot grant access around this gate.
5. Install the bot in the test server. No Gateway process or message-reading intent is required for identity checks and role operations through REST. See [Discord guild APIs](https://docs.discord.com/developers/resources/guild).
6. Enable Developer Mode in Discord and copy the server ID and `Verified` role ID.
7. Register an exact OAuth redirect URL. Proposed local URL: `http://localhost:3000/api/discord/connect/callback`. Proposed staging URL: `https://mentor.stage.thomas-johnston.com/api/discord/connect/callback`. The registered URL must match the configured one exactly.
8. Use an ordinary non-admin Discord member for acceptance testing. The server owner/admin can bypass restrictions and is not a valid test of the gate.

All pilot credentials are configured. Test mode rejects the known production guild ID and restricts code sending to the approved inbox allowlist. For staging, use test credentials/roles. Do not point arbitrary branch previews at the production guild.

### Application configuration

Keep the existing MongoDB development database. Variables are documented in `.env.local.example`; fill the missing values in `.env.local`. Leave verification disabled until setup checks pass:

```dotenv
COMMUNITY_VERIFICATION_ENABLED="false"
COMMUNITY_ENV="test"
COMMUNITY_VERIFICATION_SECRET="<random server-side secret>"
COMMUNITY_TEST_RECIPIENTS="<approved test inbox>"
DISCORD_CLIENT_ID="<test application ID>"
DISCORD_CLIENT_SECRET="<test application secret>"
DISCORD_BOT_TOKEN="<test bot token>"
DISCORD_GUILD_ID="1556786037307613317"
DISCORD_VERIFIED_ROLE_ID="<test Verified role ID>"
DISCORD_REDIRECT_URI="http://localhost:3000/api/discord/connect/callback"
DISCORD_INVITE_URL="<test server invite>"
RESEND_CONTACTS_API_KEY="<contact-management key>"
RESEND_COMMUNITY_SEGMENT_ID="<test segment ID>"
EMAIL_FROM="The Blueprint <verified-sender@your-domain>"
COMMUNITY_PRODUCTION_GUILD_ID="907092260632535040"
COMMUNITY_PROCESS_SECRET="<dedicated recovery bearer secret; at least 32 characters>"
```

For local authentication tests, set the existing `DEV_REAL_AUTH=1` so the repository's synthetic verified user does not bypass website gates. Use `DEV_AS_MENTOR=1` to serve Mentor on plain localhost. Do not use synthetic sessions in the new community authorization paths.

## 2. Build in three vertical slices

All three core slices below are implemented. The MVP uses `communityTestContacts`, `communityTestVerificationFlows`, `communityTestLimits`, `communityTestWorkerState`, and IDs-only `communityTestTrustedMembers` in test mode; production uses the equivalent `community*` names. Contact records embed role/list jobs and connection history. Browser proof expires in 30 minutes. The worker can recover verified enrollment whose contact write was interrupted; those records are retained until resolved, then expire normally. Codes are consumed once and guess attempts reserved atomically before comparison.

Implemented interfaces:

- `GET /api/discord/verification`: cookie-bound status; no caching.
- `POST /api/discord/verification`: validated `start`, `send`, `confirm`, `retry`, and `disconnect` actions; exact Origin check; opaque HttpOnly browser cookie.
- `GET /api/discord/connect/callback`: single-use browser/state-bound OAuth callback; identify scope only.
- `GET /api/discord/profile`: real verified Better Auth session required; claims a matching contact and returns status.
- `POST /api/discord/profile`: same-origin, real verified Better Auth session required; direct `disconnect` or `retry` of the account-owned contact without another email code.
- `GET /api/discord/process`: dedicated `COMMUNITY_PROCESS_SECRET` bearer and matching environment/guild headers required; read-only worker health.
- `POST /api/discord/process`: same authentication/target checks; recovers enrollment and processes up to three due contacts within the hosting budget.
- `npm run community:process`: local recovery with the same worker lease/budget and redacted job summary. A paused GitHub Actions scheduler is implemented; activation is documented in [the deployment runbook](./discord-deployment.md).

Linking still proves the selected Discord and email with a code. Signed-in, email-verified website users unlink directly from the profile or `/discord/manage`; no additional email is sent. Anonymous connection management still requires a fresh email code. The website verification hook claims contacts after explicit website email verification; the profile reconciles verified Google/existing accounts. Email changes do not silently merge community contacts: the profile keeps the original claimed connection and shows its management email. Contact email migration, admin block/delete UI, funnel analytics, and automatic rejoin restoration are outside the pilot and remain production follow-up work. Operator visibility includes the CLI job summary and authenticated worker health, with workflow failures once scheduling is activated.

### A. Prove identities and save the contact

- Build `/discord/verify` in the Mentor route group, with a mobile-friendly staged form and visible mailing-list notice.
- Implement Discord OAuth state/browser binding, token exchange, membership check, and selected-account confirmation.
- Implement six-digit flow-bound email codes with keyed hashes, five-minute expiry, three attempts, 60-second resend cooldown, and distributed email/Discord/IP limits. Reuse Resend sending while handling its returned errors and missing production configuration explicitly.
- Atomically persist a verified community contact and desired role/list-sync operations. Do not write Better Auth user records.
- Add a short-lived scoped community session for status/retry and email-based connection management. It must not grant site membership.

Acceptance: the flow proves control of both identities, creates no website user/session, and has repeatable validation tests.

### B. Activate Discord and sync the list

- Add a server-side Discord adapter and idempotent role assignment/removal.
- Record jobs before attempting external APIs; use leases, retries, and current connection-generation checks.
- Show actual role progress. List-sync success and role success are distinct; an unavailable contact API should not lock out someone whose identities are verified.
- Get an existing Resend contact before creating one, preserve global unsubscribe state, and add it to the configured segment. Do not duplicate or resubscribe existing contacts.
- Add operator visibility for failed role/list jobs and a protected processor. For the pilot, allow a local worker and explicit status retry; production also needs independent recovery of abandoned jobs.

Acceptance: real role assignment and Resend segment membership work, failed requests can recover without another code, and repeat verification creates no duplicate contacts.

### C. Manage the connection and claim it later

- Add limited email-code management for contacts without website accounts.
- Add authenticated connection status/link/unlink/replace to the website profile.
- Remove old access before granting a replacement, except for members in the reviewed existing-member roster; persist transition state across API failures. Existing-member access is independent of email linking.
- On verified website signup/login, claim a matching unclaimed community contact idempotently; preserve Discord/list/moderation history. An unverified signup must not claim it.
- Update privacy copy and expose role/list failures through the operator CLI. A separate admin management UI remains outside the pilot.

Acceptance: profile management and later signup work without weakening either the community identity boundary or existing website authentication.

Do not postpone expiry checks, attempt limits, uniqueness, reliable retries, or account separation until after the pilot: they define whether verification works correctly.

## 3. Test without spending the email quota

Use the repository's existing Node/tsx test approach. Add a dedicated community test script with the implementation. Test orchestration using injected Discord, email, Resend-contact, and storage adapters. Also run MongoDB integration tests against an isolated development test namespace/database; mock tests alone do not prove unique indexes, atomic code use, or concurrent job leasing.

Implemented commands: `npm run community:test` runs provider/security tests without network calls; `npm run community:test:mongo` also runs the workflow suite against random disposable collections in `blueprint_dev`, dropping only those owned collections at completion. External email/Discord/list calls remain mocked. `npm run community:check -- --live` is a separate read-only setup check; actual inbox/OAuth/channel-permission tests below still require the real pilot.

| Case | What must be true |
| --- | --- |
| Correct code | One verified community contact; no Better Auth user/session created. |
| Wrong/expired/replayed code | No role or mailing enrollment; consumed/expired codes cannot work again. |
| Concurrent confirmation | One contact and one logical grant/list operation; no double consumption. |
| Resend send error / quota exhausted | Honest retry message; no false “code sent”, role grant, or subscription. |
| Repeated send / resend attempt reset | Cooldown and cumulative guess/send limits hold across servers and browsers. |
| Changed cookie/state/email/Discord | The wrong flow cannot authorize another connection. |
| Non-member / rules screening pending | No `Verified` grant; clear join/screening instruction. |
| Duplicate email or Discord | Existing connection cannot be stolen; conflict contains no private email. |
| Discord 429 / network timeout | Retry respects provider timing and survives request termination. |
| Resend contact API unavailable | Community access succeeds if otherwise eligible; durable sync remains pending. |
| Existing unsubscribed contact | Remains unsubscribed after verification and retry. |
| Unlink/replace with delayed jobs | Ordinary old account loses access; a stale grant cannot restore it. Recorded existing members keep Verified independently of linking. |
| Signed-in unlink | Real verified account session owns the contact; no email is sent, and another account cannot unlink it. |
| Existing-member roster | Granting access creates no email contact/account. Trusted access survives either unlink path. Failed roster lookup never removes the role. |
| Later website signup | No claim before website email verification; afterward the original contact/Discord is attached once. |
| Real-auth gates | Community-only proof cannot access protected course/dashboard/account routes. |
| Preview/staging configuration | Cannot mutate production guild or contacts accidentally. |

Run targeted tests, TypeScript, lint for touched files, and the Next.js build. Diagnose failures against the pre-change baseline rather than treating existing unrelated failures as caused by this feature.

## 4. Run the real pilot

Use a staging deployment or localhost with the registered callback, the test guild, the development database, and the test segment. Keep real sends small: one successful flow, one resend, one management code, and the emails needed to test later website signup. Use Resend's documented [test addresses](https://resend.com/docs/dashboard/emails/send-test-emails) for simulated sending failures; inbox-code acceptance needs an address the tester can actually read.

1. Join as an ordinary Discord member. Confirm text, reactions, thread/forum participation, and voice are blocked before verification, as applicable.
2. Open the verification page on mobile and desktop. Authorize the correct Discord identity and request one email code.
3. Enter the code. Confirm the member receives `Verified`, can participate, and appears once in the Resend test segment.
4. Confirm no Mentor user was auto-created and the visitor still cannot access member-only website features.
5. Refresh/retry the completed flow. Confirm no extra role grants, duplicate contacts, or unexpected emails.
6. Temporarily remove the test bot's role permission. Confirm a new verified test flow shows pending/failure accurately. Restore permission and process the saved job; it must recover without another code.
7. Unsubscribe the dedicated test contact in Resend, then reverify. Confirm its unsubscribe persists while Discord access still works. This does not require sending a marketing Broadcast.
8. Sign up on Mentor with the same email. Before website email verification, the contact remains unclaimed; afterward the profile displays the original Discord connection.
9. Unlink and replace with a second controlled Discord account. Confirm access moves, and pending old jobs cannot restore the old account.
10. Repeat with actual Rules Screening and all server auto-role integrations enabled before rolling into the real community.

## 5. Launch only after the pilot passes

The user requested their own E2E test before any pilot in the real server. Do not configure, enable, or test this feature in the production guild until they have had that chance and explicitly ask to proceed. The personal test steps are in [the test setup guide](./discord-test-setup.md).

Use production-specific Discord IDs/credentials, the production community segment, production callback, and verified sender. Enable the verification link for new members first; use the reviewed existing-member procedure below before requiring verification for new joiners. Keep the feature pausable and show an honest unavailable message rather than opening community permissions when providers fail.

The 100/day transactional cap is accepted for MVP. It counts code sends/resends and existing website verification/reset emails together and resets at midnight UTC. Do not automatically upgrade or enable paid overages. The free marketing quota is separate and currently supports up to 1,000 contacts; check the actual account's allowance as the list grows. See [Resend account quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

Confirm hosting before scheduling retries. Vercel Hobby cron currently runs at most daily, whereas Pro permits minute intervals. Use an appropriate durable worker/queue or scheduler if Hobby is the deployment plan; do not promise minute-by-minute recovery from a daily cron. See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Live pilot result and remaining checks

Local validation completed on 6 October 2026: all 37 provider/security/Mongo workflow and account-email tests passed; TypeScript, ESLint for touched source files, and the optimized Next.js build passed. Browser/HTTP checks confirmed both pages render, disabled verification returns an honest 503, and anonymous profile/processor calls return 401.

The live pilot used identify-only OAuth for the server owner's Discord. Resend reported three delivered emails (connect, management, reconnect), all to the approved inbox. Verification added Verified and created one contact in only **Discord Community - Test**. Unlinking removed Verified and preserved the Resend contact and subscription state; a fresh connect/email proof restored access. Website user count stayed at 28 throughout, and the anonymous profile endpoint remained 401. No website account or session was created. That first pilot ended active, with role/list jobs both done. The pre-existing General segment remains empty and unchanged.

Discord's **View Server as Role** preview confirmed that @everyone sees only #welcome and #verify, with sending disabled. Selecting Verified revealed member #general and General voice, and #general had an enabled message composer. The preview was disabled afterward. Instructions are posted in test #verify. This proves the configured role views; an actual ordinary-member join/voice/interaction test and replacement with a different Discord account remain live acceptance work. These checks were local. The subsequent test deployment and paused recovery scheduler are documented in [the deployment runbook](./discord-deployment.md).

- An ordinary non-admin Discord member controlled by the tester, with before/after text, threads/reactions and voice checks.
- A second controlled Discord account for live replacement. The user subsequently completed their own E2E and explicitly signed up; no website account was automatically created by verification.
- Live provider-outage recovery and preserved-unsubscribe acceptance using only disposable test data.
- Activate and observe the reviewed recovery workflow before production recovery is enabled; the current GitHub Actions choice supports the existing hosting plan.

These are configuration inputs for live tests, not another approval to write the MVP. Application code and automated tests can be built while the external setup is completed.

## Existing members: access without linking

Existing members can receive Verified without supplying an email or creating a website account. Their Discord IDs are stored in a guild-scoped trusted roster, separate from community contacts. Optional linking follows the normal identity proof, while unlinking preserves their community role. A replacement Discord does not inherit trusted status from the old one. New members are never trusted merely because they already have Verified.

Before changing the real community's gate, review a snapshot of eligible existing human member IDs. Do not include bots or members still pending Rules Screening. The operator script requires that reviewed JSON array; it does not automatically collect future joiners.

```bash
npm run community:grandfather -- --members /absolute/path/reviewed-members.json
npm run community:grandfather -- --members /absolute/path/reviewed-members.json --apply --confirm-guild CONFIGURED_GUILD_ID
```

The first command is a dry run. All listed members are validated before changes; the apply command records each trusted ID before granting Verified and can be rerun after partial failure. No email, Resend contact, or website user is created. It uses the configured environment's collections and rejects the production guild in test mode. The real-server roster has not been applied.

The follow-up live test recorded only the test-server owner's Discord as trusted. Signed-in unlink completed with no email, the contact became unlinked, and Verified remained. The user's own test Mentor account was created by their explicit signup. The current test connection is unlinked and can be relinked for their next E2E.

## Discord transactional emails

Discord verification and anonymous connection-management emails use the black/orange HTML renderer in `src/lib/email-brand.ts` and templates in `src/lib/community/email.ts`. Both include plain text, escape dynamic values and preserve action URLs. Signed-in unlink sends no email. Discord-only HTML/text review samples are saved in `docs/email-previews/discord-verification.*` and `discord-management.*`. Provider payload and escaping checks run with `npm run community:test`. General account-email rebranding is outside this feature branch.
