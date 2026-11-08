'use client'

import { Sparkle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import { AUTOPILOT_ENABLED } from '@/lib/config'
import { INDEXER_URL } from '@/lib/data'
import { useEffect, useState } from 'react'
import { AgentChat } from './AgentChat'

const EASE = [0.22, 1, 0.36, 1] as const

/** Floating "Ask Kyte" button on every page, opening the agent in a slide-over. Hidden on the full /agent page. */
export function AgentPanel() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const { address } = useAccount()
  const [waiting, setWaiting] = useState(0)
  useEffect(() => {
    if (!address || !AUTOPILOT_ENABLED) { setWaiting(0); return }
    let live = true
    const poll = () => fetch(`${INDEXER_URL}/autopilot/triggers/${address}?limit=50`).then((r) => r.json()).then((t) => { if (live && Array.isArray(t)) setWaiting(t.filter((x: { seen: boolean }) => !x.seen).length) }).catch(() => {})
    poll(); const id = setInterval(poll, 60_000)
    return () => { live = false; clearInterval(id) }
  }, [address])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  if (path === '/agent') return null
  return (
    <>
      {/* wrapper carries the fixed position: .btn-glass sets position relative for its ring */}
      <div className="fixed bottom-5 right-5 z-30 md:bottom-6 md:right-6">
        <button type="button" onClick={() => setOpen(true)} aria-label="Ask Kyte" className="btn btn-glass btn-glass-sm shadow-lg">
          <Sparkle size={15} className="text-accent" /> Ask Kyte
          {waiting > 0 && <span className="ml-1 rounded-full bg-[var(--color-ink)] px-1.5 text-[10px] font-medium leading-4 text-[var(--color-bg)]" title={`${waiting} Autopilot action${waiting === 1 ? '' : 's'} waiting for you`}>{waiting}</span>}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
            <motion.aside
              key="panel"
              role="dialog"
              aria-label="Kyte agent"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="glass fixed bottom-3 right-3 top-3 z-50 flex w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl"
            >
              <div className="hair flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium"><Sparkle size={15} className="text-accent" /> Kyte agent</div>
                <div className="flex items-center gap-1">
                  <Link href="/agent" onClick={() => setOpen(false)} className="lnk text-xs text-muted hover:text-ink">Full page</Link>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-2 grid size-8 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-ink"><X size={15} /></button>
                </div>
              </div>
              <div className="min-h-0 flex-1"><AgentChat compact /></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
