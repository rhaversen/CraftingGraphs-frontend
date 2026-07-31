'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGameData } from '../../components/GameDataProvider'
import { api } from '../../api'
import type { Item } from '../../types'
import { type AttrRow, keysToRows, rowsToAttrs } from '../../components/AttributeEditor'
import { NewItemFields } from '../../components/NewItemFields'
import { useToast, Toasts, EmptyState, inputCls, btnPrimary, btnGhost } from '../_shared'

function cartesianProduct<T>(arrays: T[][]): T[][] {
	if (arrays.length === 0) return [[]]
	let result: T[][] = [[]]
	for (const arr of arrays) {
		const next: T[][] = []
		for (const r of result) {
			for (const item of arr) {
				next.push([...r, item])
			}
		}
		result = next
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

export default function MissingPage() {
	const { items, benches, recipes, refreshAll } = useGameData()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')
	const { showToast, toasts } = useToast()

	const gameItems = useMemo(() => items.filter((i) => i.gameId === selectedGameId), [items, selectedGameId])
	const gameBenches = useMemo(() => benches.filter((b) => b.gameId === selectedGameId), [benches, selectedGameId])
	const gameRecipes = useMemo(() => recipes.filter((r) => r.gameId === selectedGameId), [recipes, selectedGameId])

	const [selectedBenchId, setSelectedBenchId] = useState('')
	const [displayLimit, setDisplayLimit] = useState(DISPLAY_BATCH)
	const [creatingFor, setCreatingFor] = useState<string | null>(null)
	const [outputItem, setOutputItem] = useState('')
	const [outputCount, setOutputCount] = useState('1')
	const [outputMode, setOutputMode] = useState<'existing' | 'new'>('existing')
	const [newItemName, setNewItemName] = useState('')
	const [newItemCategory, setNewItemCategory] = useState('')
	const [newItemAttrRows, setNewItemAttrRows] = useState<AttrRow[]>([])

	const selectedBench = gameBenches.find((b) => b.id === selectedBenchId)

	const { missing, total, covered } = useMemo(() => {
		if (!selectedBench || selectedBench.inputs.length === 0) return { missing: [], total: 0, covered: 0 }

		const benchRecipes = gameRecipes.filter((r) => r.benchId === selectedBenchId)
		const existingSigs = new Set(benchRecipes.map((r) => recipeSignature(r.inputs.map((i) => i.item))))

		const slotItemPools: (Item | null)[][] = selectedBench.inputs.map((slot) => {
			const pool = slot.category
				? gameItems.filter((it) => it.category === slot.category)
				: gameItems.slice()
			return slot.required ? pool : [null, ...pool]
		})

		let totalCombos = 1
		for (const p of slotItemPools) totalCombos *= p.length
		if (totalCombos > 100000) return { missing: [], total: totalCombos, covered: 0 }
		if (totalCombos === 0) return { missing: [], total: 0, covered: 0 }

		const allCombos = cartesianProduct(slotItemPools)
		const missingCombos: MissingCombination[] = []
		let coveredCount = 0
		for (const combo of allCombos) {
			if (combo.every((it) => it === null)) continue
			const itemIds = combo.map((it) => (it === null ? '__none__' : it.id))
			const sig = recipeSignature(itemIds)
			if (existingSigs.has(sig)) {
				coveredCount++
			} else {
				missingCombos.push({ items: combo.filter((it): it is Item => it !== null), signature: sig })
			}
		}
		return { missing: missingCombos, total: totalCombos, covered: coveredCount }
	}, [selectedBench, selectedBenchId, gameItems, gameRecipes])

	const handleMarkInvalid = async (combo: MissingCombination) => {
		if (!selectedBench || !selectedGameId) return
		try {
			await api.recipes.create({
				gameId: selectedGameId,
				benchId: selectedBenchId,
				inputs: combo.items.map((i) => ({ item: i.id, count: 1 })),
				outputs: [],
			})
			showToast('success', 'Recipe marked as invalid (no output)')
			refreshAll()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create recipe')
		}
	}

	const handleCreateRecipe = async (e: React.FormEvent, combo: MissingCombination) => {
		e.preventDefault()
		if (!selectedBench || !selectedGameId) return
		let outputId = outputItem
		if (outputMode === 'new') {
			if (!newItemName.trim()) {
				showToast('error', 'Item name is required')
				return
			}
			try {
				const created = await api.items.create({ name: newItemName.trim(), attributes: rowsToAttrs(newItemAttrRows), category: newItemCategory.trim() || null, gameId: selectedGameId })
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
				gameId: selectedGameId,
				benchId: selectedBenchId,
				inputs: combo.items.map((i) => ({ item: i.id, count: 1 })),
				outputs: [{ item: outputId, count: Number(outputCount) || 1 }],
			})
			showToast('success', 'Recipe created')
			setCreatingFor(null)
			setOutputItem('')
			setOutputCount('1')
			refreshAll()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create recipe')
		}
	}

	const comboLabel = (combo: MissingCombination) =>
		combo.items.map((i) => i.name ?? i.id).join(' + ')

	const benchesWithInputs = gameBenches.filter((b) => b.inputs.length > 0)

	if (!selectedGameId) {
		return (
			<>
				<EmptyState message="Select a game in the navbar to manage its content." />
				<Toasts toasts={toasts} />
			</>
		)
	}

	return (
		<>
			{benchesWithInputs.length === 0 ? (
				<div className="space-y-4">
					<div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm text-amber-700 dark:text-amber-300">
						No benches have input slots configured. Add input slots to a bench to enable missing recipe detection.
					</div>
				</div>
			) : (
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
									{benchesWithInputs.map((b) => (
										<option key={b.id} value={b.id}>
											{b.name ?? b.id} ({b.inputs.length} inputs)
										</option>
									))}
								</select>
							</div>

							{selectedBench && (
								<div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
									<span>Items: <strong>{gameItems.length}</strong></span>
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
																{gameItems.map((it) => (
																	<option key={it.id} value={it.id}>{it.name}</option>
																))}
															</select>
														) : (
															<NewItemFields
																name={newItemName}
																setName={setNewItemName}
																category={newItemCategory}
																setCategory={setNewItemCategory}
																attrRows={newItemAttrRows}
																setAttrRows={setNewItemAttrRows}
																autoFocus existingNames={gameItems.map((it) => it.name).filter((n): n is string => n !== null)} />
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
																	setNewItemCategory('')
																	setNewItemAttrRows(keysToRows([]))
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
																setNewItemCategory('')
																setNewItemAttrRows(keysToRows([]))
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
			)}
			<Toasts toasts={toasts} />
		</>
	)
}
