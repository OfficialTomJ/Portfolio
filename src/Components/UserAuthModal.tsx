"use client"
import React, { useState } from "react";
import { Amplify, Auth } from "aws-amplify";
import Config from "../../src/aws-exports";

Amplify.configure(Config);

const UserAuthModal = () => {
  const [mode, setMode] = useState("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [signInError, setSignInError] = useState(null);

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleVerificationCodeChange = (e) => {
    setVerificationCode(e.target.value);
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

        // Switch to verification mode
        setShowVerification(true);
        console.log("User signed up successfully");
      } else {
        // Sign in logic
        await Auth.signIn(username, password);
        console.log("User signed in successfully");
      }

    } catch (error) {
      console.error("Error:", error);
      if (mode === "signin") {
        setSignInError("Invalid username or password. Please try again.");
      }
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();

    try {
      // Confirm the user using the verification code
      await Auth.confirmSignUp(username, verificationCode);

      // If successful, you can redirect the user or perform other actions
      console.log("Email verification successful!");
      // Clear the verification code after successful verification
      setVerificationCode("");
      // Switch back to sign-in mode after successful verification
      setShowVerification(false);
    } catch (error) {
      // Handle verification error
      console.error("Error verifying email:", error);
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
              onClick={() => {
                setMode("signup");
                setShowVerification(false); // Switching back to sign-up mode
              }}
            >
              Sign Up
            </button>
            <button
              className={`cursor-pointer focus:outline-none ${
                mode === "signin" ? "text-blue-500 font-bold" : "text-gray-500"
              }`}
              onClick={() => {
                setMode("signin");
                setShowVerification(false); // Switching back to sign-in mode
              }}
            >
              Sign In
            </button>
          </div>
        </div>
        {showVerification ? (
          // Verification Code Input
          <form onSubmit={handleVerifyEmail}>
            <div className="mb-4">
              <label
                className="block text-gray-700 text-sm font-bold mb-2"
                htmlFor="verificationCode"
              >
                Verification Code
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="verificationCode"
                type="text"
                placeholder="Enter verification code"
                value={verificationCode}
                onChange={handleVerificationCodeChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                onClick={handleVerifyEmail}
              >
                Verify Email
              </button>
            </div>
          </form>
        ) : (
          // Sign Up / Sign In Form
          <form onSubmit={handleSubmit}>
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
            {mode === "signin" && (
              <div className="mb-4 text-red-500">
                {signInError && <p>{signInError}</p>}
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                type="submit"
              >
                {mode === "signup" ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default UserAuthModal;

