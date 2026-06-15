import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "./mongodb";
import { sendEmail } from "./email";

// Better Auth reads BETTER_AUTH_SECRET and BETTER_AUTH_URL from env automatically.
export const auth = betterAuth({
  database: mongodbAdapter(getDb()),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Blueprint password",
        html: `<p>Click below to reset your password:</p><p><a href="${url}">Reset password</a></p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email — The Blueprint",
        html: `<p>Welcome to The Blueprint.</p><p>Confirm your email to start watching:</p><p><a href="${url}">Verify email</a></p>`,
      });
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      // For security, the approval link is sent to the CURRENT email.
      sendChangeEmailVerification: async ({
        user,
        newEmail,
        url,
      }: {
        user: { email: string };
        newEmail: string;
        url: string;
      }) => {
        await sendEmail({
          to: user.email,
          subject: "Approve your email change — The Blueprint",
          html: `<p>Confirm changing your account email to <strong>${newEmail}</strong>:</p><p><a href="${url}">Approve change</a></p>`,
        });
      },
    },
  },
  socialProviders: process.env.GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {},
  plugins: [nextCookies()],
});
