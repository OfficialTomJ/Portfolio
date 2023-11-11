"use client"
import React, { useState } from "react";
import { Amplify, Auth } from "aws-amplify";
import Config from "../../src/aws-exports";

Amplify.configure(Config);

const UserAuthModal = () => {
  const [mode, setMode] = useState("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (mode === "signup") {
        // Sign up logic
        await Auth.signUp({
          username,
          password,
          attributes: {
            email: username,
          },
        });
        console.log("User signed up successfully");
      } else {
        // Sign in logic
        await Auth.signIn(username, password);
        console.log("User signed in successfully");
      }

      // Clear the form after submitting (optional)
      setUsername("");
      setPassword("");
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-md">
        <div className="mb-6">
          <div className="flex justify-between">
            <button
              className={`cursor-pointer focus:outline-none ${
                mode === "signup" ? "text-blue-500 font-bold" : "text-gray-500"
              }`}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </button>
            <button
              className={`cursor-pointer focus:outline-none ${
                mode === "signin" ? "text-blue-500 font-bold" : "text-gray-500"
              }`}
              onClick={() => setMode("signin")}
            >
              Sign In
            </button>
          </div>
        </div>
        <form>
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="username"
            >
              Email
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="username"
              type="text"
              placeholder="Enter your email"
              value={username}
              onChange={handleUsernameChange}
            />
          </div>
          <div className="mb-6">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="password"
            >
              Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={handlePasswordChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
              onClick={handleSubmit}
            >
              {mode === "signup" ? "Sign Up" : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserAuthModal;
