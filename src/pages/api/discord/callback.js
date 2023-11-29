// In your server-side API route for handling Discord callback (e.g., discord/callback.js)
import { API, Auth } from 'aws-amplify';


export default async function handler(req, res) {
  const { code } = req.query;
  console.log(res);
  try {
    // Exchange the authorization code for an access token by making a request to Discord's token endpoint
    const discordTokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
    });

    if (!discordTokenResponse.ok) {
      throw new Error('Failed to fetch Discord token');
    }

    const { access_token } = await discordTokenResponse.json();

    // Use the access token to fetch user data from Discord
    const discordUserResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!discordUserResponse.ok) {
      throw new Error('Failed to fetch Discord user');
    }

    const discordUserData = await discordUserResponse.json();

    // Construct the redirect URL with props as query parameters
    const redirectUrl = `/profile?discordUser=${encodeURIComponent(JSON.stringify(discordUserData))}`;

    // Redirect to the client-side page
    res.writeHead(302, { Location: redirectUrl });
    res.end();

  } catch (error) {
    console.error('OAuth Callback Error:', error);
    res.status(500).end('Error processing Discord OAuth callback');
  }
}
