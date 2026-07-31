import { buildGraphModel, initializeLayout } from '../app/components/graph/model.js'
import type { Item, Bench, Recipe } from '../app/lib/api-types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001'
const GAME_ID = process.argv[2] || '6a693701b0685ec3aaac386f'

async function fetchJson<T>(path: string): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`)
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${path}`)
	return res.json()
}

async function main() {
	const [items, benches, recipes] = await Promise.all([
		fetchJson<Item[]>('/api/v1/items'),
		fetchJson<Bench[]>('/api/v1/benches'),
		fetchJson<Recipe[]>('/api/v1/recipes'),
	])

	const model = buildGraphModel(items, benches, recipes)
	initializeLayout(model, false)

	// Find Grow Tent recipe nodes
	const growTents = model.nodes.filter((n) => n.kind === 'recipe' && n.label === 'Grow Tent')
	console.log('Grow Tent recipe nodes:')
	for (const n of growTents) {
		const outs = model.adjacency.get(n.id) ?? []
		const outNames = outs.map((o) => model.nodes.find((x) => x.id === o)?.label ?? o)
		console.log(`  y=${Math.round(n.y).toString().padStart(6)} out=[${outNames}]`)
	}

	// Find high-fanout items and their y-positions
	const highFanout = model.nodes
		.filter((n) => n.kind === 'item' && n.outDegree >= 5)
		.sort((a, b) => b.outDegree - a.outDegree)

	console.log('\nHigh-fanout items with y-positions:')
	for (const n of highFanout) {
		const preds = model.reverseAdjacency.get(n.id) ?? []
		const predYs = preds.map((p) => {
			const pn = model.nodes.find((x) => x.id === p)
			return pn ? `${pn.label}@${Math.round(pn.y)}` : p
		})
		const succs = model.adjacency.get(n.id) ?? []
		const succYs = succs.map((s) => {
			const sn = model.nodes.find((x) => x.id === s)
			return sn ? Math.round(sn.y) : 0
		})
		const succYSpread = succYs.length > 0 ? Math.max(...succYs) - Math.min(...succYs) : 0
		console.log(
			`  ${n.label.padEnd(20)} y=${Math.round(n.y).toString().padStart(6)} preds=[${predYs.join(', ')}] succYSpread=${Math.round(succYSpread)}`,
		)
	}
}

main().catch(console.error)
