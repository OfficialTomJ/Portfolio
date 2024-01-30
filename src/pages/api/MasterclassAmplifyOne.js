import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import { createMasterclassOneForm } from '../../graphql/mutations';
import Config from "../../aws-exports";

Amplify.configure(Config);
const client = generateClient();

export default async function handler(req, res) {
  try {
    const { fullName, bestEmail, tradingExperience, tradingSkill, helpWithTrading, additionalComments } = req.body;

    const newMasterclassOneForm = await client.graphql({
      query: createMasterclassOneForm,
      variables: {
        input: {
          "full_name": fullName,
          "email": bestEmail,
          "trading_experience": tradingExperience,
          "trading_skill": tradingSkill,
          "description": helpWithTrading,
          "additional": additionalComments
        }
      }
    });

    // Handle the response as needed

    res.status(200).json({ success: true, message: 'Form submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
