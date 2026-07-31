'use client'

import { useMemo, useState } from 'react'
import {
	ReactFlow,
	ReactFlowProvider,
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Bench, Item, Recipe } from '../types'
import { useGraphSim } from './graph/useGraphSim'
import { ItemNode } from './graph/ItemNode'
import { RecipeNode } from './graph/RecipeNode'
import { MetricsPanel } from './graph/MetricsPanel'

interface RecipeGraphProps {
	items: Item[]
	benches: Bench[]
	recipes: Recipe[]
}

const nodeTypes = { item: ItemNode, recipe: RecipeNode }

function classifyItem(inDegree: number, outDegree: number): 'raw' | 'final' | 'intermediate' {
	if (inDegree === 0) return 'raw'
	if (outDegree === 0) return 'final'
	return 'intermediate'
}

function RecipeGraphInner({ items, benches, recipes }: RecipeGraphProps) {
	const [recipeCount, setRecipeCount] = useState(recipes.length)
	const [showMetrics, setShowMetrics] = useState(true)

	const effectiveCount = Math.min(recipeCount, recipes.length)
	const sim = useGraphSim(items, benches, recipes, effectiveCount)

	const nodes: Node[] = useMemo(() => {
		if (!sim.model) return []
		return sim.model.nodes.map((n) => {
			if (n.kind === 'recipe') {
				return {
					id: n.id,
					position: { x: n.x, y: n.y },
					data: {
						label: n.label,
						inCycle: n.inCycle,
					} as unknown as Record<string, unknown>,
					type: 'recipe',
				}
			}
			return {
				id: n.id,
				position: { x: n.x, y: n.y },
				data: {
					label: n.label,
					category: classifyItem(n.inDegree, n.outDegree),
					inDegree: n.inDegree,
					outDegree: n.outDegree,
					inCycle: n.inCycle,
				} as unknown as Record<string, unknown>,
				type: 'item',
			}
		})
	}, [sim.model])

	const edges: Edge[] = useMemo(() => {
		if (!sim.model) return []
		return sim.model.edges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			type: 'bezier',
			animated: e.isBackEdge,
			style: {
				strokeWidth: 1.5,
				stroke: e.isBackEdge ? '#ef4444' : '#94a3b8',
			},
		}))
	}, [sim.model])

	if (recipes.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
				<div className="text-4xl">📋</div>
				<p className="text-sm">No recipes yet for this game.</p>
				<p className="text-xs text-gray-400">
					Add items, benches, and recipes on the{' '}
					<a href="/manage" className="text-blue-600 hover:underline">Manage</a> page.
				</p>
			</div>
		)
	}

	return (
		<div className="relative w-full h-full">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.15 }}
				proOptions={{ hideAttribution: true }}
			>
				<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
				<Controls />
			</ReactFlow>

			<MetricsPanel metrics={sim.metrics} visible={showMetrics} />

			<div className="absolute right-3 top-3 z-10 flex flex-wrap items-center gap-2">
				<button
					onClick={() => setShowMetrics((v) => !v)}
					className={`rounded-md border px-2 py-1 text-xs shadow-md ${showMetrics
							? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
							: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
						} hover:bg-gray-50 dark:hover:bg-gray-700`}
					title="Toggle metrics"
				>
					📊
				</button>
			</div>

			<div className="absolute left-3 top-3 z-10 flex items-center gap-2">
				<div className="flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs shadow-md">
					<span className="text-gray-500 dark:text-gray-400">Recipes</span>
					<input
						type="range"
						min={0}
						max={recipes.length}
						value={effectiveCount}
						onChange={(e) => setRecipeCount(Number(e.target.value))}
						className="w-32 accent-blue-500"
					/>
					<span className="font-mono text-gray-700 dark:text-gray-300 w-10 text-right">{effectiveCount}/{recipes.length}</span>
				</div>
				{sim.model && (
					<span className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs shadow-md text-gray-500 dark:text-gray-400">
						{sim.model.nodes.length} nodes · {sim.model.edges.length} edges · {sim.model.cycles.length} cycles
					</span>
				)}
			</div>

		</div>
	)
}

export default function RecipeGraph(props: RecipeGraphProps) {
	return (
		<ReactFlowProvider>
			<RecipeGraphInner {...props} />
		</ReactFlowProvider>
	)
}
