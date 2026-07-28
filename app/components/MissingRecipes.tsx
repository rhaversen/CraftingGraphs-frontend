'use client'

import { useMemo, useState } from 'react'
import { api } from '../api'
import type { Bench, Item, Recipe } from '../types'
import { type AttrRow, keysToRows, rowsToAttrs } from './AttributeEditor'
import { NewItemFields } from './NewItemFields'

type ToastType = 'success' | 'error'

function nCr(n: number, k: number): number {
	if (k < 0 || k > n) return 0
	if (k === 0 || k === n) return 1
	let result = 1
	for (let i = 0; i < k; i++) {
		result = (result * (n - i)) / (i + 1)
	}
	return Math.round(result)
}

function combinations<T>(arr: T[], k: number): T[][] {
	if (k === 0) return [[]]
	if (k > arr.length) return []
	const result: T[][] = []
	const indices = Array.from({ length: k }, (_, i) => i)
	result.push(indices.map((i) => arr[i]))
	while (true) {
		let i = k - 1
		while (i >= 0 && indices[i] === arr.length - k + i) i--
		if (i < 0) break
		indices[i]++
		for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1
		result.push(indices.map((idx) => arr[idx]))
	}
	return result
}

function recipeSignature(itemIds: string[]): string {
	return [...itemIds].sort().join(',')
}

interface MissingCombination {
	items: Item[]
	signature: string
}

const DISPLAY_BATCH = 100

