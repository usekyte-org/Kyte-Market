import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function NotFound() {
  return (
    <section className="flex min-h-[70dvh] flex-col items-start justify-center py-20">
      <Logo size={28} />
      <p className="mt-8 font-mono text-sm text-muted">404</p>
      <h1 className="mt-3 max-w-[680px] text-4xl text-balance md:text-5xl">This page is not on the chain.</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-muted">The address you followed does not exist. The market, your positions and the docs are one click away.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn btn-primary">Back to Kyte</Link>
        <Link href="/market" className="btn btn-ghost">Open the market</Link>
      </div>
    </section>
  )
}
