"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-200">500</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-800">
          Something went wrong
        </h2>
        <p className="mt-2 text-gray-600">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="mt-2 text-sm text-gray-400">Error ID: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
