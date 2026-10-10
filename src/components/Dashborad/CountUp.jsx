import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { motionOK } from "./motion";

// A figure that counts up to its value once, when it first shows or when the value changes. The text in the markup is
// ALWAYS the final one (so a screenshot, a print, a screen reader and a test read the real number); the count is a
// flourish over it, set before paint so the final figure never flashes first.
export function CountUp({ value, format = String, duration = 0.9, className, ...rest }) {
  const ref = useRef(null);
  const formatRef = useRef(format);
  formatRef.current = format;
  const target = Number(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(target) || !motionOK()) return undefined;
    const state = { v: 0 };
    el.textContent = formatRef.current(0);
    const tween = gsap.to(state, {
      v: target,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = formatRef.current(state.v);
      },
      onComplete: () => {
        el.textContent = formatRef.current(target);
      },
    });
    return () => {
      tween.kill();
      el.textContent = formatRef.current(target);
    };
  }, [target, duration]);

  return (
    <span ref={ref} className={className} {...rest}>
      {Number.isFinite(target) ? format(target) : "—"}
    </span>
  );
}
