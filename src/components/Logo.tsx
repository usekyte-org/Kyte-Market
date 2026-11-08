// Kyte logo: the "Kyte" wordmark lifted out of the brand mark (public/brand/kyte-wordmark.png, 344x124).
// `size` is the rendered height in px; the width follows the image's ratio.
export function Logo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/kyte-wordmark.png"
      alt="Kyte"
      width={344}
      height={124}
      draggable={false}
      className={`inline-block w-auto shrink-0 select-none ${className}`}
      style={{ height: size }}
    />
  )
}
