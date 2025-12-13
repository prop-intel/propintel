import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-200">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-800">
          Page Not Found
        </h2>
        <p className="mt-2 text-gray-600">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Link
            href="/"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
