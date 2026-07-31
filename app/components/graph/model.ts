import type { Bench, Item, Recipe } from '../../types'
import type { GraphModel, SimEdge, SimNode } from './types'

const NODE_RADIUS = 38
const RECIPE_NODE_RADIUS = 20

export function buildGraphModel(items: Item[], _benches: Bench[], recipes: Recipe[]): GraphModel {
	const nodeMap = new Map<string, SimNode>()
	const benchNameMap = new Map<string, string>()
	for (const b of _benches) benchNameMap.set(b.id, b.name ?? '?')

	// 1. Create item nodes
	const itemBenches = new Map<string, Set<string>>()
	for (const recipe of recipes) {
		const benchName = benchNameMap.get(recipe.benchId) ?? recipe.benchName ?? '?'
		for (const output of recipe.outputs) {
			if (!items.some((i) => i.id === output.item)) continue
			let set = itemBenches.get(output.item)
			if (!set) {
				set = new Set()
				itemBenches.set(output.item, set)
			}
			set.add(benchName)
		}
	}

	for (const item of items) {
		nodeMap.set(item.id, {
			id: item.id,
			label: item.name ?? item.id,
			x: 0,
			y: 0,
			level: 0,
			inDegree: 0,
			outDegree: 0,
			isSource: true,
			isSink: true,
			scc: -1,
			inCycle: false,
			radius: NODE_RADIUS,
			kind: 'item',
			benches: [...(itemBenches.get(item.id) ?? [])],
		})
	}

	// 2. Build item-only adjacency (for SCC and level computation)
	const itemAdjacency = new Map<string, string[]>()
	const itemReverseAdjacency = new Map<string, string[]>()
	for (const recipe of recipes) {
		for (const input of recipe.inputs) {
			if (!nodeMap.has(input.item)) continue
			for (const output of recipe.outputs) {
				if (!nodeMap.has(output.item)) continue
				if (input.item === output.item) continue
				if (!itemAdjacency.has(input.item)) itemAdjacency.set(input.item, [])
				if (!itemAdjacency.get(input.item)!.includes(output.item)) {
					itemAdjacency.get(input.item)!.push(output.item)
				}
				if (!itemReverseAdjacency.has(output.item)) itemReverseAdjacency.set(output.item, [])
				if (!itemReverseAdjacency.get(output.item)!.includes(input.item)) {
					itemReverseAdjacency.get(output.item)!.push(input.item)
				}
			}
		}
	}

	// 3. Compute SCCs on items (cycle detection)
	const sccs = tarjanSCC([...nodeMap.keys()], itemAdjacency)
	const sccMap = new Map<string, number>()
	sccs.forEach((scc, i) => {
		for (const id of scc) sccMap.set(id, i)
	})
	for (const node of nodeMap.values()) {
		node.scc = sccMap.get(node.id) ?? -1
		node.inCycle = (sccs[node.scc]?.length ?? 0) > 1
	}

	// 4. Compute levels on items (topological ordering)
	const { levels, maxLevel } = computeLevels([...nodeMap.values()], itemAdjacency, itemReverseAdjacency, sccs)
	for (const node of nodeMap.values()) {
		node.level = levels.get(node.id) ?? 0
	}

	// 5. Create recipe nodes and edges (item → recipe → item)
	const edgeList: SimEdge[] = []
	const adjacency = new Map<string, string[]>()
	const reverseAdjacency = new Map<string, string[]>()

	// Source items (raw materials with no predecessor) that feed more than
	// one recipe are duplicated — one copy per consuming recipe — so each copy
	// has a single outgoing edge and can sit beside its recipe. This removes
	// the long fan-out edges from shared raw materials that cause most
	// crossings in crafting graphs.
	const sourceRecipeUses = new Map<string, Set<string>>()
	for (const recipe of recipes) {
		const seen = new Set<string>()
		for (const input of recipe.inputs) {
			if (!nodeMap.has(input.item) || seen.has(input.item)) continue
			seen.add(input.item)
			if ((itemReverseAdjacency.get(input.item) ?? []).length > 0) continue
			let set = sourceRecipeUses.get(input.item)
			if (!set) {
				set = new Set()
				sourceRecipeUses.set(input.item, set)
			}
			set.add(recipe.id)
		}
	}
	const duplicatedSources = new Set<string>()
	for (const [itemId, recipeSet] of sourceRecipeUses) {
		if (recipeSet.size > 1) duplicatedSources.add(itemId)
	}

	for (const recipe of recipes) {
		const benchName = benchNameMap.get(recipe.benchId) ?? recipe.benchName ?? '?'
		const validInputs = recipe.inputs.filter((i) => nodeMap.has(i.item))
		const validOutputs = recipe.outputs.filter((o) => nodeMap.has(o.item))
		if (validInputs.length === 0 || validOutputs.length === 0) continue

		// Recipe node sits at a half-level between its inputs and outputs
		const maxInputLevel = Math.max(...validInputs.map((i) => levels.get(i.item) ?? 0))
		const recipeLevel = maxInputLevel + 0.5

		// A recipe is part of a cycle if any input and output are in the same SCC
		const recipeInCycle = validInputs.some((i) =>
			validOutputs.some((o) => {
				const sccI = sccMap.get(i.item)
				const sccO = sccMap.get(o.item)
				return sccI === sccO && (sccs[sccI ?? -1]?.length ?? 0) > 1
			}),
		)

		const recipeNodeId = `r_${recipe.id}`
		nodeMap.set(recipeNodeId, {
			id: recipeNodeId,
			label: benchName,
			x: 0,
			y: 0,
			level: recipeLevel,
			inDegree: validInputs.length,
			outDegree: validOutputs.length,
			isSource: false,
			isSink: false,
			scc: -1,
			inCycle: recipeInCycle,
			radius: RECIPE_NODE_RADIUS,
			kind: 'recipe',
			recipeId: recipe.id,
			benchName,
			benches: [],
		})

		// Edges: input items → recipe node. Duplicated sources use a per-recipe
		// copy so each copy feeds exactly one recipe. The copy is placed at
		// recipeLevel - 0.5 so it sits right beside its recipe instead of
		// staying at level 0 with a long edge spanning the whole graph.
		// Non-duplicated sources (feeding only 1 recipe) also get moved to
		// recipeLevel - 0.5 for the same reason.
		for (const input of validInputs) {
			let sourceNodeId = input.item
			const isSource = (itemReverseAdjacency.get(input.item) ?? []).length === 0
			if (duplicatedSources.has(input.item)) {
				sourceNodeId = `${input.item}__${recipe.id}`
				if (!nodeMap.has(sourceNodeId)) {
					const orig = nodeMap.get(input.item)!
					nodeMap.set(sourceNodeId, { ...orig, id: sourceNodeId, level: recipeLevel - 0.5 })
				}
			} else if (isSource) {
				nodeMap.get(sourceNodeId)!.level = recipeLevel - 0.5
			}
			edgeList.push({
				id: `e${edgeList.length}`,
				source: sourceNodeId,
				target: recipeNodeId,
				recipeId: recipe.id,
				benchName,
				isBackEdge: recipeInCycle,
			})
			if (!adjacency.has(sourceNodeId)) adjacency.set(sourceNodeId, [])
			adjacency.get(sourceNodeId)!.push(recipeNodeId)
			if (!reverseAdjacency.has(recipeNodeId)) reverseAdjacency.set(recipeNodeId, [])
			reverseAdjacency.get(recipeNodeId)!.push(sourceNodeId)
		}

		// Edges: recipe node → output items
		for (const output of validOutputs) {
			edgeList.push({
				id: `e${edgeList.length}`,
				source: recipeNodeId,
				target: output.item,
				recipeId: recipe.id,
				benchName,
				isBackEdge: recipeInCycle,
			})
			if (!adjacency.has(recipeNodeId)) adjacency.set(recipeNodeId, [])
			adjacency.get(recipeNodeId)!.push(output.item)
			if (!reverseAdjacency.has(output.item)) reverseAdjacency.set(output.item, [])
			reverseAdjacency.get(output.item)!.push(recipeNodeId)
		}
	}

	// Remove the original nodes of duplicated sources — every consuming
	// recipe now has its own copy, so the shared original would be isolated.
	for (const id of duplicatedSources) nodeMap.delete(id)

	// 6. Update item node degrees based on full adjacency (through recipe nodes)
	for (const node of nodeMap.values()) {
		if (node.kind === 'item') {
			node.inDegree = reverseAdjacency.get(node.id)?.length ?? 0
			node.outDegree = adjacency.get(node.id)?.length ?? 0
			node.isSource = node.inDegree === 0
			node.isSink = node.outDegree === 0
		}
	}

	return {
		nodes: [...nodeMap.values()],
		edges: edgeList,
		nodeMap,
		adjacency,
		reverseAdjacency,
		levels: [],
		maxLevel,
		cycles: sccs.filter((s) => s.length > 1),
	}
}

