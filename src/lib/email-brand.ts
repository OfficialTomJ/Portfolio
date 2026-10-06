/** All outgoing transactional emails share the website's approved black/orange design.
 * Dynamic values are escaped here; action URLs are supplied by Better Auth or server configuration.
 */
export type TransactionalEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}
export function actionUrl(value: string): string {
  const parsed = new URL(value);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Email action URL must use HTTP or HTTPS without credentials");
  }
  // Return the original string so signed/tokenized URLs are not normalized or rebuilt.
  return escapeHtml(value);
}
const privacy = "https://mentor.thomas-johnston.com/privacy";
export const paragraph = (html: string) => `<p style="margin:0 0 26px;color:#a1a1aa;font-size:16px;line-height:25px;">${html}</p>`;
export const note = (title: string, html: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #242426;padding-top:22px;"><p style="margin:0 0 10px;color:#fafafa;font-size:14px;line-height:22px;font-weight:500;">${title}</p><p style="margin:0;color:#a1a1aa;font-size:13px;line-height:21px;">${html}</p></td></tr></table>`;

type Content = { subject: string; category: string; heading: string; preheader: string; body: string; ignore: string; text: string };
export function layout(content: Content): TransactionalEmail {
  return { subject: content.subject, text: `The Blueprint.\n\n${content.text}\n\n${content.ignore}\n\nThomas Johnston · The Blueprint\nPrivacy policy: ${privacy}`, html: `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(content.subject)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    table { border-collapse: collapse; }
    body { margin: 0; padding: 0; width: 100% !important; background: #000000; }
    a { color: #ff6719; }
    @media only screen and (max-width: 600px) {
      .outer { padding: 28px 16px !important; }
      .content { padding: 28px 24px !important; }
      .headline { font-size: 30px !important; line-height: 36px !important; }
      .code { font-size: 36px !important; letter-spacing: 7px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#000000;color:#fafafa;font-family:'Jost',Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#000000;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="width:100%;background-color:#000000;">
    <tr>
      <td class="outer" align="center" style="padding:48px 20px 40px;">
        <!--[if mso]><table role="presentation" width="560" align="center"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr>
            <td style="padding:0 0 28px;font-family:'Jost',Arial,Helvetica,sans-serif;font-size:23px;line-height:30px;font-weight:600;letter-spacing:-0.5px;color:#fafafa;">The Blueprint<span style="color:#ff6719;">.</span></td>
          </tr>
          <tr>
            <td bgcolor="#0a0a0b" style="background-color:#0a0a0b;border:1px solid #242426;border-radius:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="content" style="padding:36px 36px 32px;">
                    <p style="margin:0 0 15px;color:#ff6719;font-size:12px;line-height:18px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;">${escapeHtml(content.category)}</p>
                    <h1 class="headline" style="margin:0 0 18px;font-family:'Jost',Arial,Helvetica,sans-serif;color:#fafafa;font-size:36px;line-height:42px;font-weight:600;letter-spacing:-0.9px;">${content.heading}</h1>
                    ${content.body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 4px 0;">
              <p style="margin:0 0 18px;color:#a1a1aa;font-size:12px;line-height:20px;">${escapeHtml(content.ignore)}</p>
              <p style="margin:0 0 8px;color:#a1a1aa;font-size:12px;line-height:18px;">Thomas Johnston · The Blueprint</p>
              <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:18px;"><a href="https://mentor.thomas-johnston.com/privacy" style="color:#a1a1aa;text-decoration:underline;">Privacy policy</a> &nbsp;·&nbsp; © ${new Date().getUTCFullYear()} Thomas Johnston</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>` };
}
