"use client";
import { createAuthClient } from "better-auth/react";

// No baseURL -> uses the current origin (works on localhost + the subdomain).
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
