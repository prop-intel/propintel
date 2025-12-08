import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-4xl font-bold">Capybara</h1>
        <p className="text-lg text-gray-500">
          Capybara is a platform for finding your dream home.
        </p>
      </main>
    </HydrateClient>
  );
}
