# Real-server Discord pilot — draft

The real server is `907092260632535040`. The owner authorized and created an empty Verified role (`1556860074905837639`). Bot installation, channel permission changes, contact enrollment, and migration remain pending. The current change is tested only in server `1556786037307613317`.

The agreed onboarding is a shared read-only `#verify-first` channel with one permanent bot message and private Start verification / Check status replies. No public per-join announcements or verification status posts. The owner's Discord can be used for the role integration pilot; an ordinary member is still needed to prove actual channel gating. See [the entrypoint plan](./discord-verification-plan.md#confirmed-entrypoint-shared-channel-private-responses).

The latest instruction is test-server work only. Do not install/configure the bot or test in the real server yet. The owner will perform the next real-server E2E; preparation waits for their explicit go-ahead.

## Pilot boundary

Start with one controlled ordinary member and a private pilot category. Keep the community's existing channel access unchanged during this check. This tests the actual Discord server's screening/auto-role integrations without forcing every member through an unfinished rollout.

Before this pilot, finish the separate test deployment, give the owner their hosted E2E opportunity, and activate/observe the reviewed recovery workflow. Email branding can be completed separately before opening verification publicly.

## Prepare a concrete change set

1. Read and save the real server's relevant roles, role hierarchy, screening settings, channel/category overwrites, and auto-role behavior. List exactly which pilot channels will be changed and save their original permissions for rollback.
2. Choose/install the production bot with Manage Roles only, below staff and above a regular Verified role. Do not grant moderation or Administrator. Confirm which bot/application and role will be used before writing production configuration.
3. Create a dedicated production Resend community segment. Keep the test segment and production email sending setup separate; leave broadcasts/automations untouched. Use the same unsubscribe-preserving contact behavior.
4. Prepare a deployment on the existing Mentor domain with the real-server configuration and exact registered callback. A Vercel preview must remain test-only. Keep sending restricted to the controlled pilot inboxes until the pilot is accepted.
5. Point the dedicated recovery workflow at that reviewed deployment with matching environment/guild and its own secret. Disable the old target before switching. Check the authenticated health response confirms the real server before processing.

These are future actions requiring the owner's go-ahead for the real-server pilot; nothing in this plan authorizes changing the live server today.

## Acceptance test

- Join with an ordinary non-admin Discord account. Complete Rules Screening if enabled. Verify it cannot view/participate in the pilot member area, including text, reactions, thread/forum participation, and voice where applicable.
- Connect that Discord on the site, verify a controlled email, and confirm Verified unlocks the pilot area. Confirm one contact is added only to the production community segment and no website account is automatically created.
- Close the browser with a pending job during a controlled pilot-only provider failure. Restore the test condition and confirm scheduled recovery completes activation without another email code or browser visit. Do not remove bot permissions affecting unrelated members.
- Unlink as an ordinary new member: Verified is removed; reverification restores it. Test replacement with a second controlled Discord account if available.
- Record one controlled existing member as trusted using the reviewed roster procedure. Confirm they can access the pilot area without an email/account and retain access after optional linking/unlinking.
- Check the current integrations do not auto-grant a different role that bypasses the gate. Existing auto-grants of Verified would bypass email verification for new joiners and must be addressed in the reviewed rollout change set.

## Existing-member rollout after acceptance

Create and review a snapshot of current eligible human member IDs, excluding bots and pending screening. Record and grant Verified to that approved snapshot **before** changing the community-wide gate. Retry failed grants and reconcile every eligible member; grant failures must not leave existing members blocked. The roster creates no email contacts or website accounts. Linking remains optional and trusted access survives unlinking.

Then apply the reviewed category/channel overwrites and publish the verification link for new joiners. Future joiners are not added to the trusted snapshot. Check every intended member category and each exception channel: another role can override a category deny, and an administrator bypasses these checks.

## Pause and rollback

For a failed pilot, pause recovery/verification on its target, restore the saved pilot permissions, and leave existing community access unchanged. For a failed wider rollout, restore the saved member-channel permissions before troubleshooting. Do not delete mailing contacts or trust records as rollback. Restore the previous reviewed deployment/configuration if the application is the fault.

Pilot decisions still needed: production bot/application, Verified role, controlled non-admin tester and approved inboxes, exact pilot category/channels, and whether screening or existing auto-role integrations are active. Gather these together when the owner is ready for the real-server pilot.
