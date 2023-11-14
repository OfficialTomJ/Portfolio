// Discord authorization route
export default async function handler(req, res) {
  const scopes = req.query.scopes || 'identify'; // Default scope

  // Construct Discord authorization URL with provided scopes
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&scope=${scopes}`;

  res.status(200).json({ discordAuthUrl });
}
