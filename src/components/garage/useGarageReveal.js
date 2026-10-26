import { useLayoutEffect } from "react";
import gsap from "gsap";
import { motionOK } from "../Dashborad/motion";

// Panels that arrive in a short stagger rather than all at once, the Board's own copy of the CRM's
// useReveal.js (each module keeps its own small reveal hook; see garageCharts.jsx for why). The three rules
// in Dashborad/motion.js still hold: nothing moves under reduced motion or with no matchMedia, it is a
// fromTo with clearProps (never gsap.from(), which reads a part-transitioned opacity under React
// StrictMode), and the tween lives in a gsap.context reverted on unmount or when the data changes.
export function useGarageReveal(scope, ready, selector = "[data-reveal]") {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!ready || !root || !motionOK()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        selector,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: { amount: 0.5 }, clearProps: "opacity,transform" }
      );
    }, root);
    return () => ctx.revert();
  }, [scope, ready, selector]);
}
