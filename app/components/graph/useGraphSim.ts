'use client'

import { useMemo } from 'react'
import { buildGraphModel, initializeLayout } from './model'
import { computeMetrics } from './metrics'
import type { GraphModel, Metrics } from './types'
import type { Bench, Item, Recipe } from '../../types'

interface UseGraphSimResult {
	model: GraphModel | null
	metrics: Metrics | null
}

export function useGraphSim(
	items: Item[],
	benches: Bench[],
	recipes: Recipe[],
	recipeCount: number,
	vertical = false,
): UseGraphSimResult {
	const { model, metrics } = useMemo(() => {
		const subset = recipes.slice(0, recipeCount)
		const usedItemIds = new Set<string>()
		for (const r of subset) {
			for (const inp of r.inputs) usedItemIds.add(inp.item)
			for (const state of r.outputs) usedItemIds.add(state.item)
		}
		const filteredItems = items.filter((i) => usedItemIds.has(i.id))
		const m = buildGraphModel(filteredItems, benches, subset)
		initializeLayout(m, vertical)
		return { model: m, metrics: computeMetrics(m) }
	}, [items, benches, recipes, recipeCount, vertical])

	return { model, metrics }
}
