'use client'

import {
  AreaSeries, ColorType, createChart, createSeriesMarkers, CrosshairMode, HistogramSeries, LastPriceAnimationMode, LineStyle, LineType,
  type IChartApi, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type Time, type UTCTimestamp,
} from 'lightweight-charts'
import { memo, useEffect, useRef } from 'react'
import { useCandles, useMarkers, type Candle } from '@/lib/data'

export type PriceLine = { price: number; title: string; color?: string; dashed?: boolean }

const UP = '#4dfca9'
const DOWN = '#ff6b6b'
const MAX_BARS = 600

/**
 * The indexer only returns buckets that had a trade (or quote). Make it a real time series: every bucket opens at
 * the previous close and quiet buckets (up to the current one) are flat zero-volume points, so the x axis is
 * linear in time and a thin pool still reads as a line. Keeps the most recent MAX_BARS.
 */
export function continuous(raw: Candle[], interval: number, now = Date.now() / 1000): Candle[] {
  if (!raw.length) return []
  const end = Math.max(raw.at(-1)!.time, Math.floor(now / interval) * interval)
  const start = Math.max(raw[0].time, end - (MAX_BARS - 1) * interval)
  let i = 0
  let prev = raw[0].open
  while (i < raw.length && raw[i].time < start) prev = raw[i++].close
  const out: Candle[] = []
  for (let t = start; t <= end; t += interval) {
    const c = raw[i]?.time === t ? raw[i++] : null
    if (c) {
      const open = out.length || raw[0].time < start ? prev : c.open
      out.push({ time: t, open, high: Math.max(c.high, open), low: Math.min(c.low, open), close: c.close, volume: c.volume })
      prev = c.close
    } else out.push({ time: t, open: prev, high: prev, low: prev, close: prev, volume: 0 })
  }
  return out
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/**
 * TradingView Lightweight Charts: a smooth, live price line (Uniswap v4 swaps or Robinhood quotes, via the
 * indexer) with volume, optional price lines (strikes, break even) and markers for every option event
 * (listed, bought, exercised, expired, cancelled). New points are appended in place, so the line glides
 * forward instead of redrawing.
 */
export const TokenChart = memo(function TokenChart({
  symbol,
  interval = 60,
  lines = [],
  height = 320,
  showMarkers = true,
  className = '',
}: {
  symbol: string
  interval?: number
  lines?: PriceLine[]
  height?: number
  showMarkers?: boolean
  className?: string
}) {
  const candles = useCandles(symbol, interval)
  const markers = useMarkers(symbol)
  const box = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const series = useRef<ISeriesApi<'Area'> | null>(null)
  const volume = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markerApi = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const priceLines = useRef<IPriceLine[]>([])
  const shown = useRef<Candle[]>([])
  const fitted = useRef(false)

  // A new token starts with a fresh view instead of the previous token's zoom.
  useEffect(() => {
    fitted.current = false
    shown.current = []
  }, [symbol])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const c = createChart(el, {
      height,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9b9b9b', fontFamily: 'ui-monospace, monospace', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: '#1a1a1a' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: interval < 60, rightOffset: 4 },
      crosshair: {
        mode: CrosshairMode.Magnet,
        horzLine: { color: '#3a3a3a', labelBackgroundColor: '#272727' },
        vertLine: { color: '#3a3a3a', labelBackgroundColor: '#272727', style: LineStyle.Dotted },
      },
      localization: { priceFormatter: (p: number) => p.toPrecision(4) },
      // Pointer over the chart: the wheel zooms (and shift/trackpad sideways pans) the chart, not the page.
      // Pointer anywhere else: the page scrolls as usual. Touch: vertical swipes still scroll the page.
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    })
    series.current = c.addSeries(AreaSeries, {
      lineType: LineType.Curved,
      lineWidth: 2,
      lineColor: UP,
      topColor: rgba(UP, 0.28),
      bottomColor: rgba(UP, 0),
      lastPriceAnimation: LastPriceAnimationMode.Continuous,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#0b0b0b',
      priceLineStyle: LineStyle.Dotted,
      priceFormat: { type: 'price', precision: 8, minMove: 1e-8 },
    })
    volume.current = c.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false })
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })
    markerApi.current = createSeriesMarkers(series.current, [])
    chart.current = c
    const ro = new ResizeObserver(() => c.applyOptions({ width: el.clientWidth }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      c.remove()
      chart.current = null
      series.current = null
      volume.current = null
      markerApi.current = null
      priceLines.current = []
      shown.current = []
      fitted.current = false
    }
  }, [height, interval])

  // Price + volume. Same history with a moved or new last bucket: update() it, so the line extends smoothly.
  useEffect(() => {
    const s = series.current
    const v = volume.current
    if (!s || !v || candles.isPlaceholderData) return
    const data = continuous(candles.data ?? [], interval)
    const point = (d: Candle) => ({ time: d.time as UTCTimestamp, value: d.close })
    const bar = (d: Candle) => ({ time: d.time as UTCTimestamp, value: d.volume, color: rgba(d.close >= d.open ? UP : DOWN, 0.25) })

    const first = data[0]?.close ?? 0
    const last = data.at(-1)?.close ?? 0
    const color = last >= first ? UP : DOWN
    s.applyOptions({ lineColor: color, topColor: rgba(color, 0.28), bottomColor: rgba(color, 0) })
    if (last > 0) {
      // 4 significant digits whatever the token's price scale (0.00004 ETH or 0.3 ETH)
      const precision = Math.min(10, Math.max(2, Math.ceil(-Math.log10(last)) + 3))
      s.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } })
    }

    // The last bucket moved or a new one opened: update() just those, so the line extends smoothly.
    const prevLast = shown.current.at(-1)?.time
    const from = prevLast === undefined ? -1 : data.findIndex((d) => d.time === prevLast)
    if (from >= 0 && data.length - from <= 3) {
      for (let i = from; i < data.length; i++) {
        s.update(point(data[i]))
        v.update(bar(data[i]))
      }
    } else {
      s.setData(data.map(point))
      v.setData(data.map(bar))
    }
    shown.current = data
    if (!fitted.current && data.length) {
      chart.current?.timeScale().fitContent()
      fitted.current = true
    }
    // interval/height: the chart is rebuilt on those, so the new one needs data, lines and markers again
  }, [candles.data, candles.isPlaceholderData, interval, height])

  // Strike / break-even lines, kept inside the visible range.
  useEffect(() => {
    const s = series.current
    if (!s) return
    priceLines.current.forEach((l) => s.removePriceLine(l))
    priceLines.current = lines.map((l) =>
      s.createPriceLine({ price: l.price, color: l.color ?? '#9b9b9b', lineWidth: 1, lineStyle: l.dashed === false ? LineStyle.Solid : LineStyle.Dashed, axisLabelVisible: true, title: l.title }),
    )
    const prices = lines.map((l) => l.price).filter((p) => p > 0)
    s.applyOptions({
      autoscaleInfoProvider: (original: () => { priceRange: { minValue: number; maxValue: number }; margins?: { above: number; below: number } } | null) => {
        const r = original()
        if (!r || !prices.length) return r
        return { priceRange: { minValue: Math.min(r.priceRange.minValue, ...prices), maxValue: Math.max(r.priceRange.maxValue, ...prices) }, margins: r.margins }
      },
    })
  }, [lines, interval, height])

  // Every option event as a marker, snapped to the nearest bucket on the line (markers need a matching time).
  useEffect(() => {
    const api = markerApi.current
    if (!api) return
    const data = continuous(candles.data ?? [], interval)
    if (!showMarkers || !data.length) return api.setMarkers([])
    const times = data.map((d) => d.time)
    const snap = (t: number) => {
      let lo = 0, hi = times.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (times[mid] <= t) lo = mid
        else hi = mid - 1
      }
      return times[lo]
    }
    const ms: SeriesMarker<Time>[] = (markers.data ?? [])
      .filter((m) => m.time >= times[0] - interval)
      .map((m): SeriesMarker<Time> => {
        const time = snap(m.time) as UTCTimestamp
        const tone = m.kind === 'call' ? UP : '#05edfa'
        switch (m.name) {
          case 'OptionBought': return { time, position: 'belowBar', color: UP, shape: 'arrowUp', text: `buy ${m.kind}` }
          case 'Exercised': return { time, position: 'aboveBar', color: DOWN, shape: 'arrowDown', text: 'exercised' }
          case 'Expired': return { time, position: 'aboveBar', color: '#9b9b9b', shape: 'square', text: 'expired' }
          case 'OfferCancelled': return { time, position: 'aboveBar', color: '#6b6b6b', shape: 'circle', text: 'cancel' }
          default: return { time, position: 'belowBar', color: tone, shape: 'circle', text: `${m.kind} listed` }
        }
      })
      .sort((a, b) => (a.time as number) - (b.time as number))
    api.setMarkers(ms)
  }, [markers.data, candles.data, showMarkers, interval, height])

  const empty = !candles.isLoading && (candles.data?.length ?? 0) === 0
  return (
    <div className={`relative ${className}`}>
      {/* data-lenis-prevent-wheel: the smooth scroller leaves wheel events over the chart to the chart */}
      <div
        ref={box}
        data-lenis-prevent-wheel
        className="w-full overscroll-contain"
        style={{ height }}
        onDoubleClick={() => chart.current?.timeScale().fitContent()}
        title="Scroll to zoom · drag to pan · double-click to reset"
      />
      <p className="pointer-events-none absolute left-3 top-2 hidden font-mono text-[10px] uppercase tracking-wider text-muted/70 md:block">
        scroll to zoom · drag to pan · double-click to reset
      </p>
      {candles.isLoading && <div className="shimmer absolute inset-0 rounded-lg" />}
      {empty && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted">
          No price feed for {symbol} yet. The line starts with the first Uniswap v4 swap or market quote.
        </div>
      )}
    </div>
  )
})
