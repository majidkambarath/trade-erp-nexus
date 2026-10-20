import { useLayoutEffect } from "react";
import gsap from "gsap";
import { motionOK } from "../Dashborad/motion";

// Panels that arrive in a short stagger rather than all at once. Small, and deliberately so: the dashboard is read,
// not watched.
//
// It follows the three rules in ../Dashborad/motion.js, each one learned the hard way somewhere else in the product:
//  1. Nothing moves for a person who asked for reduced motion, nor where there is no matchMedia (tests, old
//     WebViews) - so the content is simply there, and the page never WAITS on an animation to show anything.
//  2. It is a fromTo with clearProps, never gsap.from(): from() reads an element's CURRENT, part-transitioned opacity
//     as its end value, and under React StrictMode (which runs the effect twice) the dashboard's buttons once
//     "animated" to 5% opacity and stayed invisible.
//  3. The tween lives in a gsap.context that is reverted on unmount and when the data changes, so a refresh never
//     leaves a half-drawn panel.
// `ready` is the data: the animation runs when there is something on the page to move, not on the loading spinner.
export function useReveal(scope, ready, selector = "[data-reveal]") {
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
