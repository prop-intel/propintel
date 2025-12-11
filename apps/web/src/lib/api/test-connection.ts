/**
 * Simple test script to verify backend API connection
 * Run this from the browser console or a test page
 */

import { api } from "./client";

export async function testApiConnection() {
  console.log("Testing PropIntel Backend API connection...");
  console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);

  try {
    // Test health endpoint (no auth required)
    console.log("\n1. Testing health endpoint...");
    const health = await api.health();
    console.log("✅ Health check passed:", health);

    // Test dashboard summary (requires auth)
    console.log("\n2. Testing dashboard summary (requires auth)...");
    try {
      const summary = await api.dashboard.getSummary();
      console.log("✅ Dashboard summary:", summary);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("UNAUTHORIZED")) {
          console.log("⚠️  Dashboard requires authentication (expected if not logged in)");
        } else {
          console.error("❌ Dashboard error:", error.message);
        }
      }
    }

    console.log("\n✅ API connection test completed!");
    return true;
  } catch (error) {
    console.error("\n❌ API connection test failed:");
    if (error instanceof Error) {
      console.error("Error:", error.message);
      console.error("Details:", error);
    }
    return false;
  }
}
