'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGameData } from '../components/GameDataProvider'
import { analyzeProfits, type ChainStep, type RecipeProfit } from './profitAnalysis'
import { Combobox, type ComboboxOption } from '../components/Combobox'

const inputCls =
	'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none'

function fmt(n: number): string {
	if (!Number.isFinite(n)) return '∞'
	if (Number.isInteger(n)) return n.toLocaleString()
	return n.toFixed(2)
}

function ratioColor(ratio: number): string {
	if (!Number.isFinite(ratio)) return 'text-purple-600 dark:text-purple-400 font-semibold'
	if (ratio > 1.5) return 'text-green-600 dark:text-green-400'
	if (ratio < 1) return 'text-red-600 dark:text-red-400'
	return 'text-gray-600 dark:text-gray-300'
}

export default function AnalyzePage() {
	const { games, items, benches, recipes, loading } = useGameData()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')

	const game = useMemo(() => games.find((g) => g.id === selectedGameId), [games, selectedGameId])
	const gameItems = useMemo(
		() => items.filter((i) => i.gameId === selectedGameId),
		[items, selectedGameId],
	)
	const gameRecipes = useMemo(
		() => recipes.filter((r) => r.gameId === selectedGameId && r.outputs.length > 0),
		[recipes, selectedGameId],
	)
	const gameBenches = useMemo(
		() => benches.filter((b) => b.gameId === selectedGameId),
		[benches, selectedGameId],
	)

	const attrKeyOptions = useMemo<ComboboxOption[]>(() => {
		const keys = new Set<string>()
		for (const it of gameItems) {
			for (const k of Object.keys(it.attributes ?? {})) keys.add(k)
		}
		for (const k of game?.attributeKeys ?? []) keys.add(k)
		return [...keys].sort().map((k) => ({ value: k, label: k }))
	}, [gameItems, game])

	const [costKey, setCostKey] = useState('')
	const [startItem, setStartItem] = useState('')
	const [startCategory, setStartCategory] = useState('')
	const [endItem, setEndItem] = useState('')
	const [endCategory, setEndCategory] = useState('')

	const itemOptions = useMemo<ComboboxOption[]>(
		() =>
			[...gameItems]
				.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
				.map((i) => ({ value: i.id, label: i.name ?? i.id })),
		[gameItems],
	)
	const categoryOptions = useMemo<ComboboxOption[]>(
		() =>
			[...new Set(gameItems.map((i) => i.category).filter((c): c is string => c !== null))]
				.sort()
				.map((c) => ({ value: c, label: c })),
		[gameItems],
	)

	const analysis = useMemo(() => {
		if (!costKey || gameRecipes.length === 0) return null
		return analyzeProfits(gameItems, gameRecipes, gameBenches, costKey, {
			startItemId: startItem || null,
			startCategory: startCategory || null,
			endItemId: endItem || null,
			endCategory: endCategory || null,
		})
	}, [costKey, gameItems, gameRecipes, gameBenches, startItem, startCategory, endItem, endCategory])

	if (loading) {
		return (
			<main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
				<div className="h-10 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
				<div className="h-96 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
			</main>
		)
	}

	if (!selectedGameId) {
		return (
			<main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
				<div className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
					<div className="text-5xl">📊</div>
					<p className="text-lg font-medium text-gray-600 dark:text-gray-400">
						Select a game in the navbar to analyze its crafting graph
					</p>
				</div>
			</main>
		)
	}

	return (
		<main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
			<div className="flex flex-col gap-3">
				<div>
					<h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Profit Analysis</h1>
					<p className="text-sm text-gray-500 dark:text-gray-400">
					Pick a cost attribute. Each item&apos;s base value is its cost; a recipe&apos;s ratio is its
					total output value divided by its total input cost. The algorithm finds the single recipe
					with the highest ratio and the connected chain of recipes whose product of ratios (i.e.
					total input-to-output multiplier) is the largest. Optionally constrain the chain to start
					from a given item category and/or end at a given item category.
					</p>
				</div>

				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-gray-600 dark:text-gray-400">Cost attribute</label>
						<Combobox
							className={`${inputCls} w-44`}
							value={costKey}
							onChange={setCostKey}
							options={attrKeyOptions}
							placeholder="e.g. value"
							allowCreate
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-gray-600 dark:text-gray-400">Start category (optional)</label>
						<Combobox
							className={`${inputCls} w-56`}
							value={startCategory}
							onChange={setStartCategory}
							options={categoryOptions}
							placeholder="any input category"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-gray-600 dark:text-gray-400">Start item (optional)</label>
						<Combobox
							className={`${inputCls} w-56`}
							value={startItem}
							onChange={setStartItem}
							options={itemOptions}
							placeholder="any input"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-gray-600 dark:text-gray-400">End item (optional)</label>
						<Combobox
							className={`${inputCls} w-56`}
							value={endItem}
							onChange={setEndItem}
							options={itemOptions}
							placeholder="any output"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-gray-600 dark:text-gray-400">End category (optional)</label>
						<Combobox
							className={`${inputCls} w-56`}
							value={endCategory}
							onChange={setEndCategory}
							options={categoryOptions}
							placeholder="any output category"
						/>
					</div>
					{(startItem || startCategory || endItem || endCategory) && (
						<button
							type="button"
							onClick={() => {
								setStartItem('')
								setStartCategory('')
								setEndItem('')
								setEndCategory('')
							}}
							className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
						>
							clear filters
						</button>
				)}
			</div>
		</div>

		{!costKey && (
				<div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
					Select a cost attribute above to run the analysis.
				</div>
			)}

			{analysis && (
				<div className="flex flex-col gap-4">
					{analysis.itemsWithoutCost.length > 0 && (
						<div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm text-amber-700 dark:text-amber-300">
							<span className="font-medium">{analysis.itemsWithoutCost.length}</span> item(s) have no
							numeric <code className="font-mono">{analysis.costKey}</code> attribute and were treated as
							zero-cost. Recipes referencing them are excluded from the chain search.
						</div>
					)}

					{analysis.arbitrage && (
						<div className="rounded-md border border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950 p-3 text-sm text-purple-700 dark:text-purple-300">
<span className="font-semibold">Arbitrage detected.</span> A cycle of recipes
								exists within the filtered set whose combined ratio exceeds 1 — value can be multiplied
								indefinitely, so no finite best chain exists. Tighten the start/end filters to break the
								cycle.
						</div>
					)}

					<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
						<SummaryCard
							title="Best single recipe"
							value={analysis.bestRecipe ? `${analysis.bestRecipe.ratio.toFixed(2)}×` : '—'}
							subtitle={analysis.bestRecipe?.benchName}
						/>
						<SummaryCard
							title="Best chain multiplier"
							value={analysis.arbitrage ? '∞' : analysis.bestChain ? `${analysis.bestChainRatio.toFixed(2)}×` : '—'}
							subtitle={
								analysis.bestChain ? `${analysis.bestChain.length} recipe(s)` : undefined
							}
						/>
						<SummaryCard
							title="Computable recipes"
							value={fmt(analysis.computableCount)}
							subtitle={`${analysis.recipes.length} total`}
						/>
					</div>

					{analysis.bestChain && analysis.bestChain.length > 0 && (
						<ChainPanel chain={analysis.bestChain} />
					)}

					<RecipeTable recipes={analysis.recipes} />
				</div>
			)}
		</main>
	)
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
			<div className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</div>
			<div className="mt-1 text-2xl font-semibold text-gray-800 dark:text-gray-100">{value}</div>
			{subtitle && <div className="mt-1 text-xs text-gray-400">{subtitle}</div>}
		</div>
	)
}

