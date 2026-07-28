import type { GraphModel, SimNode, SimParams } from './types'

export function tick(model: GraphModel, params: SimParams): void {
	const { nodes, edges, nodeMap, adjacency, reverseAdjacency } = model
	const alpha = params.alpha

	// Velocity decay (friction) â€” applied to previous velocity
	for (const n of nodes) {
		n.vx *= params.velocityDecay
		n.vy *= params.velocityDecay
	}

	// 1. Pairwise repulsion (inverse-square) + collision overlap resolution
	for (let i = 0; i < nodes.length; i++) {
		const a = nodes[i]
		for (let j = i + 1; j < nodes.length; j++) {
			const b = nodes[j]
			const dx = a.x - b.x
			const dy = a.y - b.y
			let dist2 = dx * dx + dy * dy
			if (dist2 < 0.01) dist2 = 0.01
			const dist = Math.sqrt(dist2)
			const minDist = a.radius + b.radius + 20
			const force = (params.repulsion * alpha) / dist2
			const fx = (dx / dist) * force
			const fy = (dy / dist) * force
			a.vx += fx
			a.vy += fy
			b.vx -= fx
			b.vy -= fy
			// Hard collision separation
			if (dist < minDist) {
				const overlap = (minDist - dist) * 0.5
				const ox = (dx / dist) * overlap * 0.5
				const oy = (dy / dist) * overlap * 0.5
				a.vx += ox
				a.vy += oy
				b.vx -= ox
				b.vy -= oy
			}
		}
	}

	// 2. Spring force along edges (attraction toward springLength)
	for (const edge of edges) {
		const s = nodeMap.get(edge.source)
		const t = nodeMap.get(edge.target)
		if (!s || !t) continue
		const dx = t.x - s.x
		const dy = t.y - s.y
		const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
		const diff = dist - params.springLength
		const force = params.springStrength * diff * alpha
		const fx = (dx / dist) * force
		const fy = (dy / dist) * force
		s.vx += fx
		s.vy += fy
		t.vx -= fx
		t.vy -= fy
	}

	// 3. Level force â€” pull each node's x toward its topological level slot.
	// This is a structural constraint, NOT a thermal force, so it does NOT
	// scale with alpha. Keeping it alpha-independent prevents nodes from
	// drifting out of their columns as the simulation cools, which is what
	// caused the "blob" collapse: as alpha decayed, springs (which also
	// decay) left nodes with no restoring force, so gravity and barycenter
	// pulled everything toward center. With a constant level force, nodes
	// always snap back to their assigned x-column.
	const levelSpacing = params.levelSpacing
	const maxLevel = model.maxLevel
	const levelOffset = (maxLevel * levelSpacing) / 2
	for (const n of nodes) {
		if (n.fx !== null) continue
		const idealX = n.level * levelSpacing - levelOffset
		n.vx += (idealX - n.x) * params.levelStrength
	}

	// 4. Directional flow force â€” enforce left-to-right ordering.
	// For each forward edge, if the target is not to the right of the source
	// by at least `gap`, push both endpoints apart (source left, target right).
	// Back edges (cycles) are skipped â€” they flow right-to-left by nature.
	for (const edge of edges) {
		if (edge.isBackEdge) continue
		const s = nodeMap.get(edge.source)
		const t = nodeMap.get(edge.target)
		if (!s || !t) continue
		const gap = params.springLength * 0.5
		const violation = gap - (t.x - s.x)
		if (violation > 0) {
			const push = violation * params.flowStrength * alpha
			s.vx -= push
			t.vx += push
		}
	}

	// 5. Barycenter y-force â€” pull each node's y toward the weighted average
	// y of its neighbors. Forward-edge neighbors get double weight (they
	// define the desired left-to-right flow), back-edge neighbors get half
	// weight (they're structural but shouldn't dominate). This aligns
	// connected nodes vertically and reduces crossings.
	// Build a set of back-edge node pairs for O(1) lookup.
	const backEdgePairs = new Set<string>()
	for (const e of edges) {
		if (e.isBackEdge) backEdgePairs.add(`${e.source}->${e.target}`)
	}
	for (const n of nodes) {
		const incoming = reverseAdjacency.get(n.id)
		const outgoing = adjacency.get(n.id)
		let sumY = 0
		let weight = 0
		if (incoming) {
			for (const id of incoming) {
				const nb = nodeMap.get(id)
				if (nb) {
					const isBack = backEdgePairs.has(`${id}->${n.id}`)
					const w = isBack ? 0.3 : 1.3
					sumY += nb.y * w
					weight += w
				}
			}
		}
		if (outgoing) {
			for (const id of outgoing) {
				const nb = nodeMap.get(id)
				if (nb) {
					const isBack = backEdgePairs.has(`${n.id}->${id}`)
					const w = isBack ? 0.0 : 1.3
					sumY += nb.y * w
					weight += w
				}
			}
		}
		if (weight > 0) {
			const avgY = sumY / weight
			n.vy += (avgY - n.y) * params.barycenterStrength * alpha
		}
	}

	// 6. Centering force â€” pull toward origin to keep graph centered
	for (const n of nodes) {
		n.vx += -n.x * params.gravity * alpha
		n.vy += -n.y * params.gravity * alpha
	}

	// 7. Edge crossing penalty â€” for each pair of edges that cross (and
	// don't share an endpoint), apply a vertical repulsion to push the
	// endpoints apart, reducing future crossings. The force is proportional
	// to how "entangled" the crossing is (measured by the vertical overlap
	// of the two edge spans). Only runs at higher alpha to avoid wasted work.
	if (alpha > 0.03 && edges.length < 150) {
		const segs = edges.map((e) => {
			const s = nodeMap.get(e.source)!
			const t = nodeMap.get(e.target)!
			return { e, s, t }
		})
		for (let i = 0; i < segs.length; i++) {
			const a = segs[i]
			for (let j = i + 1; j < segs.length; j++) {
				const b = segs[j]
				if (
					a.e.source === b.e.source || a.e.source === b.e.target ||
					a.e.target === b.e.source || a.e.target === b.e.target
				) continue
				if (!edgesCross(a.s, a.t, b.s, b.t)) continue
				// Determine which endpoints to move. The key insight: to
				// uncross two edges, we need to swap the vertical ordering
				// of their endpoints on at least one side (left or right).
				// Push the source endpoints apart and the target endpoints
				// apart, in the direction that would uncross them.
				const aS = a.s, aT = a.t, bS = b.s, bT = b.t
				// On the left side (sources): if aS is above bS but aT is below
				// bT, the edges cross. We want to push aS further up and bS
				// further down (or vice versa) to undo the crossing.
				const leftDir = aS.y < bS.y ? 1 : -1
				const rightDir = aT.y < bT.y ? 1 : -1
				// Only push if the directions disagree (which is why they cross)
				const entangled = leftDir !== rightDir
				const pen = params.crossingPenalty * alpha * (entangled ? 1.5 : 1.0)
				// Push sources apart vertically
				aS.vy -= leftDir * pen
				bS.vy += leftDir * pen
				// Push targets apart vertically
				aT.vy -= rightDir * pen
				bT.vy += rightDir * pen
			}
		}
	}

	// 8. Integrate positions (respect pinned nodes)
	for (const n of nodes) {
		if (n.fx !== null) {
			n.x = n.fx
			n.vx = 0
		} else {
			n.x += n.vx
		}
		if (n.fy !== null) {
			n.y = n.fy
			n.vy = 0
		} else {
			n.y += n.vy
		}
	}

	// 9. Position-based collision resolution â€” directly separate
	// overlapping nodes. This is stronger than velocity-based resolution
	// because it doesn't get damped by velocityDecay. Run 3 iterations for
	// better convergence in dense graphs. Use generous padding (30px) so
	// nodes stay well separated and the graph remains readable.
	for (let iter = 0; iter < 3; iter++) {
		for (let i = 0; i < nodes.length; i++) {
			const a = nodes[i]
			for (let j = i + 1; j < nodes.length; j++) {
				const b = nodes[j]
				const dx = a.x - b.x
				const dy = a.y - b.y
				let dist2 = dx * dx + dy * dy
				const minDist = a.radius + b.radius + 30
				if (dist2 < minDist * minDist) {
					if (dist2 < 0.01) dist2 = 0.01
					const dist = Math.sqrt(dist2)
					const overlap = (minDist - dist) * 0.5
					// Prefer spreading in y (x is constrained by level force)
					const oy = (dy / dist) * overlap
					const ox = (dx / dist) * overlap * 0.2
					if (a.fx === null) a.x += ox
					if (a.fy === null) a.y += oy
					if (b.fx === null) b.x -= ox
					if (b.fy === null) b.y -= oy
				}
			}
		}
	}
}

