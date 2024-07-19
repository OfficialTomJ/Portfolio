import { google } from "googleapis";
import { config } from "dotenv";
import { join } from "path";

config();

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = "1VVnPJvtctFx0o9X_eavM_RQFw_quQaRuV3z5v1f_IXs";
const SHEET_NAME = "Sheet1";

export default async function handler(req, res) {
  try {
    const {
      fullName,
      bestEmail,
      tradingExperience,
      tradingSkill,
      helpWithTrading,
      additionalComments,
    } = req.body;

    const decodedKey = Buffer.from(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      "base64"
    ).toString("utf8");

    // Load the service account key file
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(decodedKey),
      scopes: SCOPES,
    });

    // Create client instance for auth
    const client = await auth.getClient();

    // Instance of Google Sheets API
    const sheets = google.sheets({ version: "v4", auth: client });

    // Prepare the data to be inserted
    const values = [
      [
        fullName,
        bestEmail,
        tradingExperience,
        tradingSkill,
        helpWithTrading,
        additionalComments,
      ],
    ];

    const resource = {
      values,
    };

    // Append the data to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "USER_ENTERED",
      resource,
    });

    res
      .status(200)
      .json({ success: true, message: "Form submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
