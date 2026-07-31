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
			vx: 0,
			vy: 0,
			fx: null,
			fy: null,
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
			vx: 0,
			vy: 0,
			fx: null,
			fy: null,
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
		// copy so each copy feeds exactly one recipe.
		for (const input of validInputs) {
			let sourceNodeId = input.item
			if (duplicatedSources.has(input.item)) {
				sourceNodeId = `${input.item}__${recipe.id}`
				if (!nodeMap.has(sourceNodeId)) {
					const orig = nodeMap.get(input.item)!
					nodeMap.set(sourceNodeId, { ...orig, id: sourceNodeId })
				}
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
	const rowSpacing = 100
	const levelOffset = (model.maxLevel * levelSpacing) / 2

	// Group nodes by level (recipe nodes use half-levels like 0.5, 1.5)
	const byLevel = new Map<number, SimNode[]>()
	for (const n of model.nodes) {
		const arr = byLevel.get(n.level) ?? []
		arr.push(n)
		byLevel.set(n.level, arr)
	}

	// Place nodes level by level. Within each level, sort by barycenter:
	// the average y of already-placed incoming neighbors. This gives a
	// crossing-reduced starting layout. Seed level 0 with stable order.
	const placedY = new Map<string, number>()
	const levels = [...byLevel.keys()].sort((a, b) => a - b)
	// Stable counter for nodes without incoming edges (deterministic spread)
	let seedCounter = 0
	for (const lvl of levels) {
		const group = byLevel.get(lvl)!
		// Compute barycenter for each node in this level
		const withBary = group.map((n) => {
			const incoming = model.reverseAdjacency.get(n.id) ?? []
			let sum = 0
			let count = 0
			for (const id of incoming) {
				const y = placedY.get(id)
				if (y !== undefined) {
					sum += y
					count++
				}
			}
			// Deterministic fallback: spread evenly using a stable counter
			const fallback = (seedCounter++ - group.length / 2) * rowSpacing
			const bary = count > 0 ? sum / count : fallback
			return { n, bary, hasIncoming: count > 0 }
		})
		withBary.sort((a, b) => a.bary - b.bary)
		const total = withBary.length
		const isRecipeLevel = group[0]?.kind === 'recipe'
		const rs = isRecipeLevel ? 80 : rowSpacing
		const startY = -((total - 1) * rs) / 2
		withBary.forEach(({ n, bary, hasIncoming }, i) => {
			// Use the barycenter directly when available (crossing-reduced),
			// otherwise fall back to evenly spaced positions.
			const y = hasIncoming ? bary : startY + i * rs
			placedY.set(n.id, y)
			const baseX = n.level * levelSpacing - levelOffset
			if (vertical) {
				n.x = y
				n.y = baseX
			} else {
				n.x = baseX
				n.y = y
			}
			n.vx = 0
			n.vy = 0
		})
	}
}
