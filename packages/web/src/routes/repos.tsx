import { createFileRoute } from "@tanstack/react-router";

import { client } from "../lib/api/client";

export const Route = createFileRoute("/repos")({
  component: ReposPage,
});

function ReposPage() {
  const handleAddRepo = async () => {
    try {
      const response = await client.me.repos.add.$get();
      const data = await response.json();
      console.log("Response:", data);
      // You can add a toast notification here to show success/error
    } catch (error) {
      console.error("Error adding repo:", error);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Repositories</h1>
        <button
          onClick={handleAddRepo}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Add Repository
        </button>
      </div>
    </div>
  );
}