function computeLevels(
	nodes: SimNode[],
	adjacency: Map<string, string[]>,
	reverseAdjacency: Map<string, string[]>,
	sccs: string[][],
): { levels: Map<string, number>; maxLevel: number } {
	const levels = new Map<string, number>()
	const inDeg = new Map<string, number>()
	// For Kahn's, ignore edges within the same SCC (cycles) so cycle nodes
	// can still be assigned levels by their external connections.
	const sccOf = new Map<string, number>()
	sccs.forEach((scc, i) => {
		for (const id of scc) sccOf.set(id, i)
	})
	const externalInDeg = new Map<string, number>()
	for (const n of nodes) {
		const deg = (reverseAdjacency.get(n.id) ?? []).filter((src) => sccOf.get(src) !== sccOf.get(n.id)).length
		externalInDeg.set(n.id, deg)
		inDeg.set(n.id, deg)
	}

	const queue: string[] = []
	for (const n of nodes) {
		if ((inDeg.get(n.id) ?? 0) === 0) {
			levels.set(n.id, 0)
			queue.push(n.id)
		}
	}

	while (queue.length > 0) {
		const cur = queue.shift()!
		const curLevel = levels.get(cur) ?? 0
		for (const nb of adjacency.get(cur) ?? []) {
			if (sccOf.get(nb) === sccOf.get(cur)) continue // skip intra-SCC edges
			const deg = (inDeg.get(nb) ?? 0) - 1
			inDeg.set(nb, deg)
			levels.set(nb, Math.max(levels.get(nb) ?? 0, curLevel + 1))
			if (deg === 0) queue.push(nb)
		}
	}

	// Cycle nodes that never got processed (still no level): assign based on
	// the max level of external incoming + 1, or fallback to min outgoing - 1,
	// or 0 if fully isolated.
	const cycleUnset: string[] = []
	for (const n of nodes) {
		if (!levels.has(n.id)) cycleUnset.push(n.id)
	}
	// Iterate a few rounds to propagate through chained cycle groups
	for (let round = 0; round < sccs.length + 2; round++) {
		let changed = false
		for (const id of cycleUnset) {
			if (levels.has(id)) continue
			let bestIncoming = -1
			for (const src of reverseAdjacency.get(id) ?? []) {
				if (sccOf.get(src) === sccOf.get(id)) continue
				const lvl = levels.get(src)
				if (lvl !== undefined) bestIncoming = Math.max(bestIncoming, lvl)
			}
			if (bestIncoming >= 0) {
				levels.set(id, bestIncoming + 1)
				changed = true
				continue
			}
			let bestOutgoing = Infinity
			for (const dst of adjacency.get(id) ?? []) {
				if (sccOf.get(dst) === sccOf.get(id)) continue
				const lvl = levels.get(dst)
				if (lvl !== undefined) bestOutgoing = Math.min(bestOutgoing, lvl)
			}
			if (bestOutgoing !== Infinity) {
				levels.set(id, Math.max(0, bestOutgoing - 1))
				changed = true
			}
		}
		if (!changed) break
	}
	// Anything still unset gets level 0
	for (const n of nodes) {
		if (!levels.has(n.id)) levels.set(n.id, 0)
	}

	let maxLevel = 0
	for (const l of levels.values()) maxLevel = Math.max(maxLevel, l)
	return { levels, maxLevel }
}

