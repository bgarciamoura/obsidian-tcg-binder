import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { t } from '../i18n'
import type { PortfolioSnapshot } from '../services/portfolio-history'
import type TcgBinderPlugin from '../main'

interface PortfolioChartProps {
	plugin: TcgBinderPlugin
	/** Bump to re-read the history file (e.g. after a price update). */
	refresh: number
}

const W = 600
const H = 200
const PAD = { left: 48, right: 16, top: 16, bottom: 22 }

/**
 * Single-series line chart of portfolio value over time. Uses the theme's
 * accent for the series and text tokens for all labels; a data table is
 * available as the non-visual fallback.
 */
export function PortfolioChart({ plugin, refresh }: PortfolioChartProps) {
	const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])
	const [hover, setHover] = useState<number | null>(null)

	useEffect(() => {
		let cancelled = false
		void plugin.portfolio.read().then((history) => {
			if (!cancelled) setSnapshots(history)
		})
		return () => {
			cancelled = true
		}
	}, [plugin, refresh])

	const geometry = useMemo(() => {
		if (snapshots.length < 2) return null
		const times = snapshots.map((s) => Date.parse(s.date))
		const values = snapshots.map((s) => s.value)
		const tMin = Math.min(...times)
		const tMax = Math.max(...times)
		let vMin = Math.min(...values)
		let vMax = Math.max(...values)
		if (vMin === vMax) {
			// Flat series — open the scale so the line is not glued to an edge.
			vMin = vMin * 0.9
			vMax = vMax * 1.1 || 1
		}
		const innerW = W - PAD.left - PAD.right
		const innerH = H - PAD.top - PAD.bottom
		const points = snapshots.map((s, i) => ({
			x: PAD.left + ((times[i] - tMin) / (tMax - tMin)) * innerW,
			y: PAD.top + (1 - (s.value - vMin) / (vMax - vMin)) * innerH,
			snapshot: s,
		}))
		return { points, vMin, vMax }
	}, [snapshots])

	if (!geometry) return null
	const { points, vMin, vMax } = geometry
	const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
	const last = points[points.length - 1]
	const gridYs = [PAD.top, PAD.top + (H - PAD.top - PAD.bottom) / 2, H - PAD.bottom]
	const gridValues = [vMax, (vMax + vMin) / 2, vMin]

	const onMove = (e: MouseEvent<SVGSVGElement>) => {
		const rect = e.currentTarget.getBoundingClientRect()
		const x = ((e.clientX - rect.left) / rect.width) * W
		let nearest = 0
		for (let i = 1; i < points.length; i++) {
			if (Math.abs(points[i].x - x) < Math.abs(points[nearest].x - x)) nearest = i
		}
		setHover(nearest)
	}

	return (
		<section className="tcgb-chart-section">
			<h3>{t('chart.title')}</h3>
			<div className="tcgb-chart-wrap">
				<svg
					className="tcgb-chart"
					viewBox={`0 0 ${W} ${H}`}
					role="img"
					aria-label={t('chart.title')}
					onMouseMove={onMove}
					onMouseLeave={() => setHover(null)}
				>
					{gridYs.map((y, i) => (
						<g key={i}>
							<line className="tcgb-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} />
							<text className="tcgb-chart-label" x={PAD.left - 6} y={y + 3} textAnchor="end">
								${Math.round(gridValues[i])}
							</text>
						</g>
					))}
					<text className="tcgb-chart-label" x={PAD.left} y={H - 6}>
						{snapshots[0].date}
					</text>
					<text className="tcgb-chart-label" x={W - PAD.right} y={H - 6} textAnchor="end">
						{snapshots[snapshots.length - 1].date}
					</text>
					<path className="tcgb-chart-line" d={path} />
					<circle className="tcgb-chart-dot" cx={last.x} cy={last.y} r={4} />
					<text className="tcgb-chart-value" x={last.x - 6} y={last.y - 8} textAnchor="end">
						${last.snapshot.value.toFixed(2)}
					</text>
					{hover !== null && (
						<g>
							<line
								className="tcgb-chart-crosshair"
								x1={points[hover].x}
								x2={points[hover].x}
								y1={PAD.top}
								y2={H - PAD.bottom}
							/>
							<circle className="tcgb-chart-dot" cx={points[hover].x} cy={points[hover].y} r={4} />
						</g>
					)}
				</svg>
				{hover !== null && (
					<div
						className="tcgb-chart-tooltip"
						style={{ left: `${(points[hover].x / W) * 100}%` }}
					>
						{points[hover].snapshot.date} · ${points[hover].snapshot.value.toFixed(2)}
					</div>
				)}
			</div>
			<details className="tcgb-chart-table">
				<summary>{t('chart.table')}</summary>
				<table className="tcgb-table">
					<tbody>
						{snapshots.map((s) => (
							<tr key={s.date}>
								<td>{s.date}</td>
								<td>${s.value.toFixed(2)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</section>
	)
}
