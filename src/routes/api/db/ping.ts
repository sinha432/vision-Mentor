import { createFileRoute } from "@tanstack/react-router";
import { getDatabase } from "@/lib/mongodb.server";

export const Route = createFileRoute("/api/db/ping")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const db = await getDatabase();
          await db.command({ ping: 1 });

          return new Response(
            JSON.stringify({
              success: true,
              message: "MongoDB connection is working",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          console.error("MongoDB ping failed:", error);

          return new Response(
            JSON.stringify({
              success: false,
              message: "MongoDB connection failed",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
