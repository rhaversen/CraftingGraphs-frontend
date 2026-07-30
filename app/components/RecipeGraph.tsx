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
import type { SimParams } from './graph/types'

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
	const [showParams, setShowParams] = useState(false)

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
					onClick={sim.toggleRunning}
					className={`rounded-md border px-2 py-1 text-xs shadow-md ${sim.running
							? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
							: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
						} hover:bg-gray-50 dark:hover:bg-gray-700`}
					title={sim.running ? 'Pause simulation' : 'Resume simulation'}
				>
					{sim.running ? '⏸' : '▶'}
				</button>
				<button onClick={sim.stepOnce} className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs shadow-md hover:bg-gray-50 dark:hover:bg-gray-700" title="Step one tick">
					⏭
				</button>
				<button onClick={sim.reheat} className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs shadow-md hover:bg-gray-50 dark:hover:bg-gray-700" title="Reheat (alpha=1)">
					🔥
				</button>
				<button onClick={sim.restart} className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs shadow-md hover:bg-gray-50 dark:hover:bg-gray-700" title="Restart layout from scratch">
					↻
				</button>
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
				<button
					onClick={() => setShowParams((v) => !v)}
					className={`rounded-md border px-2 py-1 text-xs shadow-md ${showParams
							? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
							: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
						} hover:bg-gray-50 dark:hover:bg-gray-700`}
					title="Tune parameters"
				>
					⚙
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

			{showParams && <ParamsPanel params={sim.params} setParams={sim.setParams} />}
		</div>
	)
}

function ParamsPanel({ params, setParams }: { params: SimParams; setParams: (updater: (prev: SimParams) => SimParams) => void }) {
	const fields: { key: keyof SimParams; label: string; min: number; max: number; step: number }[] = [
		{ key: 'repulsion', label: 'Repulsion', min: 0, max: 2000, step: 50 },
		{ key: 'springStrength', label: 'Spring k', min: 0, max: 0.5, step: 0.01 },
		{ key: 'springLength', label: 'Spring len', min: 50, max: 400, step: 10 },
		{ key: 'flowStrength', label: 'Flow', min: 0, max: 0.2, step: 0.01 },
		{ key: 'levelStrength', label: 'Level', min: 0, max: 0.2, step: 0.01 },
		{ key: 'levelSpacing', label: 'Lvl spacing', min: 100, max: 500, step: 10 },
		{ key: 'centerStrength', label: 'Center', min: 0, max: 0.1, step: 0.005 },
		{ key: 'barycenterStrength', label: 'Barycenter', min: 0, max: 0.2, step: 0.01 },
		{ key: 'crossingPenalty', label: 'Cross penalty', min: 0, max: 2, step: 0.1 },
		{ key: 'alphaDecay', label: 'Alpha decay', min: 0, max: 0.2, step: 0.001 },
	]
	return (
		<div className="absolute right-3 top-16 z-10 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 p-3 text-xs shadow-lg backdrop-blur-sm">
			<div className="mb-2 font-semibold text-gray-700 dark:text-gray-300">Parameters</div>
			<div className="space-y-2">
				{fields.map((f) => (
					<div key={f.key}>
						<div className="mb-0.5 flex justify-between text-gray-500 dark:text-gray-400">
							<span>{f.label}</span>
							<span className="font-mono">{(params[f.key] as number).toFixed(3)}</span>
						</div>
						<input
							type="range"
							min={f.min}
							max={f.max}
							step={f.step}
							value={params[f.key] as number}
							onChange={(e) => setParams((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
							className="w-full accent-blue-500"
						/>
					</div>
				))}
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
