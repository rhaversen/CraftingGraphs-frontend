import { buildGraphModel } from '../app/components/graph/model'
import { computeMetrics } from '../app/components/graph/metrics'
import type { Item, Bench, Recipe } from '../app/lib/api-types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001'
const GAME_ID = process.argv[2] || '6a693701b0685ec3aaac386f'

async function fetchJson<T>(path: string): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`)
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${path}`)
	return res.json()
}

async function main() {
	console.log(`Fetching game ${GAME_ID} from ${API_BASE}...`)
	const [items, benches, recipes] = await Promise.all([
		fetchJson<Item[]>('/api/v1/items'),
		fetchJson<Bench[]>('/api/v1/benches'),
		fetchJson<Recipe[]>('/api/v1/recipes'),
	])

	const model = buildGraphModel(items, benches, recipes)

	// Find high-fanout item nodes and their predecessors
	const highFanout = model.nodes
		.filter((n) => n.kind === 'item' && n.outDegree >= 5)
		.sort((a, b) => b.outDegree - a.outDegree)

	console.log('\nHigh-fanout items (outDegree >= 5):')
	for (const n of highFanout) {
		const preds = model.reverseAdjacency.get(n.id) ?? []
		const succs = model.adjacency.get(n.id) ?? []
		const predNames = preds.map((p) => {
			const pn = model.nodes.find((x) => x.id === p)
			return pn ? `${pn.label}(${pn.outDegree}out)` : p
		})
		console.log(
			`  ${n.label.padEnd(20)} lvl=${n.level} in=${n.inDegree} out=${n.outDegree} preds=[${predNames.join(', ')}]`,
		)
	}
}

main().catch(console.error)