function tarjanSCC(nodes: string[], adjacency: Map<string, string[]>): string[][] {
	const index = new Map<string, number>()
	const lowlink = new Map<string, number>()
	const onStack = new Set<string>()
	const stack: string[] = []
	let idx = 0
	const sccs: string[][] = []

	function strongconnect(v: string) {
		index.set(v, idx)
		lowlink.set(v, idx)
		idx++
		stack.push(v)
		onStack.add(v)

		for (const w of adjacency.get(v) ?? []) {
			if (!index.has(w)) {
				strongconnect(w)
				lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
			} else if (onStack.has(w)) {
				lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!))
			}
		}

		if (lowlink.get(v) === index.get(v)) {
			const comp: string[] = []
			let w: string
			do {
				w = stack.pop()!
				onStack.delete(w)
				comp.push(w)
			} while (w !== v)
			sccs.push(comp)
		}
	}

	for (const v of nodes) {
		if (!index.has(v)) strongconnect(v)
	}

	return sccs
}

export function initializeLayout(model: GraphModel, vertical = false): void {
	const levelSpacing = 220
	const rowSpacing = 90
	const recipeRowSpacing = 70

	// Group nodes by level (recipe nodes use half-levels like 0.5, 1.5)
	const byLevel = new Map<number, SimNode[]>()
	for (const n of model.nodes) {
		const arr = byLevel.get(n.level) ?? []
		arr.push(n)
		byLevel.set(n.level, arr)
	}
	const levels = [...byLevel.keys()].sort((a, b) => a - b)
	const layerNodes: SimNode[][] = levels.map((lvl) => byLevel.get(lvl)!)
	const numLayers = layerNodes.length

	const rowSpacingFor = (layer: SimNode[]) => {
		for (const n of layer) {
			if (n.kind === 'dummy') continue
			return n.kind === 'recipe' ? recipeRowSpacing : rowSpacing
		}
		return rowSpacing
	}

	// --- Dummy node insertion for long edges ---
	// Long edges (spanning >1 layer) are split into adjacent-layer
	// segments with dummy nodes so the crossing counter captures all
	// crossings, including those from edges that skip layers.
	const adj = new Map<string, string[]>()
	const revAdj = new Map<string, string[]>()
	for (const [k, v] of model.adjacency) adj.set(k, v.slice())
	for (const [k, v] of model.reverseAdjacency) revAdj.set(k, v.slice())

	const levelIndex = new Map<string, number>()
	for (let li = 0; li < numLayers; li++) {
		for (const n of layerNodes[li]) levelIndex.set(n.id, li)
	}

	let dummyCount = 0
	for (const e of model.edges) {
		const si = levelIndex.get(e.source)
		const ti = levelIndex.get(e.target)
		if (si === undefined || ti === undefined) continue
		if (Math.abs(ti - si) <= 1) continue

		const aList = adj.get(e.source)
		if (aList) {
			const idx = aList.indexOf(e.target)
			if (idx >= 0) aList.splice(idx, 1)
		}
		const rList = revAdj.get(e.target)
		if (rList) {
			const idx = rList.indexOf(e.source)
			if (idx >= 0) rList.splice(idx, 1)
		}

		const step = ti > si ? 1 : -1
		let prevId = e.source
		for (let li = si + step; li !== ti; li += step) {
			const dummyId = `_d${dummyCount++}`
			const dummy: SimNode = {
				id: dummyId,
				label: '',
				x: 0,
				y: 0,
				level: levels[li],
				inDegree: 1,
				outDegree: 1,
				isSource: false,
				isSink: false,
				scc: -1,
				inCycle: false,
				radius: 1,
				kind: 'dummy',
				benches: [],
			}
			layerNodes[li].push(dummy)
			levelIndex.set(dummyId, li)

			if (!adj.has(prevId)) adj.set(prevId, [])
			adj.get(prevId)!.push(dummyId)
			if (!revAdj.has(dummyId)) revAdj.set(dummyId, [])
			revAdj.get(dummyId)!.push(prevId)

			prevId = dummyId
		}

		if (!adj.has(prevId)) adj.set(prevId, [])
		adj.get(prevId)!.push(e.target)
		if (!revAdj.has(e.target)) revAdj.set(e.target, [])
		revAdj.get(e.target)!.push(prevId)
	}

	// Build node id → position (index) within its layer
	function buildPosMap(): Map<string, number> {
		const pos = new Map<string, number>()
		for (let li = 0; li < numLayers; li++) {
			for (let pi = 0; pi < layerNodes[li].length; pi++) {
				pos.set(layerNodes[li][pi].id, pi)
			}
		}
		return pos
	}

	const layerOf = new Map<string, number>()
	const refreshLayerOf = () => {
		layerOf.clear()
		for (let li = 0; li < numLayers; li++) {
			for (const n of layerNodes[li]) layerOf.set(n.id, li)
		}
	}

	// Count crossings between two adjacent layers using an O(E log E)
	// sweep-line with a Fenwick tree (binary indexed tree). For each
	// edge (u_i → v_j) sorted by u position, count how many previously
	// inserted edges have v position > v_j (those cross this edge).
	function countLayerCrossings(
		upper: SimNode[],
		lower: SimNode[],
	): number {
		const lowerPos = new Map<string, number>()
		lower.forEach((n, i) => lowerPos.set(n.id, i))
		const edges: Array<[number, number]> = []
		upper.forEach((u, ui) => {
			for (const v of adj.get(u.id) ?? []) {
				const vi = lowerPos.get(v)
				if (vi !== undefined) edges.push([ui, vi])
			}
		})
		if (edges.length < 2) return 0
		// Sort by upper position, then by lower position
		edges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
		const m = lower.length
		const bit = new Int32Array(m + 1)
		const bitAdd = (i: number) => {
			for (i++; i <= m; i += i & -i) bit[i]++
		}
		const bitSum = (i: number) => {
			let s = 0
			for (i++; i > 0; i -= i & -i) s += bit[i]
			return s
		}
		let total = 0
		for (const [, vi] of edges) {
			// Count previously inserted edges with v > vi
			total += bitSum(m - 1) - bitSum(vi)
			bitAdd(vi)
		}
		return total
	}

	function totalCrossings(): number {
		let total = 0
		for (let li = 0; li < numLayers - 1; li++) {
			total += countLayerCrossings(layerNodes[li], layerNodes[li + 1])
		}
		return total
	}

	// Mean barycenter: sort by the average position of neighbors.
	// Falls back to the node's original index when there are no
	// placed neighbors.
	const baryOf = (positions: number[], fallback: number) => {
		if (positions.length === 0) return fallback
		return positions.reduce((a, b) => a + b, 0) / positions.length
	}

	function barycenterSweep(downward: boolean) {
		const pos = buildPosMap()
		if (downward) {
			for (let li = 1; li < numLayers; li++) {
				const layer = layerNodes[li]
				const withBary = layer.map((n, idx) => {
				const incoming = revAdj.get(n.id) ?? []
					const ps: number[] = []
					for (const id of incoming) {
						const p = pos.get(id)
						if (p !== undefined) ps.push(p)
					}
					return { n, bary: baryOf(ps, idx), idx }
				})
				withBary.sort((a, b) => a.bary - b.bary || a.idx - b.idx)
				layerNodes[li] = withBary.map((w) => w.n)
				for (let pi = 0; pi < layerNodes[li].length; pi++) {
					pos.set(layerNodes[li][pi].id, pi)
				}
			}
		} else {
			for (let li = numLayers - 2; li >= 0; li--) {
				const layer = layerNodes[li]
				const withBary = layer.map((n, idx) => {
				const outgoing = adj.get(n.id) ?? []
					const ps: number[] = []
					for (const id of outgoing) {
						const p = pos.get(id)
						if (p !== undefined) ps.push(p)
					}
					return { n, bary: baryOf(ps, idx), idx }
				})
				withBary.sort((a, b) => a.bary - b.bary || a.idx - b.idx)
				layerNodes[li] = withBary.map((w) => w.n)
				for (let pi = 0; pi < layerNodes[li].length; pi++) {
					pos.set(layerNodes[li][pi].id, pi)
				}
			}
		}
	}

	// Greedy switch — swap adjacent pairs in a layer if it reduces
	// crossings with neighboring layers. Iterates to convergence
	// (repeats until no swaps are made in a full sweep).
	function greedySwitch() {
		for (let iter = 0; iter < 8; iter++) {
			let swapped = false
			const pos = buildPosMap()

			for (let li = 0; li < numLayers; li++) {
				const layer = layerNodes[li]
				for (let pi = 0; pi < layer.length - 1; pi++) {
					const u = layer[pi]
					const v = layer[pi + 1]
					let crossCurrent = 0
					let crossSwapped = 0

					const countPairs = (uN: string[], vN: string[]) => {
						for (const a of uN) {
							const pa = pos.get(a)
							const la = layerOf.get(a)
							if (pa === undefined || la === undefined) continue
							for (const b of vN) {
								const pb = pos.get(b)
								const lb = layerOf.get(b)
								if (pb === undefined || lb === undefined || a === b) continue
								if (la !== lb) continue
								if (pa > pb) crossCurrent++
								else if (pa < pb) crossSwapped++
							}
						}
					}

					countPairs(
						adj.get(u.id) ?? [],
						adj.get(v.id) ?? [],
					)
					countPairs(
						revAdj.get(u.id) ?? [],
						revAdj.get(v.id) ?? [],
					)

					if (crossSwapped < crossCurrent) {
						layer[pi] = v
						layer[pi + 1] = u
						pos.set(v.id, pi)
						pos.set(u.id, pi + 1)
						swapped = true
					}
				}
			}
			if (!swapped) break
		}
	}

	// Phase 1+2: Barycenter + greedy switch to convergence.
	// Dummy nodes (inserted above) ensure the Fenwick crossing
	// counter captures all crossings, including long edges that
	// span multiple layers.
	const NUM_PASSES = 24
	let bestCrossings = Infinity
	let bestOrder: SimNode[][] = layerNodes.map((l) => l.slice())

	for (let pass = 0; pass < NUM_PASSES; pass++) {
		barycenterSweep(pass % 2 === 0)
		refreshLayerOf()
		greedySwitch()
		refreshLayerOf()

		const c = totalCrossings()
		if (c < bestCrossings) {
			bestCrossings = c
			bestOrder = layerNodes.map((l) => l.slice())
		}
	}

	// Restore best ordering
	for (let li = 0; li < numLayers; li++) {
		layerNodes[li] = bestOrder[li]
	}

	// Remove dummy nodes — they were only needed for crossing reduction
	for (let li = 0; li < numLayers; li++) {
		layerNodes[li] = layerNodes[li].filter((n) => n.kind !== 'dummy')
	}

	// Phase 3: Coordinate assignment.
	// Start with even spacing by order (guarantees no overlaps), then
	// iteratively pull nodes toward their neighbors' average y while
	// maintaining minimum spacing within each layer. After spacing
	// enforcement, re-center each layer so its centroid matches its
	// barycenter target centroid — this prevents large layers from
	// drifting away and cascading the drift to neighbors.
	const yMap = new Map<string, number>()
	for (const layer of layerNodes) {
		const rs = rowSpacingFor(layer)
		const startY = -((layer.length - 1) * rs) / 2
		layer.forEach((n, i) => yMap.set(n.id, startY + i * rs))
	}

	// Relax one layer: compute barycenter targets, enforce spacing,
	// then re-center so the layer's centroid matches the target
	// centroid. Re-centering is the optimal uniform shift that
	// minimizes total squared edge length to neighbors.
	const relaxLayer = (layer: SimNode[]) => {
		if (layer.length === 0) return
		const rs = rowSpacingFor(layer)
		const targets = layer.map((n) => {
			const incoming = model.reverseAdjacency.get(n.id) ?? []
			const outgoing = model.adjacency.get(n.id) ?? []
			let sum = 0
			let count = 0
			for (const id of incoming) {
				const y = yMap.get(id)
				if (y !== undefined) { sum += y; count++ }
			}
			for (const id of outgoing) {
				const y = yMap.get(id)
				if (y !== undefined) { sum += y; count++ }
			}
			return count > 0 ? sum / count : (yMap.get(n.id) ?? 0)
		})

		const ys = targets.slice()
		for (let it = 0; it < 4; it++) {
			for (let i = 1; i < ys.length; i++) {
				ys[i] = Math.max(ys[i], ys[i - 1] + rs)
			}
			for (let i = ys.length - 2; i >= 0; i--) {
				ys[i] = Math.min(ys[i], ys[i + 1] - rs)
			}
		}

		// Re-center: shift so layer centroid matches target centroid.
		// Only consider nodes that had neighbors (count > 0) for the
		// target centroid, so disconnected nodes don't pull the center.
		let tSum = 0
		let tCount = 0
		for (let i = 0; i < layer.length; i++) {
			const incoming = model.reverseAdjacency.get(layer[i].id) ?? []
			const outgoing = model.adjacency.get(layer[i].id) ?? []
			if (incoming.length + outgoing.length > 0) {
				tSum += targets[i]
				tCount++
			}
		}
		if (tCount > 0) {
			const targetCentroid = tSum / tCount
			const actualCentroid = ys.reduce((a, b) => a + b, 0) / ys.length
			const shift = targetCentroid - actualCentroid
			for (let i = 0; i < ys.length; i++) ys[i] += shift
		}

		for (let i = 0; i < layer.length; i++) {
			yMap.set(layer[i].id, ys[i])
		}
	}

	for (let pass = 0; pass < 20; pass++) {
		for (let li = 0; li < numLayers; li++) {
			relaxLayer(layerNodes[li])
		}
	}

	// Phase 3b: Edge-length-aware post-optimization.
	// Try swapping adjacent nodes in each layer if it reduces total
	// edge length. Shorter edges naturally cross less, so
	// this also tends to reduce crossings. After each iteration of
	// swaps, re-relax coordinates to settle into the new ordering.
	// Using dy^3.5 (|dy|^3.5) to aggressively penalize
	// the longest edges. This exponent provides the best trade-off:
	// steep enough to pull high-fanout nodes toward their neighbors,
	// smooth enough to avoid over-fitting to a single extreme edge.
	const edgeLen = (idA: string, idB: string): number => {
		const ya = yMap.get(idA) ?? 0
		const yb = yMap.get(idB) ?? 0
		const dy = ya - yb
		return Math.abs(dy) ** 3.5
	}
	const nodeEdgeLen = (id: string): number => {
		let len = 0
		for (const nb of model.adjacency.get(id) ?? []) len += edgeLen(id, nb)
		for (const nb of model.reverseAdjacency.get(id) ?? []) len += edgeLen(id, nb)
		return len
	}

	// Swap adjacent nodes if it reduces crossings with neighboring
	// layers. Uses the same crossing-count logic as greedy switch.
	const layerOf2 = new Map<string, number>()
	const refreshLayerOf2 = () => {
		layerOf2.clear()
		for (let li = 0; li < numLayers; li++) {
			for (const n of layerNodes[li]) layerOf2.set(n.id, li)
		}
	}
	const buildPosMap2 = (): Map<string, number> => {
		const pos = new Map<string, number>()
		for (let li = 0; li < numLayers; li++) {
			for (let pi = 0; pi < layerNodes[li].length; pi++) {
				pos.set(layerNodes[li][pi].id, pi)
			}
		}
		return pos
	}
	const crossingDelta = (
		u: SimNode,
		v: SimNode,
		pos: Map<string, number>,
	): number => {
		// Returns (crossings_before - crossings_after) for swapping u,v.
		// Positive = swapping reduces crossings.
		const uAdj = adj.get(u.id) ?? []
		const vAdj = adj.get(v.id) ?? []
		const uRev = revAdj.get(u.id) ?? []
		const vRev = revAdj.get(v.id) ?? []
		let before = 0
		let after = 0
		const countPairs = (uN: string[], vN: string[]) => {
			for (const a of uN) {
				const pa = pos.get(a)
				const la = layerOf2.get(a)
				if (la === undefined || pa === undefined) continue
				for (const b of vN) {
					if (a === b) continue
					const pb = pos.get(b)
					const lb = layerOf2.get(b)
					if (lb === undefined || pb === undefined || la !== lb) continue
					if (pa > pb) before++
					else if (pa < pb) after++
				}
			}
		}
		countPairs(uAdj, vAdj)
		countPairs(uRev, vRev)
		return before - after
	}

	// Combined alternating optimization: edge-length swaps (3b) and
	// crossing swaps (3c) in each iteration, then re-relax once.
	// Alternating converges both metrics together instead of one
	// pulling against the other.
	for (let iter = 0; iter < 120; iter++) {
		let swapped = false

		// 3b: edge-length swaps
		for (let li = 0; li < numLayers; li++) {
			const layer = layerNodes[li]
			for (let pi = 0; pi < layer.length - 1; pi++) {
				const u = layer[pi]
				const v = layer[pi + 1]
				const lenBefore = nodeEdgeLen(u.id) + nodeEdgeLen(v.id)
				const yu = yMap.get(u.id) ?? 0
				const yv = yMap.get(v.id) ?? 0
				yMap.set(u.id, yv)
				yMap.set(v.id, yu)
				const lenAfter = nodeEdgeLen(u.id) + nodeEdgeLen(v.id)
				if (lenAfter < lenBefore) {
					layer[pi] = v
					layer[pi + 1] = u
					swapped = true
				} else {
					yMap.set(u.id, yu)
					yMap.set(v.id, yv)
				}
			}
		}

		// 3c: crossing swaps
		refreshLayerOf2()
		const pos = buildPosMap2()
		for (let li = 0; li < numLayers; li++) {
			const layer = layerNodes[li]
			for (let pi = 0; pi < layer.length - 1; pi++) {
				const u = layer[pi]
				const v = layer[pi + 1]
				if (crossingDelta(u, v, pos) > 0) {
					const yu = yMap.get(u.id) ?? 0
					const yv = yMap.get(v.id) ?? 0
					yMap.set(u.id, yv)
					yMap.set(v.id, yu)
					layer[pi] = v
					layer[pi + 1] = u
					pos.set(u.id, pi + 1)
					pos.set(v.id, pi)
					swapped = true
				}
			}
		}

		if (!swapped) break
		// Re-relax coordinates after swaps
		for (let pass = 0; pass < 4; pass++) {
			for (let li2 = 0; li2 < numLayers; li2++) {
				relaxLayer(layerNodes[li2])
			}
		}
		// Every 2 iterations, re-sort by coordinate barycenter to
		// escape local optima that adjacent swaps can't reach.
		if (iter > 0 && iter % 2 === 0) {
			for (let li = 0; li < numLayers; li++) {
				layerNodes[li].sort((a, b) => (yMap.get(a.id) ?? 0) - (yMap.get(b.id) ?? 0))
			}
			for (let pass = 0; pass < 4; pass++) {
				for (let li2 = 0; li2 < numLayers; li2++) {
					relaxLayer(layerNodes[li2])
				}
			}
		}
	}

	// Re-assign coordinates from scratch using the final ordering.
	// The 3b/3c loop's repeated re-sorting and relaxation accumulates
	// coordinate drift that inflates graph height. Resetting to a
	// compact baseline and re-relaxing produces tighter coordinates
	// for the same ordering, reducing height without changing crossings.
	for (let li = 0; li < numLayers; li++) {
		const layer = layerNodes[li]
		const rs = rowSpacingFor(layer)
		for (let i = 0; i < layer.length; i++) {
			yMap.set(layer[i].id, i * rs)
		}
	}
	for (let pass = 0; pass < 20; pass++) {
		for (let li = 0; li < numLayers; li++) {
			relaxLayer(layerNodes[li])
		}
	}

	// Post-relaxation greedy coordinate optimization: for each node,
	// try shifting it within its available slack (between neighbors)
	// to reduce total edge length. This directly optimizes coordinates
	// after the ordering is fixed.
	const nodeEdgeLength = (id: string): number => {
		let len = 0
		for (const nb of model.adjacency.get(id) ?? []) {
			const ya = yMap.get(id) ?? 0
			const yb = yMap.get(nb) ?? 0
			const dy = Math.abs(ya - yb)
			len += dy ** 1.5 + Math.max(0, dy - 630) ** 3
		}
		for (const nb of model.reverseAdjacency.get(id) ?? []) {
			const ya = yMap.get(id) ?? 0
			const yb = yMap.get(nb) ?? 0
			const dy = Math.abs(ya - yb)
			len += dy ** 1.5 + Math.max(0, dy - 630) ** 3
		}
		return len
	}
	// Alternating single-node and pair moves until convergence
	for (let optPass = 0; optPass < 100; optPass++) {
		let improved = false
		// Single-node scan
		for (let li = 0; li < numLayers; li++) {
			const layer = layerNodes[li]
			const rs = rowSpacingFor(layer)
			for (let i = 0; i < layer.length; i++) {
				const n = layer[i]
				const curY = yMap.get(n.id) ?? 0
				const lenBefore = nodeEdgeLength(n.id)
				const minY = i > 0 ? (yMap.get(layer[i - 1].id) ?? 0) + rs : curY - rs
				const maxY = i < layer.length - 1 ? (yMap.get(layer[i + 1].id) ?? 0) - rs : curY + rs
				let bestY = curY
				let bestLen = lenBefore
				const step = rs * 0.01
				for (let y = minY; y <= maxY; y += step) {
					yMap.set(n.id, y)
					const len = nodeEdgeLength(n.id)
					if (len < bestLen) {
						bestLen = len
						bestY = y
					}
				}
				yMap.set(n.id, bestY)
				if (bestY !== curY) improved = true
			}
		}
		// Pair moves
		for (let li = 0; li < numLayers; li++) {
			const layer = layerNodes[li]
			const rs = rowSpacingFor(layer)
			for (let i = 0; i < layer.length - 1; i++) {
				const n1 = layer[i]
				const n2 = layer[i + 1]
				const curY1 = yMap.get(n1.id) ?? 0
				const curY2 = yMap.get(n2.id) ?? 0
				const lenBefore = nodeEdgeLength(n1.id) + nodeEdgeLength(n2.id)
				const minY = i > 0 ? (yMap.get(layer[i - 1].id) ?? 0) + rs : curY1 - rs
				const maxY = i < layer.length - 2 ? (yMap.get(layer[i + 2].id) ?? 0) - rs * 2 : curY1 + rs
				let bestY1 = curY1
				let bestY2 = curY2
				let bestLen = lenBefore
				const step = rs * 0.01
				for (let y1 = minY; y1 <= maxY; y1 += step) {
					const y2 = y1 + rs
					if (y2 > (i < layer.length - 2 ? (yMap.get(layer[i + 2].id) ?? 0) - rs : y1 + rs)) continue
					yMap.set(n1.id, y1)
					yMap.set(n2.id, y2)
					const len = nodeEdgeLength(n1.id) + nodeEdgeLength(n2.id)
					if (len < bestLen) {
						bestLen = len
						bestY1 = y1
						bestY2 = y2
					}
				}
				yMap.set(n1.id, bestY1)
				yMap.set(n2.id, bestY2)
				if (bestY1 !== curY1 || bestY2 !== curY2) improved = true
			}
		}
		if (!improved) break
	}

	// Final smoothing: a few light relaxation passes to spread
	// edges more evenly after greedy optimization.
	for (let pass = 0; pass < 5; pass++) {
		for (let li = 0; li < numLayers; li++) {
			relaxLayer(layerNodes[li])
		}
	}

	// Center the entire graph vertically
	let ySum = 0
	let yCount = 0
	for (let li = 0; li < numLayers; li++) {
		for (const n of layerNodes[li]) {
			ySum += yMap.get(n.id) ?? 0
			yCount++
		}
	}
	const yShift = yCount > 0 ? -ySum / yCount : 0

	const levelOffset = (model.maxLevel * levelSpacing) / 2
	for (let li = 0; li < numLayers; li++) {
		for (const n of layerNodes[li]) {
			const baseX = n.level * levelSpacing - levelOffset
			const y = (yMap.get(n.id) ?? 0) + yShift
			if (vertical) {
				n.x = y
				n.y = baseX
			} else {
				n.x = baseX
				n.y = y
			}
		}
	}
}
