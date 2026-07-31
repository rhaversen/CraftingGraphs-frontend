import { buildGraphModel, initializeLayout } from '../app/components/graph/model.js'
import { computeMetrics } from '../app/components/graph/metrics.js'
import type { Bench, Item, Recipe } from '../app/types.js'

async function main() {
	const gameId = '6a693701b0685ec3aaac386f'
	const base = 'http://localhost:3001'

	const [items, benches, recipes] = await Promise.all([
		fetch(`${base}/api/v1/items?gameId=${gameId}`).then((r) => r.json() as Promise<Item[]>),
		fetch(`${base}/api/v1/benches?gameId=${gameId}`).then((r) => r.json() as Promise<Bench[]>),
		fetch(`${base}/api/v1/recipes?gameId=${gameId}`).then((r) => r.json() as Promise<Recipe[]>),
	])

	console.log(`  Items: ${items.length}, Benches: ${benches.length}, Recipes: ${recipes.length}`)

	const model = buildGraphModel(items, benches, recipes)
	initializeLayout(model, false)
	const metrics = computeMetrics(model)

	// Find high-fanout nodes (nodes with many neighbors)
	const fanout: { id: string; name: string; kind: string; inDeg: number; outDeg: number; total: number; level: number }[] = []
	for (const node of model.nodes) {
		const inc = model.reverseAdjacency.get(node.id) ?? []
		const out = model.adjacency.get(node.id) ?? []
		fanout.push({
			id: node.id,
			name: node.label,
			kind: node.kind,
			inDeg: inc.length,
			outDeg: out.length,
			total: inc.length + out.length,
			level: node.level,
		})
	}
	fanout.sort((a, b) => b.total - a.total)

	console.log('Top 20 highest-fanout nodes:')
	console.log('  Name                    Kind    In  Out  Total  Level')
	console.log('  ----------------------- ------- --- --- -----  -----')
	for (const f of fanout.slice(0, 20)) {
		console.log(
			`  ${f.name.padEnd(23)} ${f.kind.padEnd(7)} ${String(f.inDeg).padStart(3)} ${String(f.outDeg).padStart(3)} ${String(f.total).padStart(5)}  ${f.level}`,
		)
	}

	// Show all Mixing Station recipe nodes
	const msNodes = model.nodes.filter((n) => n.label === 'Mixing Station')
	console.log(`\nMixing Station nodes (${msNodes.length}):`)
	for (const n of msNodes) {
		const inc = model.reverseAdjacency.get(n.id) ?? []
		const out = model.adjacency.get(n.id) ?? []
		const incNames = inc.map((id) => model.nodes.find((m) => m.id === id)?.label).join(', ')
		const outNames = out.map((id) => model.nodes.find((m) => m.id === id)?.label).join(', ')
		console.log(`  id=${n.id} level=${n.level} y=${n.y?.toFixed(0)} in=[${incNames}] out=[${outNames}]`)
	}

	console.log(`\nMetrics: crossings=${metrics.crossings}, maxEdge=${metrics.maxEdgeLength}`)

	// Show the 20 longest edges
	const edgeLens: { from: string; to: string; fromLevel: number; toLevel: number; fromY: number; toY: number; len: number }[] = []
	for (const e of model.edges) {
		const a = model.nodes.find((n) => n.id === e.source)
		const b = model.nodes.find((n) => n.id === e.target)
		if (!a || !b || a.y == null || b.y == null) continue
		const len = Math.abs(a.y - b.y)
		edgeLens.push({ from: a.label, to: b.label, fromLevel: a.level, toLevel: b.level, fromY: a.y, toY: b.y, len })
	}
	edgeLens.sort((a, b) => b.len - a.len)

	console.log('\nTop 20 longest edges:')
	console.log('  From                    To                      Levels     Len     FromY   ToY')
	console.log('  ----------------------- ----------------------- ---------- ------- ------- -------')
	for (const e of edgeLens.slice(0, 20)) {
		console.log(
			`  ${e.from.padEnd(23)} ${e.to.padEnd(23)} ${String(e.fromLevel).padStart(2)}->${String(e.toLevel).padEnd(2)}  ${String(e.len).padStart(7)} ${String(e.fromY.toFixed(0)).padStart(7)} ${String(e.toY.toFixed(0)).padStart(7)}`,
		)
	}

	// Show y-spread of high-fanout items
	console.log('\nY-spread of high-fanout item nodes (out-degree > 5):')
	for (const f of fanout.filter((f) => f.kind === 'item' && f.outDeg > 5).slice(0, 10)) {
		const node = model.nodes.find((n) => n.id === f.id)!
		const out = model.adjacency.get(node.id) ?? []
		const outYs = out.map((id) => model.nodes.find((n) => n.id === id)?.y).filter((y) => y != null) as number[]
		const minY = Math.min(...outYs)
		const maxY = Math.max(...outYs)
		const spread = maxY - minY
		console.log(`  ${f.name.padEnd(23)} y=${node.y?.toFixed(0).padStart(7)}  outs: ${outYs.length}  min=${minY.toFixed(0)} max=${maxY.toFixed(0)} spread=${spread.toFixed(0)}`)
	}
}

main().catch(console.error)
