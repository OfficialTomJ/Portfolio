"use client"

import React, { useEffect, useState } from "react";
import { Amplify, Auth, API } from "aws-amplify";
import Config from "../../aws-exports";
import { User } from "../../models/index";
import { getUser, deleteDiscord } from "../../graphql/queries";

Amplify.configure(Config);

export default function Profile() {
  const [user, setUser] = useState(null);
  const [discordInfo, setDiscordInfo] = useState(null);

  useEffect(() => {
    // Fetch the current authenticated user on component mount
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      setUser(currentUser);

      const { data } = await API.graphql({
        query: getUser,
        variables: { id: currentUser.attributes.sub },
      });

      if (data && data.getUser) {
        const {
          discordAvatar,
          discordGlobalName,
          discordID,
          discordUsername,
          id,
        } = data.getUser;

        setDiscordInfo({
          username: discordUsername,
          id: discordID,
          avatar:
            "https://cdn.discordapp.com/avatars/" +
            discordID +
            "/" +
            discordAvatar +
            ".jpg",
          globalName: discordGlobalName, // Add other properties as needed
        });
      } else {
        setDiscordInfo(null);
      }
    } catch (error) {
      // Handle error fetching user or Discord info
      console.error("Error fetching user or Discord info:", error);
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

  const handleUnlinkDiscord = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();

      const deletedDiscord = await API.graphql({
        query: deleteDiscord,
        variables: { id: currentUser.attributes.sub },
      });

      setDiscordInfo(null);
    } catch (error) {
      console.error("Error unlinking Discord account:", error);
    }
  };


  return (
    <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        {discordInfo ? (
          // Display Discord user details if the Discord info exists
          <div className="flex flex-col items-center">
            <p>Discord Username: {discordInfo.username}</p>
            <img src={discordInfo.avatar} alt="Discord Avatar" />
            <p>Discord User ID: {discordInfo.id}</p>
            <button
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4"
              onClick={handleUnlinkDiscord}
            >
              Unlink Discord Account
            </button>
          </div>
        ) : (
          // Show the 'Link Discord Account' button if Discord info doesn't exist
          <div className="text-center">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              onClick={handleDiscordLink}
            >
              Link Discord Account
            </button>
          </div>
        )}
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4"
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}
