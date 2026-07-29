/**
 * Standalone investigative tool: runs the graph simulation on synthetic
 * crafting data and reports metrics at progressive recipe counts.
 *
 * Usage:  npx tsx scripts/test-graph-layout.mts
 *
 * This validates the algorithm without a browser — measures crossings,
 * direction violations, node overlaps, congestion, and convergence across
 * different graph sizes and structures (chains, trees, diamonds, cycles).
 */
import { buildGraphModel, initializeLayout } from '../app/components/graph/model.js'
import { tick, reduceCrossings } from '../app/components/graph/simulation.js'
import { computeMetrics } from '../app/components/graph/metrics.js'
import { DEFAULT_PARAMS } from '../app/components/graph/types.js'
import type { Item, Bench, Recipe } from '../app/types.js'

// --- Synthetic data generators ----------------------------------------------

let idCounter = 0
const uid = (p: string) => `${p}${idCounter++}`

function makeItem(name: string): Item {
	return { id: uid('i'), name, attributes: {}, category: null, gameId: 'test' }
}

function makeBench(name: string): Bench {
	return { id: uid('b'), name, inputs: [], gameId: 'test' }
}

function makeRecipe(benchId: string, inputs: Item[], outputs: Item[]): Recipe {
	return {
		id: uid('r'),
		gameId: 'test',
		benchId,
		inputs: inputs.map((i) => ({ item: i.id, itemName: i.name, count: 1 })),
		outputs: outputs.map((o) => ({ item: o.id, itemName: o.name, count: 1 })),
	}
}

/** Linear chain: A -> B -> C -> D -> E */
function chainRecipe(length: number, benchId: string): { items: Item[]; recipes: Recipe[] } {
	const items: Item[] = []
	const recipes: Recipe[] = []
	let prev = makeItem('A')
	items.push(prev)
	for (let i = 1; i < length; i++) {
		const next = makeItem(String.fromCharCode(65 + i))
		items.push(next)
		recipes.push(makeRecipe(benchId, [prev], [next]))
		prev = next
	}
	return { items, recipes }
}

/** Tree: root splits into 2, each splits into 2, etc. */
function treeRecipe(depth: number, benchId: string): { items: Item[]; recipes: Recipe[] } {
	const items: Item[] = []
	const recipes: Recipe[] = []
	const make = (parent: Item | null, d: number): Item => {
		const node = makeItem(`d${d}_${idCounter}`)
		items.push(node)
		if (parent) recipes.push(makeRecipe(benchId, [parent], [node]))
		if (d < depth) {
			make(node, d + 1)
			make(node, d + 1)
		}
		return node
	}
	make(null, 0)
	return { items, recipes }
}

/** Diamond: A -> B, A -> C, B -> D, C -> D (creates crossings) */
function diamondRecipe(count: number, benchId: string): { items: Item[]; recipes: Recipe[] } {
	const items: Item[] = []
	const recipes: Recipe[] = []
	for (let d = 0; d < count; d++) {
		const a = makeItem(`A${d}`)
		const b = makeItem(`B${d}`)
		const c = makeItem(`C${d}`)
		const e = makeItem(`E${d}`)
		items.push(a, b, c, e)
		recipes.push(makeRecipe(benchId, [a], [b]))
		recipes.push(makeRecipe(benchId, [a], [c]))
		recipes.push(makeRecipe(benchId, [b], [e]))
		recipes.push(makeRecipe(benchId, [c], [e]))
	}
	return { items, recipes }
}

/** Cycle: A -> B -> C -> A */
function cycleRecipe(length: number, benchId: string): { items: Item[]; recipes: Recipe[] } {
	const items: Item[] = []
	const recipes: Recipe[] = []
	const ring: Item[] = []
	for (let i = 0; i < length; i++) {
		ring.push(makeItem(`C${i}`))
		items.push(ring[i])
	}
	for (let i = 0; i < length; i++) {
		recipes.push(makeRecipe(benchId, [ring[i]], [ring[(i + 1) % length]]))
	}
	return { items, recipes }
}

/** Mesh: layers of nodes where each node in layer L connects to multiple
 *  nodes in layer L+1. This creates many potential crossings. */
