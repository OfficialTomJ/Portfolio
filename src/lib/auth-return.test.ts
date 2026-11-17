import assert from "node:assert/strict";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { authHref, authReturnFromLocation, DEFAULT_AUTH_RETURN, safeAuthReturn } from "./auth-return";

test("keeps the originating page, query and anchor while cleaning host rewrites", () => {
  for (const path of ["/", "/portfolio?year=2025#allocation", "/dashboard?start=2025-01-01", "/blueprint/episode/lesson-13", "/account", "/admin/portfolio"]) {
    assert.equal(safeAuthReturn(path), path);
  }
  assert.equal(safeAuthReturn("/mentor/portfolio?year=2025#allocation"), "/portfolio?year=2025#allocation");
});

test("rejects external redirects, encoded paths, auth loops and API destinations", () => {
  for (const path of [null, undefined, "", "https://example.com/", "//example.com", "/\\example.com", "/%2f%2fexample.com", "/%252fexample.com", "/portfolio/../sign-in", "/api/auth/sign-out", "/_next/static", "/sign-in?returnTo=/portfolio", "/mentor/sign-up", "/portfolio\n", "/unknown", "/portfolio?" + "x".repeat(2048)]) {
    assert.equal(safeAuthReturn(path), DEFAULT_AUTH_RETURN, String(path));
  }
});

test("login, signup, verification and reset links retain one original destination", () => {
  const origin = "/portfolio?year=2025#allocation";
  for (const page of ["/sign-in", "/sign-up", "/verify-email", "/reset-password"] as const) {
    const href = authHref(page, origin);
    assert.equal(authReturnFromLocation(href), origin);
    assert.equal(new URL(href, "https://mentor.invalid").searchParams.get("returnTo"), origin);
  }
  assert.equal(authReturnFromLocation("/mentor/sign-in?returnTo=%2Fdashboard"), "/dashboard");
  assert.equal(authReturnFromLocation("/sign-in?returnTo=https%3A%2F%2Fexample.com"), DEFAULT_AUTH_RETURN);
  assert.equal(authReturnFromLocation("/portfolio?year=2025#allocation"), origin);
});

const baseURL = "http://localhost:3104";
function harness() {
  const mail: string[] = [];
  const memory: Record<string, Record<string, unknown>[]> = { user: [], account: [], session: [], verification: [] };
  const auth = betterAuth({
    baseURL,
    secret: "isolated-auth-return-test-secret-at-least-32-characters",
    database: memoryAdapter(memory),
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ url }) => { mail.push(url); },
    },
    socialProviders: { google: { clientId: "qa-id", clientSecret: "qa-secret" } },
  });
  const post = (path: string, body: unknown) => auth.handler(new Request(`${baseURL}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseURL },
    body: JSON.stringify(body),
  }));
  return { auth, mail, memory, post };
}

test("email signup and verification return a new member to the original deep link in another browser", async () => {
  const { auth, mail, post } = harness();
  const destination = safeAuthReturn("/blueprint/episode/lesson-13?from=course#outline");
  const signup = await post("/sign-up/email", { name: "QA", email: "new@example.test", password: "Isolated-QA-password!", callbackURL: destination });
  assert.equal(signup.status, 200, await signup.clone().text());
  assert.equal((await signup.json()).token, null);
  assert.equal(mail.length, 1);
  assert.equal(new URL(mail[0]).searchParams.get("callbackURL"), destination);
  // No original-tab storage or cookies are supplied when opening the email link.
  const verified = await auth.handler(new Request(mail[0]));
  assert.equal(verified.status, 302);
  assert.equal(verified.headers.get("location"), destination);
  assert(verified.headers.getSetCookie().some(cookie => cookie.includes("session_token=")));
});

test("password login and verification resend retain the original portfolio view", async () => {
  const { auth, mail, post } = harness();
  const destination = safeAuthReturn("/portfolio?year=2025#allocation");
  await post("/sign-up/email", { name: "QA", email: "returning@example.test", password: "Isolated-QA-password!", callbackURL: destination });
  const resend = await post("/send-verification-email", { email: "returning@example.test", callbackURL: destination });
  assert.equal(resend.status, 200);
  assert.equal(new URL(mail.at(-1)!).searchParams.get("callbackURL"), destination);
  await auth.handler(new Request(mail.at(-1)!));
  const login = await post("/sign-in/email", { email: "returning@example.test", password: "Isolated-QA-password!", callbackURL: destination });
  assert.equal(login.status, 200, await login.clone().text());
  assert.equal((await login.json()).url, destination);
});

test("Google initiation retains both existing-member and new-member destinations", async () => {
  const { memory, post } = harness();
  const destination = safeAuthReturn("/dashboard?period=2025");
  const response = await post("/sign-in/social", {
    provider: "google",
    callbackURL: destination,
    newUserCallbackURL: destination,
    errorCallbackURL: authHref("/sign-in", destination),
    disableRedirect: true,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const state = memory.verification.map(row => JSON.parse(String(row.value))).find(row => row.callbackURL === destination);
  assert(state, "OAuth state retains the requested page");
  assert.equal(state.newUserURL, destination);
  assert.equal(state.errorURL, authHref("/sign-in", destination));
});
