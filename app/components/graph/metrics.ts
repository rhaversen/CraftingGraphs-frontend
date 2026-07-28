import type { GraphModel, Metrics, SimParams } from './types'
import { computeEnergy } from './simulation'

interface Segment {
	id: string
	x1: number
	y1: number
	x2: number
	y2: number
}

export function computeMetrics(model: GraphModel, params: SimParams): Metrics {
	const { nodes, edges, nodeMap } = model
	const segments: Segment[] = []
	for (const e of edges) {
		const s = nodeMap.get(e.source)
		const t = nodeMap.get(e.target)
		if (!s || !t) continue
		segments.push({
			id: e.id,
			x1: s.x,
			y1: s.y,
			x2: t.x,
			y2: t.y,
		})
	}

	const crossingPairs: [string, string][] = []
	let crossings = 0
	for (let i = 0; i < segments.length; i++) {
		for (let j = i + 1; j < segments.length; j++) {
			if (sharesEndpoint(segments[i], segments[j])) continue
			if (segmentsIntersect(segments[i], segments[j])) {
				crossings++
				crossingPairs.push([segments[i].id, segments[j].id])
			}
		}
	}

	let directionViolations = 0
	for (const e of edges) {
		if (e.isBackEdge) continue // back edges flow right-to-left by nature
		const s = nodeMap.get(e.source)
		const t = nodeMap.get(e.target)
		if (!s || !t) continue
		if (t.x < s.x - 5) directionViolations++
	}

	let nodeOverlaps = 0
	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) {
			const dx = nodes[i].x - nodes[j].x
			const dy = nodes[i].y - nodes[j].y
			const dist = Math.sqrt(dx * dx + dy * dy)
			if (dist < nodes[i].radius + nodes[j].radius) nodeOverlaps++
		}
	}

	const lengths: number[] = []
	for (const e of edges) {
		const s = nodeMap.get(e.source)
		const t = nodeMap.get(e.target)
		if (!s || !t) continue
		const dx = t.x - s.x
		const dy = t.y - s.y
		lengths.push(Math.sqrt(dx * dx + dy * dy))
	}
	const avgEdgeLength = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0
	const stddevEdgeLength = lengths.length
		? Math.sqrt(lengths.reduce((a, b) => a + (b - avgEdgeLength) ** 2, 0) / lengths.length)
		: 0
	const maxEdgeLength = lengths.length ? Math.max(...lengths) : 0
	const minEdgeLength = lengths.length ? Math.min(...lengths) : 0

	const congestion = computeCongestion(nodes, edges, nodeMap)
	const energy = computeEnergy(model)

	return {
		crossings,
		crossingPairs,
		directionViolations,
		nodeOverlaps,
		avgEdgeLength,
		stddevEdgeLength,
		maxEdgeLength,
		minEdgeLength,
		congestion,
		energy,
		alpha: params.alpha,
		tick: 0,
		converged: params.alpha <= params.alphaMin,
	}
}

function sharesEndpoint(a: Segment, b: Segment): boolean {
	if (a.id === b.id) return true
	const samePoint = (x1: number, y1: number, x2: number, y2: number) =>
		Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5
	return (
		samePoint(a.x1, a.y1, b.x1, b.y1) ||
		samePoint(a.x1, a.y1, b.x2, b.y2) ||
		samePoint(a.x2, a.y2, b.x1, b.y1) ||
		samePoint(a.x2, a.y2, b.x2, b.y2)
	)
}

function segmentsIntersect(a: Segment, b: Segment): boolean {
	const d1 = cross(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1)
	const d2 = cross(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)
	const d3 = cross(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1)
	const d4 = cross(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)

	if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
		return true
	}
	return false
}

function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
	return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function computeCongestion(
	nodes: { x: number; y: number; radius: number }[],
	edges: { source: string; target: string }[],
	nodeMap: Map<string, { x: number; y: number }>,
): number {
	if (nodes.length === 0) return 0
	let minX = Infinity
	let maxX = -Infinity
	let minY = Infinity
	let maxY = -Infinity
	for (const n of nodes) {
		minX = Math.min(minX, n.x)
		maxX = Math.max(maxX, n.x)
		minY = Math.min(minY, n.y)
		maxY = Math.max(maxY, n.y)
	}
	const w = maxX - minX || 1
	const h = maxY - minY || 1
	const cellSize = 80
	const cols = Math.max(1, Math.ceil(w / cellSize))
	const rows = Math.max(1, Math.ceil(h / cellSize))
	const grid = new Float32Array(cols * rows)

	for (const e of edges) {
		const s = nodeMap.get(e.source)
		const t = nodeMap.get(e.target)
		if (!s || !t) continue
		const steps = 10
		for (let i = 0; i <= steps; i++) {
			const x = s.x + ((t.x - s.x) * i) / steps
			const y = s.y + ((t.y - s.y) * i) / steps
			const col = Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cellSize)))
			const row = Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cellSize)))
			grid[row * cols + col]++
		}
	}

	let maxCell = 0
	let total = 0
	for (let i = 0; i < grid.length; i++) {
		maxCell = Math.max(maxCell, grid[i])
		total += grid[i]
	}
	return total > 0 ? maxCell / (total / grid.length) : 0
}
