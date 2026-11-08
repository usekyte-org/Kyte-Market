'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'

// Set once the first page has rendered, so the switch animation only plays on navigation, never on a fresh load.
let navigated = false

/**
 * Page switch: the incoming page fades in while easing down a short distance (the Framer transition measured
 * on the reference site, toned down). Skipped on first load and on the landing page.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const animate = useRef(navigated && path !== '/').current
  // Browser only: on the server this module lives for every request, so flipping it there would make the
  // server wrap pages that a fresh browser load doesn't (a hydration mismatch on every page after the first).
  if (typeof window !== 'undefined') navigated = true
  if (!animate) return <>{children}</>
  return (
    <motion.div key={path} initial={{ opacity: 0, y: -32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  )
}
