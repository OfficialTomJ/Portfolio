'use client'
import React, { useState, useEffect } from "react";
import PortfolioFooter from "@/Sections/PortfolioFooter";
import axios from "axios";
import Link from "next/link";
import Confetti from "react-confetti";
import Navbar from "../../Components/PortfolioNavbar";

const Apply = () => {

  const [formData, setFormData] = useState({
    fullName: "",
    bestEmail: "",
    tradingExperience: "",
    tradingSkill: "",
    helpWithTrading: "",
    additionalComments: "",
  });

  const [errors, setErrors] = useState<{
    fullName?: string;
    bestEmail?: string;
    tradingExperience?: string;
    tradingSkill?: string;
    helpWithTrading?: string;
    additionalComments?: string;
  }>({});
  
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleChange = (e: { target: { name: any; value: any; }; }) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear the specific error when the user types into the corresponding field
    setErrors({
      ...errors,
      [name]: undefined,
    });
  };

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();

    // Basic form validation
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length === 0) {
      // Form is valid, proceed with submission logic
      try {
        await axios.post("/api/MasterclassAmplifyOne", formData);
        // Handle success
        setFormSubmitted(true);
      } catch (error) {
        console.error(error);
        // Handle error
      }
      
    } else {
      // Form has errors, update the state to display error messages
      setErrors(validationErrors);
    }
  };

  const validateForm = () => {
    const validationErrors: {
      fullName?: string;
      bestEmail?: string;
      tradingExperience?: string;
      tradingSkill?: string;
      helpWithTrading?: string;
      additionalComments?: string;
    } = {};

    // Check if fullName is empty
    if (!formData.fullName.trim()) {
      validationErrors.fullName = "Full Name is required";
    }

    // Check if bestEmail is a valid email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.bestEmail.trim())) {
      validationErrors.bestEmail = "Enter a valid email address";
    }

    // Check if tradingExperience is selected
    if (!formData.tradingExperience) {
      validationErrors.tradingExperience = "Select your trading experience";
    }

    // Check if tradingSkill is selected
    if (!formData.tradingSkill) {
      validationErrors.tradingSkill = "Select your trading skill level";
    }

    // Check if helpWithTrading is empty
    if (!formData.helpWithTrading.trim()) {
      validationErrors.helpWithTrading = "Please provide information on what you need help with";
    }

    return validationErrors;
  };

  return (
    <>
      <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          run={formSubmitted}
          recycle={false}
        />
        <div className="container max-w-5xl pb-12">
          <Navbar />
          <h1 className="text-4xl sm:pt-24 pt-12">
            Thank you for your interest in <strong>Masterclass One.</strong>
          </h1>
          <p className="mt-4">
            Please fill out some short questions, and the team will get back to
            you shortly. Mentoring is open to new and advanced traders, which
            helps us get briefed on your current ability and goals in the
            future.
          </p>
          {formSubmitted ? (
            <div className="max-w-md mx-auto mt-8 p-4 bg-zinc-800 rounded-lg flex flex-col">
              <h1 className="text-3xl">
                Your application has been successfully submitted!
              </h1>
              <p className="mt-4">
                Our team will be in contact with you shortly.
              </p>
              <Link
                href="/one"
                className="bg-green-500 text-white rounded px-4 py-2 mt-4 w-fit hover:bg-green-600 focus:outline-none focus:ring focus:border-blue-300"
              >
                Go Back to Masterclass One
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="max-w-md mx-auto mt-8 p-4 bg-zinc-800 rounded-lg flex flex-col"
            >
              <label className="mb-4">
                Full Name*:
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={`bg-gray-700 border border-gray-600 rounded px-3 py-2 mt-1 focus:outline-none focus:ring focus:border-blue-500 w-full ${
                    errors.fullName ? "border-red-500" : ""
                  }`}
                />
              </label>
              <label className="mb-4">
                Best Email*:
                <input
                  type="email"
                  name="bestEmail"
                  value={formData.bestEmail}
                  onChange={handleChange}
                  className={`bg-gray-700 border border-gray-600 rounded px-3 py-2 mt-1 focus:outline-none focus:ring focus:border-blue-500 w-full ${
                    errors.bestEmail ? "border-red-500" : ""
                  }`}
                />
              </label>
              <label className="mb-4">
                Trading Experience*:
                <select
                  name="tradingExperience"
                  value={formData.tradingExperience}
                  onChange={handleChange}
                  className={`bg-gray-700 border border-gray-600 rounded px-3 py-2 mt-1 focus:outline-none focus:ring focus:border-blue-500 w-full ${
                    errors.tradingExperience ? "border-red-500" : ""
                  }`}
                >
                  <option value="">Select</option>
                  <option value="<1">Less than 1 year</option>
                  <option value="1-2">1-2 years</option>
                  <option value="3+">3+ years</option>
                </select>
              </label>
              <label className="mb-4">
                Trading Skill*:
                <select
                  name="tradingSkill"
                  value={formData.tradingSkill}
                  onChange={handleChange}
                  className={`bg-gray-700 border border-gray-600 rounded px-3 py-2 mt-1 focus:outline-none focus:ring focus:border-blue-500 w-full ${
                    errors.tradingSkill ? "border-red-500" : ""
                  }`}
                >
                  <option value="">Select</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label className="mb-4">
                What do you need the most help with in regards to Trading?
                (short paragraph)*:
                <textarea
                  name="helpWithTrading"
                  value={formData.helpWithTrading}
                  onChange={handleChange}
                  className={`bg-gray-700 border border-gray-600 rounded px-3 py-2 mt-1 focus:outline-none focus:ring focus:border-blue-500 w-full resize-y ${
                    errors.helpWithTrading ? "border-red-500" : ""
                  }`}
                  rows="6"
                ></textarea>
              </label>
              <label className="mb-4">
                Additional Comments:
                <textarea
                  name="additionalComments"
                  value={formData.additionalComments}
                  onChange={handleChange}
                  className={`bg-gray-700 border border-gray-600 rounded px-3 py-2 mt-1 focus:outline-none focus:ring focus:border-blue-500 w-full resize-y ${
                    errors.additionalComments ? "border-red-500" : ""
                  }`}
                  rows="4"
                ></textarea>
              </label>
              <div className="mb-4 text-red-500">
                {errors.fullName && <p>{errors.fullName}</p>}
                {errors.bestEmail && <p>{errors.bestEmail}</p>}
                {errors.tradingExperience && <p>{errors.tradingExperience}</p>}
                {errors.tradingSkill && <p>{errors.tradingSkill}</p>}
                {errors.helpWithTrading && <p>{errors.helpWithTrading}</p>}
                {errors.additionalComments && (
                  <p>{errors.additionalComments}</p>
                )}
              </div>
              <button
                type="submit"
                className="bg-green-500 text-white rounded px-4 py-2 mt-4 hover:bg-green-600 focus:outline-none focus:ring focus:border-blue-300"
              >
                Submit
              </button>
            </form>
          )}
        </div>
      </main>
      <PortfolioFooter />
    </>
  );
};

export default Apply;

