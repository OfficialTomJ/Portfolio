import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
// Resend's shared sender works for testing without domain verification.
const from = process.env.EMAIL_FROM || "The Blueprint <onboarding@resend.dev>";
const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const links = Array.from(html.matchAll(/href="([^"]+)"/g)).map((m) => m[1]);

  // Dev fallback: no Resend key -> log the email, preserving any links.
  if (!resend) {
    console.log(
      `\n[email:dev] (no RESEND_API_KEY set)\n  To: ${to}\n  Subject: ${subject}` +
        (links.length
          ? `\n  Links:\n${links.map((l) => "    " + l).join("\n")}`
          : "") +
        "\n"
    );
    return;
  }

  // Even with Resend configured, log links in dev so testing isn't blocked by
  // the unverified-domain recipient restriction.
  if (process.env.NODE_ENV !== "production" && links.length) {
    console.log(
      `\n[email:dev] sent via Resend to ${to}\n  Links:\n${links
        .map((l) => "    " + l)
        .join("\n")}\n`
    );
  }
  await resend.emails.send({ from, to, subject, html });
}
