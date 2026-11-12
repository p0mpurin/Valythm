"use client";

import { useEffect, useRef } from "react";

/** A scrolling trace of the microphone level while recording. */
export function LiveScope({ level }: { level: () => number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const read = useRef(level);
  useEffect(() => { read.current = level; });

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let frame = 0, last = 0;
    const history: number[] = [];
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = element.clientWidth, height = element.clientHeight;
      if (element.width !== Math.round(width * dpr)) { element.width = Math.round(width * dpr); element.height = Math.round(height * dpr); }
      const ctx = element.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const step = 4.5, count = Math.floor(width / step);
      if (time - last > 45) { last = time; history.push(read.current()); while (history.length > count) history.shift(); }
      ctx.clearRect(0, 0, width, height);
      history.forEach((value, i) => {
        const age = (history.length - 1 - i) / count;
        const bar = Math.max(2, Math.pow(value, .75) * height * .9);
        const x = width - (history.length - i) * step;
        ctx.fillStyle = i === history.length - 1 ? "#dc2626" : `rgba(255,255,255,${.85 * (1 - age) + .08})`;
        ctx.beginPath();
        ctx.roundRect(x, (height - bar) / 2, 2, bar, 1);
        ctx.fill();
      });
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} className="block h-16 w-full" aria-hidden />;
}
