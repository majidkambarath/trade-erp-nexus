// The context the guide provider fills and the Guide me menu / Learn page read. Kept apart from the component
// so fast refresh keeps working (a file that exports a component should export only components).
import { createContext, useContext } from "react";

export const GuideContext = createContext(null);
export const useGuides = () =>
  useContext(GuideContext) || { active: null, start: () => {}, stop: () => {}, flows: [], lang: "en", setLang: () => {}, done: () => false, table: null };
