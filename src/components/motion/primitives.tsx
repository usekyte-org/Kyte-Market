'use client'

import { motion, useMotionValue, useSpring, useTransform, type Variants } from 'framer-motion'
import { memo, useRef, type ReactNode } from 'react'

export const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const
export const SPRING_SNAPPY = { type: 'spring', stiffness: 260, damping: 24 } as const

/** Parent/child variants for waterfall reveals. Children must use `item`. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}
export const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: SPRING },
}

/** Reveals children in a staggered waterfall once they scroll into view. */
export function Stagger({ children, className = '', amount = 0.2 }: { children: ReactNode; className?: string; amount?: number }) {
  return (
    <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount }} className={className}>
      {children}
    </motion.div>
  )
}

export function Item({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={`min-w-0 ${className}`}>
      {children}
    </motion.div>
  )
}

/**
 * Magnetic wrapper: the child is pulled a few pixels toward the cursor. Motion values only, no React state,
 * so pointer moves never re-render.
 */
export const Magnetic = memo(function Magnetic({ children, strength = 0.25, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 180, damping: 18, mass: 0.4 })
  const y = useSpring(my, { stiffness: 180, damping: 18, mass: 0.4 })
  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      className={`inline-block ${className}`}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect()
        if (!r) return
        mx.set((e.clientX - (r.left + r.width / 2)) * strength)
        my.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      {children}
    </motion.div>
  )
})

/** Card whose border lights up under the cursor. CSS variables are written directly, no state. */
export const SpotlightCard = memo(function SpotlightCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={`glass relative overflow-hidden rounded-2xl ${className}`}
      onPointerMove={(e) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--sx', `${e.clientX - r.left}px`)
        el.style.setProperty('--sy', `${e.clientY - r.top}px`)
      }}
    >
      {children}
    </div>
  )
})

/** 3D parallax tilt that follows the cursor (motion values, spring smoothed). */
export const Tilt = memo(function Tilt({ children, max = 6, className = '' }: { children: ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const rotateX = useSpring(rx, { stiffness: 120, damping: 18 })
  const rotateY = useSpring(ry, { stiffness: 120, damping: 18 })
  const transform = useTransform([rotateX, rotateY], ([a, b]) => `perspective(1400px) rotateX(${a}deg) rotateY(${b}deg)`)
  return (
    <motion.div
      ref={ref}
      style={{ transform }}
      className={className}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect()
        if (!r) return
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        rx.set(-py * max)
        ry.set(px * max)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
    >
      {children}
    </motion.div>
  )
})