function meshRecipe(layers: number, width: number, benchId: string): { items: Item[]; recipes: Recipe[] } {
	const items: Item[] = []
	const recipes: Recipe[] = []
	const grid: Item[][] = []
	for (let l = 0; l < layers; l++) {
		grid[l] = []
		for (let w = 0; w < width; w++) {
			const node = makeItem(`L${l}W${w}`)
			items.push(node)
			grid[l].push(node)
		}
	}
	for (let l = 0; l < layers - 1; l++) {
		for (let w = 0; w < width; w++) {
			// Each node connects to 2-3 nodes in next layer
			const targets = Math.min(width, 2 + (w % 2))
			for (let t = 0; t < targets; t++) {
				const targetIdx = (w + t) % width
				recipes.push(makeRecipe(benchId, [grid[l][w]], [grid[l + 1][targetIdx]]))
			}
		}
	}
	return { items, recipes }
}

/** Multi-input/output recipe: nodes with 2-3 inputs and 2-3 outputs,
 *  simulating real crafting graphs with complex dependencies. */
function complexRecipe(count: number, benchId: string): { items: Item[]; recipes: Recipe[] } {
	const items: Item[] = []
	const recipes: Recipe[] = []
	// Source items (raw materials)
	const sources: Item[] = []
	for (let i = 0; i < Math.ceil(count * 0.4); i++) {
		const s = makeItem(`src${i}`)
		items.push(s)
		sources.push(s)
	}
	// Intermediate items, each made from 2 sources or prior intermediates
	const intermediates: Item[] = []
	for (let i = 0; i < count; i++) {
		const out = makeItem(`mid${i}`)
		items.push(out)
		intermediates.push(out)
		const pool = [...sources, ...intermediates.slice(0, i)]
		// Pick 2 distinct inputs
		const inA = pool[i % pool.length]
		const inB = pool[(i + Math.floor(pool.length / 2)) % pool.length]
		const inputs = inA === inB ? [inA] : [inA, inB]
		recipes.push(makeRecipe(benchId, inputs, [out]))
	}
	// Final products: combine 2-3 intermediates
	for (let i = 0; i < Math.floor(count * 0.3); i++) {
		const out = makeItem(`prod${i}`)
		items.push(out)
		const a = intermediates[i % intermediates.length]
		const b = intermediates[(i + 3) % intermediates.length]
		const c = intermediates[(i + 7) % intermediates.length]
		const inputs = [a, b, c].filter((v, idx, arr) => arr.indexOf(v) === idx)
		recipes.push(makeRecipe(benchId, inputs, [out]))
	}
	return { items, recipes }
}

/** Two interlocking diamonds sharing a node — stress test for
 *  crossing reduction with shared endpoints. */
function linkedDiamonds(count: number, benchId: string): { items: Item[]; recipes: Recipe[] } {
	const items: Item[] = []
	const recipes: Recipe[] = []
	let prevE: Item | null = null
	for (let d = 0; d < count; d++) {
		const a = prevE ?? makeItem(`A${d}`)
		if (!prevE) items.push(a)
		const b = makeItem(`B${d}`)
		const c = makeItem(`C${d}`)
		const e = makeItem(`E${d}`)
		items.push(b, c, e)
		recipes.push(makeRecipe(benchId, [a], [b]))
		recipes.push(makeRecipe(benchId, [a], [c]))
		recipes.push(makeRecipe(benchId, [b], [e]))
		recipes.push(makeRecipe(benchId, [c], [e]))
		prevE = e
	}
	return { items, recipes }
}

// --- Simulation runner -------------------------------------------------------

interface RunResult {
	ticks: number
	crossings: number
	directionViolations: number
	nodeOverlaps: number
	congestion: number
	energy: number
	converged: boolean
}

function runSimulation(items: Item[], benches: Bench[], recipes: Recipe[], maxTicks = 2000): RunResult {
	const model = buildGraphModel(items, benches, recipes)
	initializeLayout(model, false)
	const params = { ...DEFAULT_PARAMS, alpha: 1 }
	let crossingDone = false

	for (let t = 0; t < maxTicks; t++) {
		if (params.alpha <= params.alphaMin) break
		if (!crossingDone && params.alpha < 0.15) {
			reduceCrossings(model)
			crossingDone = true
			params.alpha = Math.max(params.alpha, 0.3)
		}
		tick(model, params)
		params.alpha *= 1 - params.alphaDecay
	}

	// Final post-processing: reduce crossings + resolve overlaps after
	// the simulation has fully converged. This ensures the final layout
	// has no overlaps, since the simulation's barycenter force can pull
	// nodes back together after the mid-simulation reduceCrossings.
	reduceCrossings(model)

	const m = computeMetrics(model, params)
	return {
		ticks: maxTicks,
		crossings: m.crossings,
		directionViolations: m.directionViolations,
		nodeOverlaps: m.nodeOverlaps,
		congestion: m.congestion,
		energy: m.energy,
		converged: m.converged,
	}
}

