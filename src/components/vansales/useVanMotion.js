import { useLayoutEffect } from "react";
import gsap from "gsap";
import { motionOK } from "../Dashborad/motion";
import { useReveal } from "../crm/useReveal";

// The van sales screens' motion, in one place: panels marked [data-reveal] stagger in (crm/useReveal), every
// [data-meter] bar grows from nothing to the width already written in its style, and a [data-truck] badge drives in.
// It runs once per `key` (a trip id, or "board" once the board has data), so a refresh every two minutes never
// replays it. Same rules as the dashboard: nothing under reduced motion or without matchMedia (tests), fromTo with
// clearProps (never from()), and a gsap.context reverted on unmount.
export function useVanMotion(scope, key) {
  useReveal(scope, Boolean(key));
  useLayoutEffect(() => {
    const root = scope.current;
    if (!key || !root || !motionOK()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-meter]", { scaleX: 0 }, { scaleX: 1, duration: 0.9, delay: 0.25, ease: "power3.out", stagger: 0.05, clearProps: "transform" });
      gsap.fromTo("[data-truck]", { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "back.out(1.7)", stagger: 0.06, clearProps: "opacity,transform" });
    }, root);
    return () => ctx.revert();
  }, [scope, key]);
}
