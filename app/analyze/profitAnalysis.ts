import type { Bench, Item, Recipe } from '../types'

export interface SlotView {
	itemId: string
	name: string
	count: number
}

export interface RecipeProfit {
	recipeId: string
	benchName: string
	inputs: SlotView[]
	outputs: SlotView[]
	inputCost: number
	outputValue: number
	profit: number
	ratio: number
	logRatio: number
	/** Item names referenced by the recipe that exist but lack a numeric value for the cost attribute. */
	unknownItems: string[]
	/** False if any input/output item is missing or lacks a numeric cost value. */
	computable: boolean
}

export interface ChainStep {
	recipeId: string
	benchName: string
	inputs: SlotView[]
	outputs: SlotView[]
	profit: number
	cumulative: number
	ratio: number
	cumulativeRatio: number
}

export interface ProfitAnalysis {
	costKey: string
	itemValues: Map<string, number>
	itemsWithoutCost: { id: string; name: string }[]
	recipes: RecipeProfit[]
	computableCount: number
	bestRecipe: RecipeProfit | null
	bestChain: ChainStep[] | null
	bestChainProfit: number
	bestChainRatio: number
	arbitrage: boolean
}

function parseNumber(v: string | string[] | undefined): number | null {
	if (v == null) return null
	if (Array.isArray(v)) {
		for (const part of v) {
			const n = Number.parseFloat(part)
			if (Number.isFinite(n)) return n
		}
		return null
	}
	const n = Number.parseFloat(v)
	return Number.isFinite(n) ? n : null
}

export function analyzeProfits(
	items: Item[],
	recipes: Recipe[],
	benches: Bench[],
	costKey: string,
	opts: {
		startItemId?: string | null
		startCategory?: string | null
		endItemId?: string | null
		endCategory?: string | null
	} = {},
): ProfitAnalysis {
	const itemMap = new Map(items.map((i) => [i.id, i]))
	const benchName = new Map(benches.map((b) => [b.id, b.name ?? '?']))
	const itemCategory = new Map<string, string | null>(
		items.map((i) => [i.id, i.category]),
	)
	const itemValues = new Map<string, number>()
	const itemsWithoutCost: { id: string; name: string }[] = []
	for (const it of items) {
		const v = parseNumber(it.attributes?.[costKey])
		if (v == null) itemsWithoutCost.push({ id: it.id, name: it.name ?? it.id })
		else itemValues.set(it.id, v)
	}

	const all: RecipeProfit[] = recipes.map((r) => {
		const bName = benchName.get(r.benchId) ?? r.benchName ?? '?'
		let inputCost = 0
		let outputValue = 0
		const unknown = new Set<string>()
		let computable = true

		const ins: SlotView[] = r.inputs.map((s) => {
			const it = itemMap.get(s.item)
			const v = it ? (itemValues.get(s.item) ?? null) : null
			if (v == null) {
				computable = false
				if (it) unknown.add(it.name ?? s.item)
			}
			inputCost += (v ?? 0) * s.count
			return { itemId: s.item, name: it?.name ?? s.item, count: s.count }
		})
		const outs: SlotView[] = r.outputs.map((s) => {
			const it = itemMap.get(s.item)
			const v = it ? (itemValues.get(s.item) ?? null) : null
			if (v == null) {
				computable = false
				if (it) unknown.add(it.name ?? s.item)
			}
			outputValue += (v ?? 0) * s.count
			return { itemId: s.item, name: it?.name ?? s.item, count: s.count }
		})

		const profit = outputValue - inputCost
		const ratio = inputCost > 0 ? outputValue / inputCost : outputValue > 0 ? Infinity : 1
		const logRatio = Number.isFinite(ratio) && ratio > 0 ? Math.log(ratio) : ratio > 0 ? 1e15 : -1e15
		return {
			recipeId: r.id,
			benchName: bName,
			inputs: ins,
			outputs: outs,
			inputCost,
			outputValue,
			profit,
			ratio,
			logRatio,
			unknownItems: [...unknown],
			computable,
		}
	})

	const computable = all.filter((r) => r.computable)
	const bestRecipe = computable.length
		? computable.reduce((a, b) => (b.ratio > a.ratio ? b : a))
		: null

	const { chain, profit, ratio, arbitrage } = bestChain(
		computable,
		opts.startItemId ?? null,
		opts.startCategory ?? null,
		opts.endItemId ?? null,
		opts.endCategory ?? null,
		itemCategory,
	)

	return {
		costKey,
		itemValues,
		itemsWithoutCost,
		recipes: [...all].sort((a, b) => b.ratio - a.ratio),
		computableCount: computable.length,
		bestRecipe,
		bestChain: chain,
		bestChainProfit: profit,
		bestChainRatio: ratio,
		arbitrage,
	}
}

