import { getStore } from "@netlify/blobs";
import { createHandler } from "../lib/api.mjs";

export default createHandler(
  () => getStore({ name: "ruta-peru", consistency: "strong" }),
  () => (globalThis.Netlify ? Netlify.env.get("ADMIN_PASSWORD") : process.env.ADMIN_PASSWORD)
);

export const config = { path: ["/api/data", "/api/login"] };
