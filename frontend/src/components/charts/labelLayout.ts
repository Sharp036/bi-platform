/**
 * Shared label layout algorithm for ECharts data-point labels.
 *
 * Provides a greedy rectangle-packing placement that:
 *  - Prevents label overlap with a 4 px gap
 *  - Supports two search strategies (see spreadHorizontally)
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
 * @param getChartWidth     - returns current canvas width (used to clamp labels)
 * @param manualPositions   - optional map `"${seriesIndex}-${dataIndex}" → {x, y}`
 *                            for user-dragged positions; bypasses the auto algorithm
 * @param placementsRef     - optional mutable ref whose `.current` map is filled
 *                            with every placed label rect, keyed by the same string;
 *                            used for drag hit-detection
 * @param spreadHorizontally - when true, fills rows top-to-bottom first (labels spread
 *                             sideways, fewer vertical rows used); when false (default)
 *                             each label tries all rows directly above its anchor before
 *                             shifting horizontally (labels stay close to their data point)
 */
export function createCollisionFreeLayout(
  getChartWidth?: () => number,
  manualPositions?: Map<string, { x: number; y: number }>,
  placementsRef?: { current: Map<string, LabelPlacement> },
  spreadHorizontally?: boolean,
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

  function tryPlace(cx: number, baseY: number, lw: number, lh: number, key: string, anchorX: number, anchorY: number) {
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
    return null
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

    const offsetSteps = [0]
    for (let i = 1; i <= 6; i++) {
      offsetSteps.push(i * (lw + GAP))
      offsetSteps.push(-i * (lw + GAP))
    }

    if (spreadHorizontally) {
      // ── Spread mode ───────────────────────────────────────────────────────
      //
      // Outer loop = rows (top-down from y=8)
      // Inner loop = horizontal offsets (0, +lw, -lw, …)
      //
      // Labels fill the top row first, spreading sideways, then spill into
      // the next row. Results in fewer rows used but labels may shift away
      // from their anchor X.
      for (let row = 0; row < 20; row++) {
        const baseY = 8 + row * ROW_H
        for (const dx of offsetSteps) {
          // At offset=0 clamp to chart bounds; for other offsets skip if out of bounds
          let cx = anchorX + dx
          if (dx === 0 && chartW > 0) {
            cx = Math.max(lw / 2, Math.min(cx, chartW - lw / 2))
          } else {
            if (cx - lw / 2 < 0) continue
            if (chartW > 0 && cx + lw / 2 > chartW) continue
          }
          const result = tryPlace(cx, baseY, lw, lh, key, anchorX, anchorY)
          if (result) return result
        }
      }
    } else {
      // ── Anchor mode (default) ─────────────────────────────────────────────
      //
      // Outer loop = horizontal offsets (0, +lw, -lw, +2lw, -2lw, …)
      // Inner loop = rows (top-down from y=8)
      //
      // Each label tries all rows directly above its anchor before shifting
      // sideways, so labels stay as close as possible to their data points.
      //
      // At offset=0 we clamp to chart bounds instead of skipping — this
      // prevents right-edge labels (e.g. W09) from jumping far left.
      for (const dx of offsetSteps) {
        let cx = anchorX + dx
        if (dx === 0 && chartW > 0) {
          cx = Math.max(lw / 2, Math.min(cx, chartW - lw / 2))
        } else {
          if (cx - lw / 2 < 0) continue
          if (chartW > 0 && cx + lw / 2 > chartW) continue
        }
        for (let row = 0; row < 20; row++) {
          const baseY = 8 + row * ROW_H
          const result = tryPlace(cx, baseY, lw, lh, key, anchorX, anchorY)
          if (result) return result
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
