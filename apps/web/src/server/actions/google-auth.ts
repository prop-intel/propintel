"use server";

import { signIn } from "@/server/auth";

export async function handleGoogleSignIn(analyzeUrl?: string, _formData?: FormData) {
  const redirectTo = analyzeUrl
    ? `/dashboard?analyze_url=${encodeURIComponent(analyzeUrl)}`
    : "/dashboard";
  await signIn("google", { redirectTo });
}
