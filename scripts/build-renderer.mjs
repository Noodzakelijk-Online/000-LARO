// A developer .env may set NODE_ENV=development. Release output must never
// inherit that value, so set it before Vite (and therefore React) is imported.
process.env.NODE_ENV = "production";

const { build } = await import("vite");
await build({ mode: "production" });
