/**
 * Shared label layout algorithm for ECharts data-point labels.
 *
 * Provides a greedy rectangle-packing placement that:
 *  - Keeps every label as close to its anchor X as possible (offset=0 tried across
 *    all rows before trying ±1 label-width, then ±2, etc.)
 *  - Prevents label overlap with a 4 px gap
 *  - Supports manual (user-dragged) position overrides
 *  - Writes placed rects back to a ref for drag hit-detection
 */

export interface LabelPlacement {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Creates a top-level labelLayout callback for ECharts.
 *
 * @param getChartWidth  - returns current canvas width (used to clamp labels)
 * @param manualPositions - optional map `"${seriesIndex}-${dataIndex}" → {x, y}`
 *                          for user-dragged positions; bypasses the auto algorithm
 * @param placementsRef  - optional mutable ref whose `.current` map is filled
 *                         with every placed label rect, keyed by the same string;
 *                         used for drag hit-detection
 */
export function createCollisionFreeLayout(
  getChartWidth?: () => number,
  manualPositions?: Map<string, { x: number; y: number }>,
  placementsRef?: { current: Map<string, LabelPlacement> },
) {
  const placed: (LabelPlacement & { key: string })[] = []
  let lastTs = 0
  const GAP = 4

  function collides(r: LabelPlacement) {
    return placed.some(
      p =>
        r.x1 < p.x2 + GAP &&
        r.x2 > p.x1 - GAP &&
        r.y1 < p.y2 + GAP &&
        r.y2 > p.y1 - GAP,
    )
  }

  return (params: {
    rect?: { x: number; y: number; width: number; height: number }
    labelRect?: { x: number; y: number; width: number; height: number }
    dataIndex: number
    seriesIndex: number
  }) => {
    // Reset placement tracking on each new layout pass (gap > 50 ms between calls)
    const now = Date.now()
    if (now - lastTs > 50) {
      placed.length = 0
      placementsRef?.current.clear()
    }
    lastTs = now

    const { rect, labelRect, dataIndex, seriesIndex } = params
    if (!rect || !labelRect || labelRect.width < 1) return {}

    const anchorX = rect.x + rect.width / 2
    const anchorY = rect.y
    const lw = labelRect.width
    const lh = labelRect.height
    const ROW_H = lh + GAP
    const chartW = getChartWidth?.() ?? 0
    const key = `${seriesIndex}-${dataIndex}`

    // ── Manual override (user drag) ──────────────────────────────────────────
    const manual = manualPositions?.get(key)
    if (manual) {
      const r: LabelPlacement & { key: string } = {
        x1: manual.x - lw / 2,
        y1: manual.y,
        x2: manual.x + lw / 2,
        y2: manual.y + lh,
        key,
      }
      placed.push(r)
      placementsRef?.current.set(key, r)
      return {
        x: manual.x,
        y: manual.y,
        align: 'center' as const,
        verticalAlign: 'top' as const,
        labelLinePoints: [
          [manual.x, manual.y + lh],
          [anchorX, anchorY],
        ],
      }
    }

    // ── Auto algorithm ───────────────────────────────────────────────────────
    //
    // Outer loop = horizontal offsets (0, +lw, -lw, +2lw, -2lw, …)
    // Inner loop = rows (top-down from y=8)
    //
    // This ensures a label tries to stay directly above its anchor across ALL
    // available rows before shifting sideways, so left-to-right ordering of
    // labels mirrors the left-to-right order of the data points.

    const offsetSteps = [0]
    for (let i = 1; i <= 6; i++) {
      offsetSteps.push(i * (lw + GAP))
      offsetSteps.push(-i * (lw + GAP))
    }

    for (const dx of offsetSteps) {
      const cx = anchorX + dx
      // Quick bounds check before scanning all rows
      if (cx - lw / 2 < 0) continue
      if (chartW > 0 && cx + lw / 2 > chartW) continue

      for (let row = 0; row < 20; row++) {
        const baseY = 8 + row * ROW_H
        const candidate: LabelPlacement = {
          x1: cx - lw / 2,
          y1: baseY,
          x2: cx + lw / 2,
          y2: baseY + lh,
        }
        if (!collides(candidate)) {
          const entry = { ...candidate, key }
          placed.push(entry)
          placementsRef?.current.set(key, entry)
          return {
            x: cx,
            y: baseY,
            align: 'center' as const,
            verticalAlign: 'top' as const,
            labelLinePoints: [
              [cx, baseY + lh],
              [anchorX, anchorY],
            ],
          }
        }
      }
    }

    // ── Fallback ─────────────────────────────────────────────────────────────
    const y = 8 + placed.length * ROW_H
    const clampedX =
      chartW > 0 ? Math.max(lw / 2, Math.min(anchorX, chartW - lw / 2)) : anchorX
    const fallback: LabelPlacement & { key: string } = {
      x1: clampedX - lw / 2,
      y1: y,
      x2: clampedX + lw / 2,
      y2: y + lh,
      key,
    }
    placed.push(fallback)
    placementsRef?.current.set(key, fallback)
    return {
      x: clampedX,
      y,
      align: 'center' as const,
      verticalAlign: 'top' as const,
      labelLinePoints: [
        [clampedX, y + lh],
        [anchorX, anchorY],
      ],
    }
  }
}
