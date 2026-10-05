import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// `preference` is what the person chose: "light", "dark" or "system" (follow the device).
// `theme` is what is actually showing - always "light" or "dark" - so existing code that
// checks `theme === "dark"` keeps working whichever preference is set.
const ThemeContext = createContext({
  theme: "light",
  preference: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

const KEY = "erp-bw-theme";
const PREFERENCES = ["light", "dark", "system"];

const systemTheme = () => {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
};

export function ThemeProvider({ children, defaultTheme = "light" }) {
  const [preference, setPreference] = useState(() => {
    try {
      const stored = localStorage.getItem(KEY);
      return PREFERENCES.includes(stored) ? stored : defaultTheme;
    } catch {
      return defaultTheme;
    }
  });
  const [device, setDevice] = useState(systemTheme);
  const theme = preference === "system" ? device : preference;

  // follow the device while "system" is chosen
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDevice(query.matches ? "dark" : "light");
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, preference);
    } catch {
      /* ignore */
    }
  }, [preference]);

  const setTheme = useCallback((value) => {
    setPreference(PREFERENCES.includes(value) ? value : "light");
  }, []);

  // the header switch flips what is showing now, and from then on that is the choice
  const toggleTheme = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [theme]);

  const value = useMemo(
    () => ({ theme, preference, setTheme, toggleTheme }),
    [theme, preference, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
