/**
 * Fetches the real production graph and measures layout quality.
 * Read-only — does not modify any data.
 *
 * Usage:  npx tsx scripts/test-prod-graph.mts [gameId]
 */
import { buildGraphModel, initializeLayout } from '../app/components/graph/model.js'
import { computeMetrics } from '../app/components/graph/metrics.js'
import type { Bench, Item, Recipe } from '../app/types.js'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const gameId = process.argv[2] ?? '6a693701b0685ec3aaac386f'

async function main() {
	console.log(`Fetching game ${gameId} from ${API_BASE}...`)
	const [items, benches, recipes] = await Promise.all([
		fetch(`${API_BASE}/api/v1/items?gameId=${gameId}`).then((r) => r.json() as Promise<Item[]>),
		fetch(`${API_BASE}/api/v1/benches?gameId=${gameId}`).then((r) => r.json() as Promise<Bench[]>),
		fetch(`${API_BASE}/api/v1/recipes?gameId=${gameId}`).then((r) => r.json() as Promise<Recipe[]>),
	])

	console.log(`  Items: ${items.length}, Benches: ${benches.length}, Recipes: ${recipes.length}`)

	const model = buildGraphModel(items, benches, recipes)
	initializeLayout(model, false)
	const m = computeMetrics(model)

	// Graph dimensions
	const xs = model.nodes.map((n) => n.x)
	const ys = model.nodes.map((n) => n.y)
	const width = Math.max(...xs) - Math.min(...xs)
	const height = Math.max(...ys) - Math.min(...ys)

	// Per-level size breakdown
	const byLevel = new Map<number, number>()
	const byLevelKinds = new Map<number, Map<string, number>>()
	for (const n of model.nodes) {
		byLevel.set(n.level, (byLevel.get(n.level) ?? 0) + 1)
		const kinds = byLevelKinds.get(n.level) ?? new Map<string, number>()
		kinds.set(n.kind, (kinds.get(n.kind) ?? 0) + 1)
		byLevelKinds.set(n.level, kinds)
	}
	const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b)
	const maxLayerSize = Math.max(...byLevel.values())

	console.log('\n==================================================')
	console.log('       Production Graph Layout Metrics')
	console.log('==================================================')
	console.log(`  Nodes:            ${model.nodes.length}`)
	console.log(`  Edges:            ${model.edges.length}`)
	console.log(`  Layers:           ${sortedLevels.length}`)
	console.log(`  Max layer size:   ${maxLayerSize}`)
	console.log()
	console.log('  -- Goal Metrics (v = lower is better, == 0 = must be zero) --')
	console.log(`  Crossings:        ${String(m.crossings).padStart(8)}  v`)
	console.log(`  Overlaps:         ${String(m.nodeOverlaps).padStart(8)}  == 0`)
	console.log(`  Dir violations:   ${String(m.directionViolations).padStart(8)}  == 0`)
	console.log(`  Total edge len:   ${m.totalEdgeLength.toFixed(0).padStart(8)}  v`)
	console.log(`  Avg edge len:     ${m.avgEdgeLength.toFixed(0).padStart(8)}  v`)
	console.log(`  Std edge len:     ${m.stddevEdgeLength.toFixed(0).padStart(8)}  v`)
	console.log(`  Max edge len:     ${m.maxEdgeLength.toFixed(0).padStart(8)}  v`)
	console.log(`  Congestion:       ${m.congestion.toFixed(2).padStart(8)}  v`)
	console.log(`  Graph height:     ${height.toFixed(0).padStart(8)}  v`)
	console.log(`  Graph width:      ${width.toFixed(0).padStart(8)}  v`)
	console.log()

	console.log('  -- Per-Level Sizes --')
	for (const lvl of sortedLevels) {
		const kinds = byLevelKinds.get(lvl)!
		const item = kinds.get('item') ?? 0
		const recipe = kinds.get('recipe') ?? 0
		const dummy = kinds.get('dummy') ?? 0
		const parts: string[] = []
		if (item) parts.push(`${item} item`)
		if (recipe) parts.push(`${recipe} recipe`)
		if (dummy) parts.push(`${dummy} dummy`)
		console.log(`  Level ${String(lvl).padStart(4)}: ${String(byLevel.get(lvl) ?? 0).padStart(3)}  [${parts.join(', ')}]`)
	}

	// Top longest edges
	const edgesWithLen = model.edges.map((e) => {
		const s = model.nodeMap.get(e.source)!
		const t = model.nodeMap.get(e.target)!
		const len = Math.hypot(s.x - t.x, s.y - t.y)
		return { len, sLevel: s.level, tLevel: t.level, sLabel: s.label, tLabel: t.label }
	})
	edgesWithLen.sort((a, b) => b.len - a.len)
	console.log('\n  -- Top 10 Longest Edges --')
	for (const { len, sLevel, tLevel, sLabel, tLabel } of edgesWithLen.slice(0, 10)) {
		console.log(`  ${len.toFixed(0).padStart(6)}px  [${sLevel}>${tLevel}]  ${sLabel} > ${tLabel}`)
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
