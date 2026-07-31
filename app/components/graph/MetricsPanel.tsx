'use client'

import type { Metrics } from './types'

interface MetricsPanelProps {
	metrics: Metrics | null
	visible: boolean
}

export function MetricsPanel({ metrics, visible }: MetricsPanelProps) {
	if (!visible || !metrics) return null
	return (
		<div className="absolute left-3 bottom-3 z-10 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 p-3 text-xs shadow-lg backdrop-blur-sm">
			<div className="mb-2 font-semibold text-gray-700 dark:text-gray-300">Metrics</div>
			<div className="space-y-1 font-mono">
				<MetricRow label="Crossings" value={metrics.crossings} warn={metrics.crossings > 0} />
				<MetricRow label="Dir. violations" value={metrics.directionViolations} warn={metrics.directionViolations > 0} />
				<MetricRow label="Node overlaps" value={metrics.nodeOverlaps} warn={metrics.nodeOverlaps > 0} />
				<MetricRow label="Avg edge len" value={metrics.avgEdgeLength.toFixed(0)} warn={false} />
				<MetricRow label="Std edge len" value={metrics.stddevEdgeLength.toFixed(0)} warn={metrics.stddevEdgeLength > 100} />
				<MetricRow label="Max edge len" value={metrics.maxEdgeLength.toFixed(0)} warn={metrics.maxEdgeLength > 500} />
				<MetricRow label="Congestion" value={metrics.congestion.toFixed(2)} warn={metrics.congestion > 3} />
			</div>
		</div>
	)
}

function MetricRow({ label, value, warn }: { label: string; value: string | number; warn: boolean }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-gray-500 dark:text-gray-400">{label}</span>
			<span className={warn ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}>{value}</span>
		</div>
	)
}
