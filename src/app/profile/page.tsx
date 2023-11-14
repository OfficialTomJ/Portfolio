"use client"

import React, { useEffect, useState } from "react";
import { Amplify, Auth } from "aws-amplify";
import Config from "../../aws-exports";

Amplify.configure(Config);

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Fetch the current authenticated user on component mount
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      setUser(currentUser);
    } catch (error) {
      // Handle error fetching user (e.g., user not signed in)
      console.error("Error fetching user:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      // Sign out the current user
      await Auth.signOut();
      setUser(null); // Clear the user state
      window.location.href = "/signup";
    } catch (error) {
      // Handle error signing out
      console.error("Error signing out:", error);
    }
  };

  const handleDiscordLink = async () => {
    try {
      const response = await fetch("/api/discord/authorise");
      const data = await response.json();

      // Extract the Discord authorization URL from the response
      const { discordAuthUrl } = data;

      // Redirect the user to Discord's authorization URL
      window.location.href = discordAuthUrl;

    } catch (error) {
      console.error("Error linking Discord account:", error);
    }
  };


  return (
    <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        {/* Display Discord user details */}
        {/* Example: */}
        {/* <p>Discord Username: {user.discord.username}</p> */}
        {/* <img src={user.discord.avatar} alt="Discord Avatar" /> */}
        {/* <p>Discord User ID: {user.discord.id}</p> */}

        <div className="text-center">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={handleDiscordLink}
          >
            Link Discord Account
          </button>
        </div>

        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}
