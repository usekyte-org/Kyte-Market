export function eth(n: number, digits = 4): string {
  if (n === 0) return '0 ETH'
  if (n < 10 ** -digits) return `<${10 ** -digits} ETH`
  return `${n.toLocaleString('en-US', { maximumFractionDigits: digits })} ETH`
}

export function num(n: number, digits = 2): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits })
}

export function compact(n: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

/** "3d 4h", "5h 12m", "18m". Negative → "ended". */
export function timeLeft(unixSec: number, now = Date.now() / 1000): string {
  const s = Math.floor(unixSec - now)
  if (s <= 0) return 'ended'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function date(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function bps(b: number): string {
  return `${b / 100}%`
}