export function computeEnergy(model: GraphModel): number {
	let energy = 0
	for (const n of model.nodes) {
		energy += n.vx * n.vx + n.vy * n.vy
	}
	return energy
}

function edgesCross(
	a: { x: number; y: number },
	b: { x: number; y: number },
	c: { x: number; y: number },
	d: { x: number; y: number },
): boolean {
	const cross2 = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
		(bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
	const d1 = cross2(c.x, c.y, d.x, d.y, a.x, a.y)
	const d2 = cross2(c.x, c.y, d.x, d.y, b.x, b.y)
	const d3 = cross2(a.x, a.y, b.x, b.y, c.x, c.y)
	const d4 = cross2(a.x, a.y, b.x, b.y, d.x, d.y)
	return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/**
 * Crossing-reduction post-processing (Sugiyama-style barycenter reordering).
 * Groups nodes by level, then within each level reorders nodes by the
 * median y of their incoming neighbors (downward pass) or outgoing neighbors
 * (upward pass). Reassigns y positions evenly within each level while
 * preserving the new order. Run this when the simulation has largely
 * converged to clean up remaining crossings.
 *
 * After each full round of passes, counts actual edge crossings. If the
 * count didn't improve, reverts to the best-known ordering and stops early.
 */
export function reduceCrossings(model: GraphModel, passes = 6): void {
	const byLevel = new Map<number, SimNode[]>()
	for (const n of model.nodes) {
		const arr = byLevel.get(n.level) ?? []
		arr.push(n)
		byLevel.set(n.level, arr)
	}
	const levels = [...byLevel.keys()].sort((a, b) => a - b)

	// Save initial y positions so we can revert if needed
	const bestYs = new Map<string, number>()
	for (const n of model.nodes) bestYs.set(n.id, n.y)
	let bestPenalty = countPenalties(model)

	// Barycenter rounds with patience: allow a few non-improving rounds
	// before stopping, since barycenter can need multiple rounds to escape
	// local minima before the local search cleans up.
	const maxRounds = 8
	const patience = 3
	let stale = 0
	for (let round = 0; round < maxRounds; round++) {
		for (let pass = 0; pass < passes; pass++) {
			const downward = pass % 2 === 0
			const orderedLevels = downward ? levels : [...levels].reverse()
			for (const lvl of orderedLevels) {
				const group = byLevel.get(lvl)!
				const withMedian = group.map((n) => {
					const neighbors = downward
						? model.reverseAdjacency.get(n.id) ?? []
						: model.adjacency.get(n.id) ?? []
					const ys = neighbors
						.map((id) => model.nodeMap.get(id)?.y)
						.filter((y): y is number => y !== undefined)
						.sort((a, b) => a - b)
					let median: number
					if (ys.length === 0) {
						median = n.y
					} else if (ys.length % 2 === 1) {
						median = ys[(ys.length - 1) / 2]
					} else {
						median = (ys[ys.length / 2 - 1] + ys[ys.length / 2]) / 2
					}
					return { n, median }
				})
				withMedian.sort((a, b) => a.median - b.median)
				// Place nodes at a weighted average of their current y and
				// barycenter median, then enforce minimum gaps. The blend
				// preserves the simulation's spread (preventing collapse) while
				// still moving toward the barycenter-optimal order.
				const total = withMedian.length
				if (total <= 1) continue
				for (const wm of withMedian) {
					if (wm.n.fy === null) {
						wm.n.y = wm.n.y * 0.6 + wm.median * 0.4
					}
				}
				const minGap = group[0]?.kind === 'recipe' ? 60 : 100 // recipe nodes are smaller
				// Forward pass: push down if too close to predecessor
				for (let i = 1; i < total; i++) {
					if (withMedian[i].n.y - withMedian[i - 1].n.y < minGap) {
						withMedian[i].n.y = withMedian[i - 1].n.y + minGap
					}
				}
				// Backward pass: push up if too close to successor
				for (let i = total - 2; i >= 0; i--) {
					if (withMedian[i + 1].n.y - withMedian[i].n.y < minGap) {
						withMedian[i].n.y = withMedian[i + 1].n.y - minGap
					}
				}
			}
		}

		// Check if this round improved the penalty (crossings + overlaps)
		const currentPenalty = countPenalties(model)
		if (currentPenalty < bestPenalty) {
			bestPenalty = currentPenalty
			for (const n of model.nodes) bestYs.set(n.id, n.y)
			stale = 0
		} else {
			stale++
			if (stale >= patience) {
				// No improvement for `patience` rounds â€” revert to best and stop
				for (const n of model.nodes) n.y = bestYs.get(n.id) ?? n.y
				break
			}
		}

		// Interleave a quick local search pass after each barycenter round.
		// This lets the local search escape local minima that barycenter alone
		// can't, and feeds the improved ordering back into the next round.
		localSearch(model, byLevel, levels, 1, 2)
	}

	// Final local search: full-strength pass with wide neighborhood to
	// eliminate remaining crossings. Uses an incremental crossing counter
	// that only checks edges incident to the swapped nodes â€” O(degÂ·E) per
	// swap instead of O(EÂ²) â€” enabling many more iterations and a wider swap
	// neighborhood (distance up to 4). Keeps the swap only if it reduces
	// crossings without introducing overlaps.
	// Scale iterations with graph size to keep runtime bounded.
	const lsIters = model.nodes.length > 60 ? 10 : model.nodes.length > 30 ? 20 : 30
	localSearch(model, byLevel, levels, lsIters, 4)

	// Final collision resolution: ensure no nodes overlap across ALL levels.
	resolveOverlaps(model, 8)
}

/** Incremental local search for crossing reduction.
 *  For each pair of nodes in the same level, swap their y positions and
 *  check only the crossings involving edges incident to either node. This
 *  is dramatically faster than recounting all crossings, allowing many
 *  more iterations and a wider swap neighborhood. */
function localSearch(
	model: GraphModel,
	byLevel: Map<number, SimNode[]>,
	levels: number[],
	maxIters: number,
	maxDistance: number,
): void {
	const { edges, nodeMap, nodes } = model
	// Build edge index: for each node id, the edge indices where it appears
	// as source or target. Used to enumerate only the edges incident to a
	// swapped node when counting incremental crossings.
	const nodeEdges = new Map<string, number[]>()
	for (let ei = 0; ei < edges.length; ei++) {
		const e = edges[ei]
		const sa = nodeEdges.get(e.source)
		if (sa) sa.push(ei)
		else nodeEdges.set(e.source, [ei])
		const ta = nodeEdges.get(e.target)
		if (ta) ta.push(ei)
		else nodeEdges.set(e.target, [ei])
	}

	/** Count crossings involving at least one edge incident to `nodeIds`. */
	const countIncidentCrossings = (nodeIds: Set<string>): number => {
		const incident = new Set<number>()
		for (const id of nodeIds) {
			const el = nodeEdges.get(id)
			if (el) for (const ei of el) incident.add(ei)
		}
		let crossings = 0
		for (const ei of incident) {
			const a = edges[ei]
			const aS = nodeMap.get(a.source)
			const aT = nodeMap.get(a.target)
			if (!aS || !aT) continue
			for (let j = 0; j < edges.length; j++) {
				if (incident.has(j) && j <= ei) continue
				const b = edges[j]
				if (
					a.source === b.source || a.source === b.target ||
					a.target === b.source || a.target === b.target
				) continue
				const bS = nodeMap.get(b.source)
				const bT = nodeMap.get(b.target)
				if (!bS || !bT) continue
				if (edgesCross(aS, aT, bS, bT)) crossings++
			}
		}
		return crossings
	}

	/** Count overlaps involving `nodeId` (incremental O(n) vs full O(nÃÂ²)). */
	const countOverlapsFor = (nodeId: string): number => {
		const n = nodeMap.get(nodeId)
		if (!n) return 0
		let overlaps = 0
		for (const other of nodes) {
			if (other.id === nodeId) continue
			const dx = n.x - other.x
			const dy = n.y - other.y
			const minDist = n.radius + other.radius
			if (dx * dx + dy * dy < minDist * minDist) overlaps++
		}
		return overlaps
	}

	for (let iter = 0; iter < maxIters; iter++) {
		let improved = false
		for (const lvl of levels) {
			const group = byLevel.get(lvl)!
			const sorted = [...group].sort((a, b) => a.y - b.y)
			for (let i = 0; i < sorted.length - 1; i++) {
				for (let step = 1; step <= maxDistance && i + step < sorted.length; step++) {
					const a = sorted[i]
					const b = sorted[i + step]
					if (a.fy !== null || b.fy !== null) continue
					const swapped = new Set([a.id, b.id])
					const beforeCross = countIncidentCrossings(swapped)
					const beforeOverlap = countOverlapsFor(a.id) + countOverlapsFor(b.id)
					const ay = a.y
					const by = b.y
					a.y = by
					b.y = ay
					const afterCross = countIncidentCrossings(swapped)
					const afterOverlap = countOverlapsFor(a.id) + countOverlapsFor(b.id)
					if (afterCross < beforeCross && afterOverlap <= beforeOverlap) {
						improved = true
						break
					} else {
						a.y = ay
						b.y = by
					}
				}
			}
		}
		if (!improved) break
	}
}

/** Position-based overlap resolution across all nodes (all levels).
 *  Preserves within-level y-ordering by constraining each node's y movement
 *  to stay between its same-level neighbors. */
function resolveOverlaps(model: GraphModel, iterations: number): void {
	const { nodes } = model
	// Precompute sorted y-order within each level so we can constrain movement
	const levelBounds = new Map<string, { lo: number; hi: number }>()
	for (let iter = 0; iter < iterations; iter++) {
		// Rebuild level bounds each iteration (positions change)
		levelBounds.clear()
		const byLevel = new Map<number, SimNode[]>()
		for (const n of nodes) {
			const arr = byLevel.get(n.level) ?? []
			arr.push(n)
			byLevel.set(n.level, arr)
		}
		for (const [, group] of byLevel) {
			group.sort((a, b) => a.y - b.y)
			const gap = group[0]?.kind === 'recipe' ? 50 : 100
			for (let i = 0; i < group.length; i++) {
				const lo = i > 0 ? group[i - 1].y + gap : -Infinity
				const hi = i < group.length - 1 ? group[i + 1].y - gap : Infinity
				levelBounds.set(group[i].id, { lo, hi })
			}
		}
		let moved = false
		for (let i = 0; i < nodes.length; i++) {
			const a = nodes[i]
			for (let j = i + 1; j < nodes.length; j++) {
				const b = nodes[j]
				const dx = a.x - b.x
				const dy = a.y - b.y
				let dist2 = dx * dx + dy * dy
				const minDist = a.radius + b.radius + 12
				if (dist2 < minDist * minDist) {
					if (dist2 < 0.01) dist2 = 0.01
					const dist = Math.sqrt(dist2)
					const overlap = (minDist - dist) * 0.5
					// Prefer to move in y direction (preserve x = level position)
					const oy = (dy / dist) * overlap
					const ox = (dx / dist) * overlap * 0.3
					// Apply movement but clamp to within-level bounds
					if (a.fy === null) {
						const bnd = levelBounds.get(a.id)
						const newY = bnd
							? Math.max(bnd.lo, Math.min(bnd.hi, a.y + oy))
							: a.y + oy
						const actualOY = newY - a.y
						if (Math.abs(actualOY) > 0.01) moved = true
						a.y = newY
					}
					if (a.fx === null) a.x += ox
					if (b.fy === null) {
						const bnd = levelBounds.get(b.id)
						const newY = bnd
							? Math.max(bnd.lo, Math.min(bnd.hi, b.y - oy))
							: b.y - oy
						const actualOY = newY - b.y
						if (Math.abs(actualOY) > 0.01) moved = true
						b.y = newY
					}
					if (b.fx === null) b.x -= ox
				}
			}
		}
		if (!moved) break
	}
}

/** Count edge crossings + node overlaps (weighted) for the feedback loop.
 *  Overlaps are weighted heavily (5x) so the crossing reduction prefers
 *  spread-out layouts even when crossings are already 0. */
function countPenalties(model: GraphModel): number {
	return countCrossings(model) + countOverlaps(model) * 5
}

function countCrossings(model: GraphModel): number {
	const { edges, nodeMap } = model
	let crossings = 0
	for (let i = 0; i < edges.length; i++) {
		const a = edges[i]
		const aS = nodeMap.get(a.source)
		const aT = nodeMap.get(a.target)
		if (!aS || !aT) continue
		for (let j = i + 1; j < edges.length; j++) {
			const b = edges[j]
			if (
				a.source === b.source || a.source === b.target ||
				a.target === b.source || a.target === b.target
			) continue
			const bS = nodeMap.get(b.source)
			const bT = nodeMap.get(b.target)
			if (!bS || !bT) continue
			if (edgesCross(aS, aT, bS, bT)) crossings++
		}
	}
	return crossings
}

function countOverlaps(model: GraphModel): number {
	const { nodes } = model
	let overlaps = 0
	for (let i = 0; i < nodes.length; i++) {
		const a = nodes[i]
		for (let j = i + 1; j < nodes.length; j++) {
			const b = nodes[j]
			const dx = a.x - b.x
			const dy = a.y - b.y
			const minDist = a.radius + b.radius
			if (dx * dx + dy * dy < minDist * minDist) overlaps++
		}
	}
	return overlaps
}
