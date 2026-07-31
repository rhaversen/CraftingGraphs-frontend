'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGameData } from '../../components/GameDataProvider'
import { api } from '../../api'
import type { Bench, BenchInput, Item } from '../../types'
import { Combobox, type ComboboxOption } from '../../components/Combobox'
import { ExpandableRow, useExpanded } from '../../components/ExpandableRow'
import { useToast, Toasts, SectionCard, EmptyState, inputCls, btnPrimary, btnGhost, btnDanger } from '../_shared'

export default function BenchesPage() {
	const { items, benches, refreshAll } = useGameData()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')
	const { showToast, toasts } = useToast()

	if (!selectedGameId) {
		return (
			<>
				<EmptyState message="Select a game in the navbar to manage its content." />
				<Toasts toasts={toasts} />
			</>
		)
	}

	const gameItems = items.filter((i) => i.gameId === selectedGameId)
	const gameBenches = benches.filter((b) => b.gameId === selectedGameId)

	return (
		<>
			<BenchesTab
				gameId={selectedGameId}
				benches={gameBenches}
				items={gameItems}
				onChanged={refreshAll}
				showToast={showToast}
			/>
			<Toasts toasts={toasts} />
		</>
	)
}

function BenchInputsEditor({
	inputs,
	setInputs,
	categories,
}: {
	inputs: BenchInput[]
	setInputs: (inputs: BenchInput[]) => void
	categories: ComboboxOption[]
}) {
	const update = (i: number, patch: Partial<BenchInput>) => {
		setInputs(inputs.map((inp, idx) => (idx === i ? { ...inp, ...patch } : inp)))
	}
	const remove = (i: number) => {
		setInputs(inputs.filter((_, idx) => idx !== i))
	}
	const add = () => {
		setInputs([...inputs, { category: null, required: false }])
	}

	return (
		<div className="space-y-1">
			<div className="text-xs font-medium text-gray-500 dark:text-gray-400">Input slots</div>
			{inputs.map((inp, i) => (
				<div key={i} className="flex flex-wrap items-center gap-1">
					<Combobox
						className={`${inputCls} w-28`}
						value={inp.category ?? ''}
						onChange={(v) => update(i, { category: v || null })}
						options={categories}
						placeholder="Category"
					/>
					<label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
						<input
							type="checkbox"
							checked={inp.required}
							onChange={(e) => update(i, { required: e.target.checked })}
						/>
						req
					</label>
					<button type="button" onClick={() => remove(i)} className="text-xs text-red-500 hover:text-red-700">×</button>
				</div>
			))}
			<button type="button" onClick={add} className={btnGhost}>+ Add input slot</button>
		</div>
	)
}

function BenchesTab({
	gameId,
	benches,
	items,
	onChanged,
	showToast,
}: {
	gameId: string
	benches: Bench[]
	items: Item[]
	onChanged: () => void
	showToast: (type: 'success' | 'error', message: string) => void
}) {
	const [name, setName] = useState('')
	const [inputs, setInputs] = useState<BenchInput[]>([])
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const [editInputs, setEditInputs] = useState<BenchInput[]>([])
	const [confirmId, setConfirmId] = useState<string | null>(null)
	const { expandedIds, toggleExpand } = useExpanded()

	const categorySet = new Set<string>()
	for (const it of items) {
		if (it.category) categorySet.add(it.category)
	}
	const categoryOptions: ComboboxOption[] = [...categorySet].sort().map((c) => ({ value: c, label: c }))

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		try {
			await api.benches.create({ name: name.trim(), inputs, gameId })
			showToast('success', `Bench "${name.trim()}" created`)
			setName('')
			setInputs([])
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create bench')
		}
	}

	const startEdit = (b: Bench) => {
		setEditingId(b.id)
		setEditName(b.name ?? '')
		setEditInputs(b.inputs.map((inp) => ({ category: inp.category, required: inp.required })))
		setConfirmId(null)
	}

	const handleSave = async (id: string) => {
		try {
			await api.benches.update(id, { name: editName.trim(), inputs: editInputs })
			showToast('success', 'Bench updated')
			setEditingId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to update bench')
		}
	}

	const handleDelete = async (id: string, name: string) => {
		try {
			await api.benches.delete(id)
			showToast('success', `Bench "${name}" deleted`)
			setConfirmId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to delete bench')
		}
	}

	return (
		<div className="space-y-4">
			<SectionCard title="Add Bench">
				<form onSubmit={handleAdd} className="space-y-2">
					<input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bench name" autoFocus />
					<BenchInputsEditor inputs={inputs} setInputs={setInputs} categories={categoryOptions} />
					<button type="submit" className={btnPrimary}>Create</button>
				</form>
			</SectionCard>

			<SectionCard title="Benches" count={benches.length}>
				{benches.length === 0 ? (
					<EmptyState message="No benches yet. Create one above." />
				) : (
					<div className="space-y-1">
						{[...benches].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((b) => (
							<div key={b.id} className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
								{editingId === b.id ? (
									<div className="space-y-2">
										<input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
										<BenchInputsEditor inputs={editInputs} setInputs={setEditInputs} categories={categoryOptions} />
										<div className="flex gap-2">
											<button onClick={() => handleSave(b.id)} className={btnPrimary}>Save</button>
											<button onClick={() => setEditingId(null)} className={btnGhost}>Cancel</button>
										</div>
									</div>
								) : confirmId === b.id ? (
									<div className="flex items-center gap-2">
										<span className="flex-1 text-xs text-red-700 dark:text-red-300">Delete &ldquo;{b.name ?? b.id}&rdquo;?</span>
										<button onClick={() => handleDelete(b.id, b.name ?? b.id)} className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700">Yes</button>
										<button onClick={() => setConfirmId(null)} className={btnGhost}>No</button>
									</div>
								) : (
									<ExpandableRow
										isExpanded={expandedIds.has(b.id)}
										onToggle={() => toggleExpand(b.id)}
										summary={
											<span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
												<span className="inline-block w-40 truncate align-bottom">{b.name ?? b.id}</span>
												{b.inputs.length > 0 && (
													<span className="ml-2 inline-block align-bottom text-xs text-gray-400">
														<span className="inline-block w-20 font-medium">Inputs:</span>
														<span className="inline-block truncate align-bottom">{b.inputs.map((inp) => inp.category ?? 'any').join(', ')}</span>
													</span>
												)}
											</span>
										}
										details={
											<div className="space-y-1">
												{b.inputs.length === 0 ? (
													<span className="text-xs text-gray-400">No input slots</span>
												) : (
													b.inputs.map((inp, i) => (
														<div key={i} className="flex gap-2">
															<span className="font-medium text-gray-500 dark:text-gray-500">Slot {i + 1}:</span>
															<span>{inp.category ?? 'any'}{inp.required ? ' (required)' : ' (optional)'}</span>
														</div>
													))
												)}
											</div>
										}
										actions={
											<>
												<button onClick={() => startEdit(b)} className={`${btnGhost} opacity-0 group-hover:opacity-100`}>Edit</button>
												<button onClick={() => setConfirmId(b.id)} className={`${btnDanger} opacity-0 group-hover:opacity-100`}>🗑</button>
											</>
										}
									/>
								)}
							</div>
						))}
					</div>
				)}
			</SectionCard>
		</div>
	)
}
