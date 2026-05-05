/**
 * Shared value formatter used by EChartWidget axis labels, MultiLayerChart and
 * KpiCard. Returns undefined when the format is "plain" with no explicit
 * decimals - callers fall back to their default rendering (e.g. toLocaleString
 * without options) so values that look fine raw are not over-formatted.
 *
 * Supported formats:
 *   plain      - `1234.56` -> `"1,234.56"` (only when decimals set; else undef)
 *   thousands  - `1234`    -> `"1.2K"`
 *   millions   - `1234567` -> `"1.2M"`
 *   billions   - `1234567890` -> `"1.2B"`
 *   currency   - `42`      -> `"$42.00"` (currency code from second arg)
 *   percent    - `0.42`    -> `"42.0%"` (multiplies by 100)
 */

export function defaultAxisDecimals(format: string): number {
  if (format === 'currency') return 0
  if (format === 'percent') return 1
  if (format === 'thousands' || format === 'millions' || format === 'billions') return 1
  return 0
}

export function buildValueFormatter(
  format: string,
  currency: string,
  decimals?: number,
): ((value: number) => string) | undefined {
  const d = Math.max(
    0,
    Math.min(6, Number.isFinite(Number(decimals)) ? Number(decimals) : defaultAxisDecimals(format)),
  )
  switch (format) {
    case 'thousands':
      return (v: number) => (v / 1000).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + 'K'
    case 'millions':
      return (v: number) => (v / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + 'M'
    case 'billions':
      return (v: number) => (v / 1_000_000_000).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + 'B'
    case 'currency':
      return (v: number) => v.toLocaleString(undefined, { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d })
    case 'percent':
      return (v: number) => (v * 100).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'
    case 'plain':
      return decimals != null
        ? (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
        : undefined
    default:
      return undefined
  }
}