export function MissingRecipesTab({
	gameId,
	items,
	benches,
	recipes,
	attributeKeys,
	onChanged,
	showToast,
}: {
	gameId: string
	items: Item[]
	benches: Bench[]
	recipes: Recipe[]
	attributeKeys: string[]
	onChanged: () => void
	showToast: (type: ToastType, message: string) => void
}) {
	const benchesWithInputCount = benches.filter((b) => b.inputCount !== null && b.inputCount !== undefined)
	const [selectedBenchId, setSelectedBenchId] = useState('')
	const [displayLimit, setDisplayLimit] = useState(DISPLAY_BATCH)
	const [creatingFor, setCreatingFor] = useState<string | null>(null)
	const [outputItem, setOutputItem] = useState('')
	const [outputCount, setOutputCount] = useState('1')
	const [outputMode, setOutputMode] = useState<'existing' | 'new'>('existing')
	const [newItemName, setNewItemName] = useState('')
	const [newItemAttrRows, setNewItemAttrRows] = useState<AttrRow[]>(keysToRows(attributeKeys))

	const selectedBench = benches.find((b) => b.id === selectedBenchId)
	const inputCount = selectedBench?.inputCount ?? 0

	const { missing, total, covered } = useMemo(() => {
		if (!selectedBench || inputCount === null) return { missing: [], total: 0, covered: 0 }
		const benchRecipes = recipes.filter((r) => r.benchId === selectedBenchId)
		const existingSigs = new Set(benchRecipes.map((r) => recipeSignature(r.inputs.map((i) => i.item))))

		const totalCombos = nCr(items.length, inputCount)
		if (totalCombos === 0) return { missing: [], total: 0, covered: 0 }
		if (totalCombos > 100000) return { missing: [], total: totalCombos, covered: 0 }

		const allCombos = combinations(items, inputCount)
		const missingCombos: MissingCombination[] = []
		let coveredCount = 0
		for (const combo of allCombos) {
			const sig = recipeSignature(combo.map((i) => i.id))
			if (existingSigs.has(sig)) {
				coveredCount++
			} else {
				missingCombos.push({ items: combo, signature: sig })
			}
		}
		return { missing: missingCombos, total: totalCombos, covered: coveredCount }
	}, [selectedBench, selectedBenchId, inputCount, items, recipes])

	const handleMarkInvalid = async (combo: MissingCombination) => {
		if (!selectedBench) return
		try {
			await api.recipes.create({
				gameId,
				benchId: selectedBenchId,
				inputs: combo.items.map((i) => ({ item: i.id, count: 1 })),
				outputs: [],
			})
			showToast('success', 'Recipe marked as invalid (no output)')
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create recipe')
		}
	}

	const handleCreateRecipe = async (e: React.FormEvent, combo: MissingCombination) => {
		e.preventDefault()
		if (!selectedBench) return
		let outputId = outputItem
		if (outputMode === 'new') {
			if (!newItemName.trim()) {
				showToast('error', 'Item name is required')
				return
			}
			try {
				const created = await api.items.create({ name: newItemName.trim(), attributes: rowsToAttrs(newItemAttrRows), gameId })
				outputId = created.id
			} catch (err) {
				showToast('error', err instanceof Error ? err.message : 'Failed to create item')
				return
			}
		} else if (!outputId) {
			showToast('error', 'Select an output item or use "Mark Invalid"')
			return
		}
		try {
			await api.recipes.create({
				gameId,
				benchId: selectedBenchId,
				inputs: combo.items.map((i) => ({ item: i.id, count: 1 })),
				outputs: [{ item: outputId, count: Number(outputCount) || 1 }],
			})
			showToast('success', 'Recipe created')
			setCreatingFor(null)
			setOutputItem('')
			setOutputCount('1')
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create recipe')
		}
	}

	const comboLabel = (combo: MissingCombination) =>
		combo.items.map((i) => i.name ?? i.id).join(' + ')

	const inputCls =
		'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'
	const btnPrimary =
		'rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
	const btnGhost =
		'rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'

	if (benchesWithInputCount.length === 0) {
		return (
			<div className="space-y-4">
				<div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm text-amber-700 dark:text-amber-300">
					No benches have an input count set. Set the input count on a bench to enable missing recipe detection.
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
				<div className="space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						<label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bench:</label>
						<select
							className={`${inputCls} max-w-xs`}
							value={selectedBenchId}
							onChange={(e) => {
								setSelectedBenchId(e.target.value)
								setDisplayLimit(DISPLAY_BATCH)
								setCreatingFor(null)
							}}
						>
							<option value="">Select bench...</option>
							{benchesWithInputCount.map((b) => (
								<option key={b.id} value={b.id}>
									{b.name ?? b.id} ({b.inputCount} inputs)
								</option>
							))}
						</select>
					</div>

					{selectedBench && (
						<div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
							<span>Items: <strong>{items.length}</strong></span>
							<span>Possible: <strong>{total.toLocaleString()}</strong></span>
							<span>Covered: <strong>{covered.toLocaleString()}</strong></span>
							<span>Missing: <strong className="text-amber-600 dark:text-amber-400">{missing.length.toLocaleString()}</strong></span>
						</div>
					)}

					{selectedBench && total > 100000 && (
						<div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-2 text-sm text-amber-700 dark:text-amber-300">
							Too many combinations ({total.toLocaleString()}). Add more recipes or reduce items to narrow the search.
						</div>
					)}
				</div>
			</div>

			{selectedBench && total <= 100000 && (
				<div className="rounded-lg border border-gray-200 dark:border-gray-800">
					<div className="flex items-center justify-between px-3 py-2">
						<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
							Missing combinations
							<span className="ml-2 text-xs text-gray-400">({missing.length.toLocaleString()})</span>
						</span>
					</div>
					<div className="px-3 pb-3">
						{missing.length === 0 ? (
							<div className="py-6 text-center text-sm text-gray-400">
								{total === 0
									? 'No items to combine.'
									: 'All combinations covered! 🎉'}
							</div>
						) : (
							<div className="space-y-1">
								{missing.slice(0, displayLimit).map((combo) => (
									<div key={combo.signature} className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
										{creatingFor === combo.signature ? (
											<form onSubmit={(e) => handleCreateRecipe(e, combo)} className="space-y-2">
												<span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
													{comboLabel(combo)}
												</span>
												<div className="flex gap-1">
													<button
														type="button"
														className={`rounded px-2 py-1 text-xs font-medium ${outputMode === 'existing' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
														onClick={() => setOutputMode('existing')}
													>Existing</button>
													<button
														type="button"
														className={`rounded px-2 py-1 text-xs font-medium ${outputMode === 'new' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
														onClick={() => setOutputMode('new')}
													>New</button>
													<input
														className={`${inputCls} w-16`}
														type="number"
														min="1"
														value={outputCount}
														onChange={(e) => setOutputCount(e.target.value)}
													/>
												</div>
												{outputMode === 'existing' ? (
													<select
														className={inputCls}
														value={outputItem}
														onChange={(e) => setOutputItem(e.target.value)}
													>
														<option value="">Select output...</option>
														{items.map((it) => (
															<option key={it.id} value={it.id}>{it.name}</option>
														))}
													</select>
												) : (
													<NewItemFields
														name={newItemName}
														setName={setNewItemName}
														attrRows={newItemAttrRows}
														setAttrRows={setNewItemAttrRows}
														autoFocus															existingNames={items.map((it) => it.name).filter((n): n is string => n !== null)}													/>
												)}
												<div className="flex gap-2">
													<button type="submit" className={btnPrimary}>Save</button>
													<button
														type="button"
														className={btnGhost}
														onClick={() => {
															setCreatingFor(null)
															setOutputItem('')
															setOutputCount('1')
															setOutputMode('existing')
																setNewItemName('')
															setNewItemAttrRows(keysToRows(attributeKeys))
														}}
													>Cancel</button>
												</div>
											</form>
										) : (
											<div className="group flex items-center gap-2">
												<span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
													{comboLabel(combo)}
												</span>
												<button
													onClick={() => {
														setCreatingFor(combo.signature)
														setOutputItem('')
														setOutputCount('1')
													setOutputMode('existing')
													setNewItemName('')
													setNewItemAttrRows(keysToRows(attributeKeys))
												}}
													className={btnGhost}
												>Create recipe</button>
												<button
													onClick={() => handleMarkInvalid(combo)}
													className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
												>Mark invalid</button>
											</div>
										)}
									</div>
								))}
								{missing.length > displayLimit && (
									<button
										onClick={() => setDisplayLimit((d) => d + DISPLAY_BATCH)}
										className="w-full rounded-md border border-gray-200 dark:border-gray-800 py-2 text-sm text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800"
									>
										Load more ({(missing.length - displayLimit).toLocaleString()} remaining)
									</button>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