/**
 * Finds the connected sequence of recipes that multiplies value the most.
 *
 * Recipes are nodes; an edge A→B exists when some output of A is an input of B
 * (A feeds B). Each node is weighted by its independent ratio (output/input).
 * The best chain maximizes the product of ratios, which is equivalent to
 * maximizing the sum of log-ratios (node-weighted longest path). Because the
 * recipe graph may contain cycles, we use Bellman-Ford-style relaxation: after
 * |V| passes, any further improvement indicates a cycle whose product of
 * ratios exceeds 1 (arbitrage) that can be repeated for unbounded gain.
 */
function bestChain(
	nodes: RecipeProfit[],
	startItemId: string | null,
	startCategory: string | null,
	endItemId: string | null,
	endCategory: string | null,
	itemCategory: Map<string, string | null>,
): { chain: ChainStep[] | null; profit: number; ratio: number; arbitrage: boolean } {
	const n = nodes.length
	if (n === 0) return { chain: null, profit: 0, ratio: 0, arbitrage: false }

	const outItemSets = nodes.map((r) => new Set(r.outputs.map((s) => s.itemId)))
	const inItemSets = nodes.map((r) => new Set(r.inputs.map((s) => s.itemId)))
	const adj: number[][] = nodes.map(() => [])
	for (let a = 0; a < n; a++) {
		for (let b = 0; b < n; b++) {
			if (a === b) continue
			for (const o of outItemSets[a]) {
				if (inItemSets[b].has(o)) {
					adj[a].push(b)
					break
				}
			}
		}
	}

	const startOk = (r: RecipeProfit) => {
		if (startItemId && !r.inputs.some((s) => s.itemId === startItemId)) return false
		if (startCategory) {
			// At least one input of the starting recipe must be of the required category,
			// and no input may be of a different category (i.e. the recipe's inputs are
			// sourced from that category).
			const cats = r.inputs.map((s) => itemCategory.get(s.itemId) ?? null)
			if (!cats.some((c) => c === startCategory)) return false
			if (cats.some((c) => c !== null && c !== startCategory)) return false
		}
		return true
	}
	const endOk = (r: RecipeProfit) => {
		if (endItemId && !r.outputs.some((s) => s.itemId === endItemId)) return false
		if (endCategory) {
			// At least one output of the ending recipe must be of the required category,
			// and no output may be of a different category.
			const cats = r.outputs.map((s) => itemCategory.get(s.itemId) ?? null)
			if (!cats.some((c) => c === endCategory)) return false
			if (cats.some((c) => c !== null && c !== endCategory)) return false
		}
		return true
	}

	const NEG = -Infinity
	const logW = nodes.map((r) => r.logRatio)
	const dist = nodes.map((r, i) => (startOk(r) ? logW[i] : NEG))
	const pred = new Array<number>(n).fill(-1)

	let arbitrage = false
	for (let iter = 0; iter < n; iter++) {
		let updated = false
		for (let a = 0; a < n; a++) {
			if (dist[a] === NEG) continue
			for (const b of adj[a]) {
				const cand = dist[a] + logW[b]
				if (cand > dist[b]) {
					dist[b] = cand
					pred[b] = a
					updated = true
				}
			}
		}
		if (!updated) break
		if (iter === n - 1 && updated) arbitrage = true
	}

	if (arbitrage) return { chain: null, profit: Infinity, ratio: Infinity, arbitrage: true }

	let end = -1
	let best = NEG
	for (let i = 0; i < n; i++) {
		if (!endOk(nodes[i])) continue
		if (dist[i] > best) {
			best = dist[i]
			end = i
		}
	}
	if (end === -1 || best === NEG) return { chain: null, profit: 0, ratio: 0, arbitrage: false }

	const chain: ChainStep[] = []
	let cur = end
	const guard = new Set<number>()
	while (cur !== -1 && !guard.has(cur)) {
		guard.add(cur)
		chain.unshift({
			recipeId: nodes[cur].recipeId,
			benchName: nodes[cur].benchName,
			inputs: nodes[cur].inputs,
			outputs: nodes[cur].outputs,
			profit: nodes[cur].profit,
			cumulative: 0,
			ratio: nodes[cur].ratio,
			cumulativeRatio: 1,
		})
		cur = pred[cur]
	}
	let running = 0
	let runningRatio = 1
	for (const step of chain) {
		running += step.profit
		step.cumulative = running
		runningRatio *= step.ratio
		step.cumulativeRatio = runningRatio
	}
	return { chain, profit: running, ratio: runningRatio, arbitrage: false }
}
