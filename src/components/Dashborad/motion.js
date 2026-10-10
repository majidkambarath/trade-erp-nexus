import { useEffect, useState } from "react";

// Motion for the dashboard, in one place. Three rules, all of them about not getting in the way:
//  1. Nothing moves for a person who asked their system for reduced motion, and nothing moves where there is no
//     `matchMedia` at all (tests, old WebViews): the final figure is simply there. The page never WAITS for an animation
//     to show a number - the real text is in the markup first, and an animation only plays over it.
//  2. A chart draws itself when it comes into view, not when the page loads (the flow charts sit below the first screen).
//  3. Every tween lives in a gsap.context that is reverted on unmount or when the data changes, so a period change
//     never leaves a half-drawn chart or a number stuck mid-count.

export function motionOK() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// True once the element has been on screen (never goes back to false: a chart drawn once stays drawn). Without
// IntersectionObserver it is true at once, so nothing is left hidden.
export function useInView(ref, { threshold = 0.2 } = {}) {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (seen) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, threshold]);
  return seen;
}
