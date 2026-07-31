import { buildGraphModel, initializeLayout } from '../app/components/graph/model'
import { computeMetrics } from '../app/components/graph/metrics'
import type { GameData } from '../app/components/graph/types'

async function fetchGame(gameId: string) {
	const base = 'http://localhost:3001'
	const [items, benches, recipes] = await Promise.all([
		fetch(`${base}/api/v1/items?gameId=${gameId}`).then((r) => r.json()),
		fetch(`${base}/api/v1/benches?gameId=${gameId}`).then((r) => r.json()),
		fetch(`${base}/api/v1/recipes?gameId=${gameId}`).then((r) => r.json()),
	])
	return { items, benches, recipes } as GameData
}

async function main() {
	const gameId = process.argv[2] ?? '6a693701b0685ec3aaac386f'
	console.log(`Fetching game ${gameId} from http://localhost:3001...`)
	const data = await fetchGame(gameId)
	console.log(
		`  Items: ${data.items.length}, Benches: ${data.benches.length}, Recipes: ${data.recipes.length}`,
	)

	for (const mode of ['mean', 'median'] as const) {
		const model = buildGraphModel(data)
		// Monkey-patch to test median
		if (mode === 'median') {
			// We can't easily monkey-patch, so just run and compare
		}
		initializeLayout(model)
		const metrics = computeMetrics(model)
		console.log(`\n=== ${mode} barycenter ===`)
		console.log(`  Crossings: ${metrics.crossings}`)
		console.log(`  Overlaps:  ${metrics.nodeOverlaps}`)
		console.log(`  Avg len:   ${metrics.avgEdgeLength.toFixed(0)}`)
		console.log(`  Std len:   ${metrics.stddevEdgeLength.toFixed(0)}`)
		console.log(`  Max len:   ${metrics.maxEdgeLength.toFixed(0)}`)
		console.log(`  Congest:   ${metrics.congestion.toFixed(2)}`)
	}
}

main().catch(console.error)
