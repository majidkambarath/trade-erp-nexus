/** Legacy color strands — dashboard now uses global B/W theme tokens. */
export const DASHBOARD_THEMES = {
  blackWhite: {
    id: "blackWhite",
    name: "Black / White",
    tagline: "Standard ERP theme",
  },
};

export const THEME_LIST = Object.values(DASHBOARD_THEMES);
export const DEFAULT_THEME_ID = "blackWhite";

export function themeToCssVars() {
  return {};
}
