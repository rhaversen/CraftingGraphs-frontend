'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGameData } from '../../components/GameDataProvider'
import { api } from '../../api'
import type { BenchInput, Item, Recipe, RecipeSlot } from '../../types'
import { type AttrRow, keysToRows, rowsToAttrs } from '../../components/AttributeEditor'
import { NewItemFields } from '../../components/NewItemFields'
import { ExpandableRow, useExpanded } from '../../components/ExpandableRow'
import { Combobox, type ComboboxOption } from '../../components/Combobox'
import { useToast, Toasts, SectionCard, EmptyState, inputCls, btnPrimary, btnGhost, btnDanger } from '../_shared'

interface SlotRow {
	item: string
	count: string
	isNew?: boolean
	newName?: string
	newCategory?: string
	newAttrRows?: AttrRow[]
}

function updateSlot(arr: SlotRow[], setArr: (a: SlotRow[]) => void, idx: number, patch: Partial<SlotRow>) {
	setArr(arr.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
}
function addSlot(arr: SlotRow[], setArr: (a: SlotRow[]) => void) {
	setArr([...arr, { item: '', count: '1' }])
}
function removeSlot(arr: SlotRow[], setArr: (a: SlotRow[]) => void, idx: number) {
	setArr(arr.filter((_, i) => i !== idx))
}

function SlotEditor({
	arr,
	setArr,
	label,
	items,
	attributeKeys,
	benchInputs,
	baseTabIndex,
}: {
	arr: SlotRow[]
	setArr: (a: SlotRow[]) => void
	label: string
	items: Item[]
	attributeKeys: string[]
	benchInputs?: BenchInput[]
	baseTabIndex?: number
}) {
	const benchDriven = benchInputs !== undefined
	const slotItems = (idx: number): Item[] => {
		const slot = benchInputs?.[idx]
		if (slot?.category) return items.filter((it) => it.category === slot.category)
		return items
	}
	const slotCategories = (idx: number): ComboboxOption[] => {
		const slot = benchInputs?.[idx]
		if (slot?.category) return [{ value: slot.category, label: slot.category }]
		return [...new Set(items.map((it) => it.category).filter((c): c is string => c !== null))].sort().map((c) => ({ value: c, label: c }))
	}
	return (
		<div>
			<span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
			<div className="space-y-1">
				{arr.map((row, idx) => {
					const slot = benchInputs?.[idx]
					const lockedCategory = benchDriven && slot?.category ? slot.category : undefined
					return (
						<div key={idx} className="space-y-1 rounded-md border border-gray-100 dark:border-gray-800 p-1">
							{benchDriven && slot && (
								<div className="text-xs text-gray-500 dark:text-gray-400">
									Slot {idx + 1}: {slot.category ?? 'any'} · {slot.required ? 'required' : 'optional'}
								</div>
							)}
							<div className="flex gap-1">
								<button
									type="button"
									className={`rounded px-2 py-1 text-xs font-medium ${!row.isNew ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
									onClick={() => updateSlot(arr, setArr, idx, { isNew: false })}
									tabIndex={baseTabIndex !== undefined ? -1 : undefined}
								>Existing</button>
								<button
									type="button"
									className={`rounded px-2 py-1 text-xs font-medium ${row.isNew ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
									onClick={() => updateSlot(arr, setArr, idx, { isNew: true, item: '', newName: row.newName ?? '', newAttrRows: row.newAttrRows ?? keysToRows(attributeKeys) })}
									tabIndex={baseTabIndex !== undefined ? -1 : undefined}
								>New</button>
								<input
									className={`${inputCls} w-16`}
									type="number"
									min="1"
									value={row.count}
									onChange={(e) => updateSlot(arr, setArr, idx, { count: e.target.value })}
									tabIndex={baseTabIndex !== undefined ? -1 : undefined}
								/>
								{!benchDriven && arr.length > 1 && (
									<button type="button" tabIndex={baseTabIndex !== undefined ? -1 : undefined} onClick={() => removeSlot(arr, setArr, idx)} className="rounded px-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950">✕</button>
								)}
							</div>
							{row.isNew ? (
								<NewItemFields
									name={row.newName ?? ''}
									setName={(s) => updateSlot(arr, setArr, idx, { newName: s })}
									category={row.newCategory ?? ''}
									setCategory={(s) => updateSlot(arr, setArr, idx, { newCategory: s })}
									attrRows={row.newAttrRows ?? keysToRows(attributeKeys)}
									setAttrRows={(r) => updateSlot(arr, setArr, idx, { newAttrRows: r })}
									existingNames={slotItems(idx).map((it) => it.name).filter((n): n is string => n !== null)}
									categories={lockedCategory ? [{ value: lockedCategory, label: lockedCategory }] : slotCategories(idx)}
									nameTabIndex={baseTabIndex !== undefined ? baseTabIndex + idx : undefined}
									categoryTabIndex={baseTabIndex !== undefined ? -1 : undefined}
									attrBaseTabIndex={baseTabIndex !== undefined ? -1 : undefined}
								/>
							) : (
								<Combobox
									className={inputCls}
									value={row.item}
									onChange={(v) => updateSlot(arr, setArr, idx, { item: v })}
									options={slotItems(idx).map((it) => ({ value: it.id, label: it.name ?? it.id }))}
									placeholder="Search item..."
									tabIndex={baseTabIndex !== undefined ? baseTabIndex + idx : undefined}
								/>
							)}
						</div>
					)
				})}
			</div>
			{!benchDriven && (
				<button type="button" tabIndex={baseTabIndex !== undefined ? -1 : undefined} onClick={() => addSlot(arr, setArr)} className="mt-1 text-xs text-blue-600 hover:underline">+ Add slot</button>
			)}
		</div>
	)
}

export default function RecipesPage() {
	const { items, benches, recipes, games, refreshAll } = useGameData()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')
	const { showToast, toasts } = useToast()

	const gameItems = useMemo(() => items.filter((i) => i.gameId === selectedGameId), [items, selectedGameId])
	const gameBenches = useMemo(() => benches.filter((b) => b.gameId === selectedGameId), [benches, selectedGameId])
	const gameRecipes = useMemo(() => recipes.filter((r) => r.gameId === selectedGameId), [recipes, selectedGameId])
	const gameAttrKeys = useMemo(
		() => games.find((g) => g.id === selectedGameId)?.attributeKeys ?? [],
		[games, selectedGameId],
	)

	const [showNullRecipes, setShowNullRecipes] = useState(false)
	const [benchId, setBenchId] = useState('')
	const [inputs, setInputs] = useState<SlotRow[]>([{ item: '', count: '1' }])
	const [outputs, setOutputs] = useState<SlotRow[]>([{ item: '', count: '1' }])
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editBenchId, setEditBenchId] = useState('')
	const [editInputs, setEditInputs] = useState<SlotRow[]>([])
	const [editOutputs, setEditOutputs] = useState<SlotRow[]>([])
	const [confirmId, setConfirmId] = useState<string | null>(null)
	const { expandedIds, toggleExpand } = useExpanded()

	const selectedBench = gameBenches.find((b) => b.id === benchId)
	const editBench = gameBenches.find((b) => b.id === editBenchId)

	const benchInputsToRows = (benchInputs: BenchInput[]): SlotRow[] =>
		benchInputs.map((bi) => ({
			item: '',
			count: '1',
			isNew: false,
			newCategory: bi.category ?? undefined,
			newAttrRows: keysToRows(gameAttrKeys),
		}))

	const onBenchChange = (id: string) => {
		setBenchId(id)
		const bench = gameBenches.find((b) => b.id === id)
		setInputs(bench ? benchInputsToRows(bench.inputs) : [{ item: '', count: '1' }])
	}

	const onEditBenchChange = (id: string) => {
		setEditBenchId(id)
		const bench = gameBenches.find((b) => b.id === id)
		setEditInputs(bench ? benchInputsToRows(bench.inputs) : [])
	}

	const slotToRow = (s: RecipeSlot): SlotRow => ({ item: s.item, count: String(s.count) })

	const resolveSlots = async (rows: SlotRow[]): Promise<RecipeSlot[] | null> => {
		const slots: RecipeSlot[] = []
		for (const row of rows) {
			if (row.isNew) {
				if (!row.newName?.trim()) continue
				if (!selectedGameId) return null
				try {
					const created = await api.items.create({
						gameId: selectedGameId,
						name: row.newName.trim(),
						attributes: rowsToAttrs(row.newAttrRows ?? []),
						category: row.newCategory?.trim() || null,
					})
					slots.push({ item: created.id, count: Number(row.count) || 1 })
				} catch (err) {
					showToast('error', err instanceof Error ? err.message : 'Failed to create item')
					return null
				}
			} else if (row.item) {
				slots.push({ item: row.item, count: Number(row.count) || 1 })
			}
		}
		return slots
	}

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!benchId) { showToast('error', 'Please select a bench'); return }
		if (!selectedBench) { showToast('error', 'Please select a bench'); return }
		for (let i = 0; i < selectedBench.inputs.length; i++) {
			const slot = selectedBench.inputs[i]
			if (!slot.required) continue
			const row = inputs[i]
			const filled = row && (row.isNew ? !!row.newName?.trim() : !!row.item)
			if (!filled) {
				showToast('error', `Required input slot ${i + 1} is empty`)
				return
			}
		}
		const resolvedInputs = await resolveSlots(inputs)
		const resolvedOutputs = await resolveSlots(outputs)
		if (resolvedInputs === null || resolvedOutputs === null) return
		if (resolvedOutputs.length === 0) {
			showToast('error', 'Recipe needs at least one output')
			return
		}
		try {
			await api.recipes.create({
				gameId: selectedGameId!,
				benchId,
				inputs: resolvedInputs,
				outputs: resolvedOutputs,
			})
			showToast('success', 'Recipe created')
			setInputs(selectedBench ? benchInputsToRows(selectedBench.inputs) : [{ item: '', count: '1' }])
			setOutputs([{ item: '', count: '1' }])
			refreshAll()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create recipe')
		}
	}

	const startEdit = (r: Recipe) => {
		setEditingId(r.id)
		setEditBenchId(r.benchId)
		const bench = gameBenches.find((b) => b.id === r.benchId)
		if (bench && bench.inputs.length > 0) {
			const existing = r.inputs.map(slotToRow)
			setEditInputs(bench.inputs.map((bi, i) => ({
				item: existing[i]?.item ?? '',
				count: existing[i]?.count ?? '1',
				isNew: false,
				newCategory: bi.category ?? undefined,
				newAttrRows: keysToRows(gameAttrKeys),
			})))
		} else {
			setEditInputs(r.inputs.map(slotToRow))
		}
		setEditOutputs(r.outputs.map(slotToRow))
		setConfirmId(null)
	}

	const handleSave = async (id: string) => {
		if (!editBenchId) { showToast('error', 'Please select a bench'); return }
		for (let i = 0; i < (editBench?.inputs.length ?? 0); i++) {
			const slot = editBench?.inputs[i]
			if (!slot?.required) continue
			const row = editInputs[i]
			const filled = row && (row.isNew ? !!row.newName?.trim() : !!row.item)
			if (!filled) {
				showToast('error', `Required input slot ${i + 1} is empty`)
				return
			}
		}
		const resolvedInputs = await resolveSlots(editInputs)
		const resolvedOutputs = await resolveSlots(editOutputs)
		if (resolvedInputs === null || resolvedOutputs === null) return
		if (resolvedOutputs.length === 0) {
			showToast('error', 'Recipe needs at least one output')
			return
		}
		try {
			await api.recipes.update(id, {
				benchId: editBenchId,
				inputs: resolvedInputs,
				outputs: resolvedOutputs,
			})
			showToast('success', 'Recipe updated')
			setEditingId(null)
			refreshAll()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to update recipe')
		}
	}

	const handleDelete = async (id: string, label: string) => {
		try {
			await api.recipes.delete(id)
			showToast('success', `Recipe deleted: ${label}`)
			setConfirmId(null)
			refreshAll()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to delete recipe')
		}
	}

	const recipeLabel = (r: Recipe) => {
		const benchName = gameBenches.find((b) => b.id === r.benchId)?.name ?? '?'
		const inNames = r.inputs.map((i) => i.itemName ?? gameItems.find((it) => it.id === i.item)?.name ?? '?').join(', ')
		const outNames = r.outputs.map((o) => o.itemName ?? gameItems.find((it) => it.id === o.item)?.name ?? '?').join(', ')
		return `${benchName}: ${inNames} → ${outNames}`
	}

	const noItemsOrBenches = gameItems.length === 0 || gameBenches.length === 0
	const visibleRecipes = showNullRecipes ? gameRecipes : gameRecipes.filter((r) => r.outputs.length > 0)
	const sortedRecipes = [...visibleRecipes].sort((a, b) => {
		const catOf = (r: Recipe) => {
			const firstOut = r.outputs[0]
			if (!firstOut) return '~'
			return gameItems.find((it) => it.id === firstOut.item)?.category ?? '~'
		}
		const ca = catOf(a) ?? '~'
		const cb = catOf(b) ?? '~'
		if (ca !== cb) return ca.localeCompare(cb)
		return recipeLabel(a).localeCompare(recipeLabel(b))
	})

	if (!selectedGameId) {
		return (
			<>
				<EmptyState message="Select a game in the navbar to manage its content." />
				<Toasts toasts={toasts} />
			</>
		)
	}

	return (
		<div className="space-y-4">
			<SectionCard title="Add Recipe">
				{noItemsOrBenches ? (
					<EmptyState message="Create at least one item and one bench before adding a recipe." />
				) : (
					<form onSubmit={handleAdd} className="space-y-2">
						<Combobox
							className={inputCls}
							value={benchId}
							onChange={onBenchChange}
							options={gameBenches.map((b) => ({ value: b.id, label: b.name ?? b.id }))}
							placeholder="Search bench..."
							tabIndex={1}
						/>
						<SlotEditor arr={inputs} setArr={setInputs} label="Inputs" items={gameItems} attributeKeys={gameAttrKeys} benchInputs={selectedBench?.inputs} baseTabIndex={2} />
						<SlotEditor arr={outputs} setArr={setOutputs} label="Outputs" items={gameItems} attributeKeys={gameAttrKeys} baseTabIndex={2 + inputs.length} />
						<button type="submit" className={btnPrimary} tabIndex={2 + inputs.length + outputs.length}>Create</button>
					</form>
				)}
			</SectionCard>

			<SectionCard title="Recipes" count={visibleRecipes.length}>
				<div className="flex items-center gap-2 pb-2">
					<label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
						<input
							type="checkbox"
							checked={showNullRecipes}
							onChange={(e) => setShowNullRecipes(e.target.checked)}
							className="accent-blue-600"
						/>
						Show null-output recipes
					</label>
				</div>
				{visibleRecipes.length === 0 ? (
					<EmptyState message="No recipes yet. Create one above." />
				) : (
					<div className="space-y-1">
						{sortedRecipes.map((r) => (
							<div key={r.id} className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
								{editingId === r.id ? (
									<div className="space-y-2">
										<Combobox
											className={inputCls}
											value={editBenchId}
											onChange={onEditBenchChange}
											options={gameBenches.map((b) => ({ value: b.id, label: b.name ?? b.id }))}
											placeholder="Search bench..."
										/>
										<SlotEditor arr={editInputs} setArr={setEditInputs} label="Inputs" items={gameItems} attributeKeys={gameAttrKeys} benchInputs={editBench?.inputs} />
										<SlotEditor arr={editOutputs} setArr={setEditOutputs} label="Outputs" items={gameItems} attributeKeys={gameAttrKeys} />
										<div className="flex gap-2">
											<button onClick={() => handleSave(r.id)} className={btnPrimary}>Save</button>
											<button onClick={() => setEditingId(null)} className={btnGhost}>Cancel</button>
										</div>
									</div>
								) : confirmId === r.id ? (
									<div className="flex items-center gap-2">
										<span className="flex-1 truncate text-xs text-red-700 dark:text-red-300">Delete this recipe?</span>
										<button onClick={() => handleDelete(r.id, recipeLabel(r))} className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700">Yes</button>
										<button onClick={() => setConfirmId(null)} className={btnGhost}>No</button>
									</div>
								) : (
									<ExpandableRow
										isExpanded={expandedIds.has(r.id)}
										onToggle={() => toggleExpand(r.id)}
										summary={
											<span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
												<span className="inline-block w-40 truncate align-bottom">{recipeLabel(r)}</span>
												{r.outputs.length > 0 && (
													<span className="ml-2 inline-block align-bottom text-xs text-gray-400">
														<span className="inline-block w-20 font-medium">Outputs:</span>
														<span className="inline-block truncate align-bottom">{r.outputs.map((o) => `${o.itemName ?? gameItems.find((it) => it.id === o.item)?.name ?? '?'}×${o.count}`).join(', ')}</span>
													</span>
												)}
											</span>
										}
										details={
											<div className="space-y-2">
												<div>
													<span className="font-medium text-gray-500 dark:text-gray-500">Bench: </span>
													{gameBenches.find((b) => b.id === r.benchId)?.name ?? '?'}
												</div>
												<div>
													<span className="font-medium text-gray-500 dark:text-gray-500">Inputs:</span>
													<div className="ml-4">
														{r.inputs.map((i, idx) => (
															<div key={idx}>{i.itemName ?? gameItems.find((it) => it.id === i.item)?.name ?? '?'} ×{i.count}</div>
														))}
													</div>
												</div>
												<div>
													<span className="font-medium text-gray-500 dark:text-gray-500">Outputs:</span>
													<div className="ml-4">
														{r.outputs.map((o, idx) => (
															<div key={idx}>{o.itemName ?? gameItems.find((it) => it.id === o.item)?.name ?? '?'} ×{o.count}</div>
														))}
													</div>
												</div>
											</div>
										}
										actions={
											<>
												<button onClick={() => startEdit(r)} className={`${btnGhost} opacity-0 group-hover:opacity-100`}>Edit</button>
												<button onClick={() => setConfirmId(r.id)} className={`${btnDanger} opacity-0 group-hover:opacity-100`}>🗑</button>
											</>
										}
									/>
								)}
							</div>
						))}
					</div>
				)}
			</SectionCard>

			<Toasts toasts={toasts} />
		</div>
	)
}
