'use client'

// Ported unchanged from the Kyte brand site (Updraft folder: components/outline-word.tsx).
import { useEffect, useId, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, type AnimationPlaybackControls } from 'framer-motion';
import { KYTE_OUTLINE_BOX as BOX, KYTE_OUTLINE_PATH as D } from './kyte-outline';

const EASE = [0.65, 0, 0.35, 1] as const;

/**
 * Giant outline of the Kyte wordmark. The outline draws itself in when it
 * scrolls into view, then a soft brand-gradient spotlight follows the pointer
 * along the stroke (or drifts slowly across it on touch devices / when idle).
 */
export function OutlineWord() {
  const uid = useId().replace(/:/g, '');
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const inView = useInView(wrap, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const [sw, setSw] = useState(3);

  const mx = useMotionValue(BOX.x - BOX.w * 0.3);
  const my = useMotionValue(BOX.y + BOX.h / 2);
  const sx = useSpring(mx, { stiffness: 120, damping: 20, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 120, damping: 20, mass: 0.6 });
  const idle = useRef<AnimationPlaybackControls | null>(null);

  // keep the stroke about 1.2 css px regardless of rendered size
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w) setSw((1.2 * (BOX.w * 1.04)) / w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const startIdle = () => {
    if (reduce) return;
    idle.current?.stop();
    animate(my, BOX.y + BOX.h * 0.5, { duration: 0.8 });
    idle.current = animate(mx, [BOX.x - BOX.w * 0.08, BOX.x + BOX.w * 1.08], { duration: 8, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' });
  };

  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(startIdle, 2400);
    return () => { window.clearTimeout(t); idle.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'mouse' || !svg.current) return;
    idle.current?.stop();
    const m = svg.current.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    mx.set(p.x);
    my.set(p.y);
  };

  const pad = BOX.w * 0.02;
  const vb = `${BOX.x - pad} ${BOX.y - pad} ${BOX.w + pad * 2} ${BOX.h + pad * 2}`;

  return (
    <div ref={wrap} className="relative w-full select-none" aria-hidden>
      <svg ref={svg} viewBox={vb} className="block h-auto w-full" onPointerMove={onMove} onPointerLeave={startIdle}>
        <defs>
          <linearGradient id={`g${uid}`} gradientUnits="userSpaceOnUse" x1={BOX.x} x2={BOX.x + BOX.w} y1="0" y2="0">
            <stop offset="0" stopColor="#6EFF85" />
            <stop offset="1" stopColor="#4AFFEC" />
          </linearGradient>
          <radialGradient id={`r${uid}`}>
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`m${uid}`} maskUnits="userSpaceOnUse" x={BOX.x - BOX.w} y={BOX.y - BOX.h} width={BOX.w * 3} height={BOX.h * 3}>
            <motion.circle cx={sx} cy={sy} r={BOX.h * 0.7} fill={`url(#r${uid})`} />
          </mask>
        </defs>

        {/* base outline, drawn in on first view */}
        <motion.path
          d={D}
          fill="none"
          stroke="rgba(200,255,235,0.17)"
          strokeWidth={sw}
          pathLength={1}
          strokeDasharray="1 1"
          initial={reduce ? false : { strokeDashoffset: 1 }}
          animate={inView ? { strokeDashoffset: 0 } : undefined}
          transition={{ duration: 2.8, ease: EASE }}
        />

        {/* leading gradient stroke that traces the outline once, then fades */}
        {!reduce && (
          <motion.path
            d={D}
            fill="none"
            stroke={`url(#g${uid})`}
            strokeWidth={sw * 1.4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="0.06 0.94"
            initial={{ strokeDashoffset: 0.06, opacity: 0 }}
            animate={inView ? { strokeDashoffset: -0.94, opacity: [0, 1, 1, 0] } : undefined}
            transition={{ strokeDashoffset: { duration: 2.8, ease: EASE }, opacity: { duration: 2.8, times: [0, 0.08, 0.85, 1] } }}
          />
        )}

        {/* spotlight: gradient outline + faint fill revealed around the pointer */}
        <g mask={`url(#m${uid})`}>
          <path d={D} fillRule="evenodd" fill={`url(#g${uid})`} fillOpacity={0.1} stroke={`url(#g${uid})`} strokeWidth={sw * 1.7} />
        </g>
      </svg>
    </div>
  );
}
