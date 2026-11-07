import { useLayoutEffect } from "react";
import gsap from "gsap";
import { motionOK } from "../Dashborad/motion";

// The HR dashboard's panels arrive in a short stagger rather than all at once.
//
// Its own copy, per the convention written out in ../garage/garageCharts.jsx and proved by
// ../garage/useGarageReveal.js: FlowCharts, motion.js, CountUp and helpers.js are the genuinely shared
// layer, and a module's reveal hook is its own. The three rules it follows are each a bug paid for
// elsewhere in the product:
//  1. Nothing moves for a person who asked for reduced motion, nor anywhere matchMedia is missing (tests,
//     old WebViews) - the figures are simply there, and the screen never WAITS on an animation to show one.
//  2. fromTo with clearProps, never gsap.from(): from() reads an element's CURRENT, part-transitioned
//     opacity as its end value, and under StrictMode's double effect the trade dashboard's own buttons
//     once "animated" to 5% opacity and stayed invisible.
//  3. The tween lives in a gsap.context reverted on unmount and whenever the figures change, so changing
//     the month never leaves a half-drawn panel.
// `ready` is the DATA: the stagger runs when there is something to move, not over the loading spinner.
export function useHrReveal(scope, ready, selector = "[data-reveal]") {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!ready || !root || !motionOK()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        selector,
        { opacity: 0, y: 14 },
        // A total of 0.6s however many panels there are - per-card staggering made the cards far down a
        // long page arrive seconds late.
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: { amount: 0.6 }, clearProps: "opacity,transform" }
      );
    }, root);
    return () => ctx.revert();
  }, [scope, ready, selector]);
}
