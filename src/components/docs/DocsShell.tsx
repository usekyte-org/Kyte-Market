'use client'

import { ArrowUpRight, Check, Copy, List } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

export type DocSection = { id: string; label: string; group: string }

/** Which section is in view: the last heading that has crossed the top quarter of the viewport. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '')
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e))
    if (!els.length) return
    const update = () => {
      const line = window.innerHeight * 0.25
      let current = els[0].id
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [ids])
  return active
}

/**
 * Three-column docs layout: grouped sidebar on the left, the article in the middle, "On this page" on the right.
 * Both rails are sticky and follow the reader; on small screens the sidebar collapses into a select-like menu.
 */
export function DocsShell({ sections, children }: { sections: DocSection[]; children: ReactNode }) {
  const active = useActiveSection(sections.map((s) => s.id))
  const [open, setOpen] = useState(false)
  const groups = [...new Set(sections.map((s) => s.group))]

  return (
    <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px]">
      {/* Mobile section switcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3 text-sm lg:hidden"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2"><List size={16} className="text-muted" />{sections.find((s) => s.id === active)?.label ?? 'Contents'}</span>
        <span className="label">Menu</span>
      </button>

      <aside className={`${open ? 'block' : 'hidden'} lg:block`}>
        <nav aria-label="Docs" className="space-y-7 lg:sticky lg:top-24">
          {groups.map((g) => (
            <div key={g}>
              <div className="label mb-2">{g}</div>
              <ul className="space-y-0.5 border-l border-line">
                {sections.filter((s) => s.group === g).map((s) => {
                  const on = s.id === active
                  return (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        onClick={() => setOpen(false)}
                        aria-current={on ? 'location' : undefined}
                        className={`-ml-px block border-l py-1 pl-4 text-sm transition-colors duration-200 ${on ? 'border-accent text-ink' : 'border-transparent text-muted hover:border-line-strong hover:text-ink'}`}
                      >
                        {s.label}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <div className="border-t border-line pt-5 text-sm">
            <Link href="/market" className="flex items-center justify-between text-muted hover:text-ink">Open the market <ArrowUpRight size={14} /></Link>
            <Link href="/proof" className="mt-2 flex items-center justify-between text-muted hover:text-ink">Fee proof <ArrowUpRight size={14} /></Link>
          </div>
        </nav>
      </aside>

      <div className="min-w-0">{children}</div>

      <aside className="hidden xl:block">
        <div className="sticky top-24">
          <div className="label mb-3">On this page</div>
          <ul className="space-y-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={`block text-[13px] leading-5 transition-colors duration-200 ${s.id === active ? 'text-ink' : 'text-faint hover:text-muted'}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

/** One-click copy for an address or hash. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) } catch {}
      }}
      aria-label={`${label} ${text}`}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      {done ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
    </button>
  )
}
