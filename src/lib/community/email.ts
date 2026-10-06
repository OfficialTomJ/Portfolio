import { actionUrl, escapeHtml, layout, note, paragraph, type TransactionalEmail } from "../email-brand";

export function communityEmail(input: { origin: string; code: string; purpose: "connect" | "manage"; discordName?: string }): TransactionalEmail {
  if (!/^\d{6}$/.test(input.code)) throw new Error("Community email requires a six-digit code");
  const management = input.purpose === "manage";
  const url = `${new URL(input.origin).origin}/discord/${management ? "manage" : "verify"}`;
  const href = actionUrl(url);
  const name = input.discordName || "your selected Discord account";
  const intro = management ? "Enter this code on the connection management page you have open to manage or unlink your Discord connection."
    : `Enter this code on the verification page you have open to verify your email and unlock community access for <strong style="color:#fafafa;font-weight:500;">${escapeHtml(name)}</strong> on Discord.`;
  const codeBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#111114" style="padding:23px 12px 21px;background-color:#111114;border:1px solid #333336;border-radius:10px;"><p style="margin:0 0 10px;color:#a1a1aa;font-size:11px;line-height:16px;font-weight:500;letter-spacing:1.7px;text-transform:uppercase;">${management ? "Your management code" : "Your verification code"}</p><p class="code" style="margin:0;color:#ff6719;font-family:Consolas,'Courier New',monospace;font-size:44px;line-height:52px;font-weight:700;letter-spacing:10px;white-space:nowrap;">${input.code}</p></td></tr></table><p style="margin:14px 0 26px;color:#a1a1aa;text-align:center;font-size:13px;line-height:20px;">Expires in <strong style="color:#fafafa;font-weight:500;">5 minutes</strong>. Keep this code private.</p><p style="margin:0 0 26px;font-size:14px;line-height:22px;"><a href="${href}" style="color:#ff6719;text-decoration:underline;font-weight:500;">Back to ${management ? "connection management" : "verification"} &rarr;</a></p>`;
  const notice = "Unlinking will remove your verified access in the community. You’ll need to re-verify to continue accessing it.";
  return layout({ subject: management ? "Manage your Discord connection" : "Your Discord community verification code",
    category: "Discord community", heading: management ? "Manage your Discord connection" : "Verify your email",
    preheader: management ? "Your connection management code expires in 5 minutes." : "Your verification code expires in 5 minutes.",
    body: paragraph(intro) + codeBox + (management ? note("Unlinking your Discord", notice) : ""),
    ignore: management ? "If you didn’t request this code, you can ignore this email. Your connection will not change unless you complete the request."
      : "If you didn’t request this code, you can ignore this email. Nothing will be linked or activated unless verification is completed.",
    text: `Your ${management ? "Discord connection management" : "community verification"} code is ${input.code}. It expires in 5 minutes. Keep this code private.\n\n${management ? "This code allows managing or unlinking your Discord connection." : `This verifies ${name} for community access.`}\n\nBack to ${management ? "connection management" : "verification"}: ${url}${management ? `\n\n${notice}` : ""}`,
  });
}
