

export default async function handler(req, res) {
  try {
    const { fullName, bestEmail, tradingExperience, tradingSkill, helpWithTrading, additionalComments } = req.body;

    console.log("Google Sheets logic here.");

    // Handle the response as needed

    res.status(200).json({ success: true, message: 'Form submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