function ChainPanel({ chain }: { chain: ChainStep[] }) {
	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-800">
			<div className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
				Best chain · {chain.length} recipe(s)
			</div>
			<div className="flex flex-col gap-2 px-3 pb-3">
				{chain.map((step, i) => (
					<div key={step.recipeId} className="flex items-start gap-2">
						<div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-xs font-medium text-blue-700 dark:text-blue-300">
							{i + 1}
						</div>
						<div className="flex-1 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 text-sm">
							<div className="flex items-center justify-between">
								<span className="font-medium text-gray-700 dark:text-gray-300">{step.benchName}</span>
								<span className="font-mono text-xs">
								<span className={ratioColor(step.ratio)}>
									{step.ratio.toFixed(2)}×
								</span>
								<span className="ml-2 text-gray-400">Π {step.cumulativeRatio.toFixed(2)}×</span>
								</span>
							</div>
							<div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
								<span className="text-gray-400">in</span>
								{step.inputs.map((s, j) => (
									<span key={j} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">
										{s.count}× {s.name}
									</span>
								))}
								<span className="text-gray-400">→</span>
								<span className="text-gray-400">out</span>
								{step.outputs.map((s, j) => (
									<span key={j} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">
										{s.count}× {s.name}
									</span>
								))}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function RecipeTable({ recipes }: { recipes: RecipeProfit[] }) {
	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-x-auto">
			<div className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
				All recipes (sorted by ratio)
			</div>
			<table className="w-full text-sm">
				<thead>
					<tr className="border-y border-gray-200 dark:border-gray-800 text-left text-xs text-gray-500 dark:text-gray-400">
						<th className="px-3 py-2 font-medium">Bench</th>
						<th className="px-3 py-2 font-medium">Inputs</th>
						<th className="px-3 py-2 font-medium">Outputs</th>
						<th className="px-3 py-2 text-right font-medium">Cost</th>
						<th className="px-3 py-2 text-right font-medium">Value</th>
						<th className="px-3 py-2 text-right font-medium">Ratio</th>
						<th className="px-3 py-2 text-right font-medium">Profit</th>
					</tr>
				</thead>
				<tbody>
					{recipes.map((r) => (
						<tr key={r.recipeId} className="border-b border-gray-100 dark:border-gray-800/50 align-top">
							<td className="px-3 py-2 text-gray-600 dark:text-gray-300">{r.benchName}</td>
							<td className="px-3 py-2 text-gray-500 dark:text-gray-400">
								<div className="flex flex-wrap gap-1">
									{r.inputs.map((s, i) => (
										<span key={i} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">
											{s.count}× {s.name}
										</span>
									))}
								</div>
							</td>
							<td className="px-3 py-2 text-gray-500 dark:text-gray-400">
								<div className="flex flex-wrap gap-1">
									{r.outputs.map((s, i) => (
										<span key={i} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">
											{s.count}× {s.name}
										</span>
									))}
								</div>
							</td>
							<td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-300">{fmt(r.inputCost)}</td>
							<td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-300">{fmt(r.outputValue)}</td>
							<td className={`px-3 py-2 text-right font-mono ${r.computable ? ratioColor(r.ratio) : 'text-gray-400'}`}>
								{r.computable ? (Number.isFinite(r.ratio) ? `${r.ratio.toFixed(2)}×` : '∞') : '—'}
							</td>
							<td className={`px-3 py-2 text-right font-mono font-medium ${r.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
								{r.profit >= 0 ? '+' : ''}{fmt(r.profit)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
