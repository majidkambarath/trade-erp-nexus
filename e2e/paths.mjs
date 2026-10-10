// Where things are, for every end-to-end script. Nothing here is specific to one machine: the frontend is the folder above
// this one, the backend is its sibling `trade ERP node` (set ERP_BACKEND_DIR when yours lives elsewhere), and what the
// scripts write (screenshots) goes to e2e/.out, which git ignores.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const slash = (p) => p.replace(/\\/g, "/");
export const FE = slash(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
export const BE = slash(process.env.ERP_BACKEND_DIR ? resolve(process.env.ERP_BACKEND_DIR) : resolve(FE, "..", "trade ERP node"));
export const OUT = slash(process.env.E2E_OUT ? resolve(process.env.E2E_OUT) : join(FE, "e2e", ".out"));

if (!existsSync(join(BE, "server.js"))) {
  throw new Error(`The backend was not found at "${BE}". Put it beside the frontend as "trade ERP node", or set ERP_BACKEND_DIR.`);
}
if (!existsSync(join(BE, ".env"))) {
  throw new Error(`"${BE}/.env" is missing: the scripts need its MONGO_URI to make their own throwaway database on the same cluster.`);
}