// --- Progressive test: add recipes one by one ---------------------------------

function progressiveTest(label: string, allItems: Item[], benches: Bench[], allRecipes: Recipe[]) {
	console.log(`\n=== ${label} (progressive) ===`)
	console.log('Recipes | Nodes | Edges | Cross | DirV | Overlap | Congest | Energy')
	const bench = benches[0]
	for (let n = 1; n <= allRecipes.length; n++) {
		const subset = allRecipes.slice(0, n)
		const usedIds = new Set<string>()
		for (const r of subset) {
			for (const s of r.inputs) usedIds.add(s.item)
			for (const s of r.outputs) usedIds.add(s.item)
		}
		const items = allItems.filter((i) => usedIds.has(i.id))
		const r = runSimulation(items, [bench], subset)
		const model = buildGraphModel(items, [bench], subset)
		console.log(
			`${n.toString().padStart(7)} | ${items.length.toString().padStart(5)} | ${model.edges.length.toString().padStart(5)} | ${r.crossings.toString().padStart(5)} | ${r.directionViolations.toString().padStart(4)} | ${r.nodeOverlaps.toString().padStart(7)} | ${r.congestion.toFixed(2).padStart(7)} | ${r.energy.toFixed(0).padStart(6)}`,
		)
	}
}

// --- Main --------------------------------------------------------------------

const bench = makeBench('TestBench')
const benches: Bench[] = [bench]

console.log('=== Graph Layout Algorithm Validation ===')
console.log(`Default params: repulsion=${DEFAULT_PARAMS.repulsion} spring=${DEFAULT_PARAMS.springStrength} flow=${DEFAULT_PARAMS.flowStrength} barycenter=${DEFAULT_PARAMS.barycenterStrength} crossingPenalty=${DEFAULT_PARAMS.crossingPenalty}`)

// Chain
const chain = chainRecipe(8, bench.id)
progressiveTest('Chain (8 items)', chain.items, benches, chain.recipes)

// Tree
const tree = treeRecipe(3, bench.id)
progressiveTest('Tree (depth 3)', tree.items, benches, tree.recipes)

// Diamonds
const diamonds = diamondRecipe(5, bench.id)
progressiveTest('Diamonds (x5)', diamonds.items, benches, diamonds.recipes)

// Cycle
const cycle = cycleRecipe(5, bench.id)
progressiveTest('Cycle (5 nodes)', cycle.items, benches, cycle.recipes)

// Combined: chain + tree + diamonds + cycle
const allItems = [...chain.items, ...tree.items, ...diamonds.items, ...cycle.items]
const allRecipes = [...chain.recipes, ...tree.recipes, ...diamonds.recipes, ...cycle.recipes]
progressiveTest('Combined (all)', allItems, benches, allRecipes)

// --- Larger stress tests ---

// Big tree (depth 4 = 31 nodes, 30 edges)
const bigTree = treeRecipe(4, bench.id)
progressiveTest('Big Tree (depth 4)', bigTree.items, benches, bigTree.recipes)

// Many diamonds (x15 = 60 nodes, 60 edges)
const manyDiamonds = diamondRecipe(15, bench.id)
progressiveTest('Many Diamonds (x15)', manyDiamonds.items, benches, manyDiamonds.recipes)

// Big cycle (10 nodes)
const bigCycle = cycleRecipe(10, bench.id)
progressiveTest('Big Cycle (10 nodes)', bigCycle.items, benches, bigCycle.recipes)

// Mesh (5 layers x 6 wide = 30 nodes, ~60 edges, many crossings)
const mesh = meshRecipe(5, 6, bench.id)
progressiveTest('Mesh (5x6)', mesh.items, benches, mesh.recipes)

// Complex recipes (20 recipes with multi-input/output)
const complex = complexRecipe(20, bench.id)
progressiveTest('Complex (20 recipes)', complex.items, benches, complex.recipes)

// Linked diamonds (10 linked = 31 nodes, 40 edges)
const linked = linkedDiamonds(10, bench.id)
progressiveTest('Linked Diamonds (x10)', linked.items, benches, linked.recipes)

// Mega combined: everything together
const megaItems = [...allItems, ...bigTree.items, ...manyDiamonds.items, ...bigCycle.items, ...mesh.items, ...complex.items, ...linked.items]
const megaRecipes = [...allRecipes, ...bigTree.recipes, ...manyDiamonds.recipes, ...bigCycle.recipes, ...mesh.recipes, ...complex.recipes, ...linked.recipes]
progressiveTest('Mega Combined (all)', megaItems, benches, megaRecipes)

console.log('\n=== Done ===')
