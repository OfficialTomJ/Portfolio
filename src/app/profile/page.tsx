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

  return (
    <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
      {user ? (
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Profile</h1>
          <p className="text-lg mb-4">Signed in as: {user.attributes.email}</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <h1>No user is signed in.</h1>
      )}
    </main>
  );
}
