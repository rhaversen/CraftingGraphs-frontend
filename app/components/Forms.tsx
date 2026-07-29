'use client'

import { useState } from 'react'
import { api } from '../api'
import type { Bench, BenchInput, Item, Recipe } from '../types'
import { AttributeEditor, type AttrRow, rowsToAttrs } from './AttributeEditor'

interface FormsProps {
	gameId: string | null
	items: Item[]
	benches: Bench[]
	recipes: Recipe[]
	onChanged: () => void
}

type ToastType = 'success' | 'error'
interface Toast {
	id: number
	type: ToastType
	message: string
}

let toastId = 0

function useToast() {
	const [toasts, setToasts] = useState<Toast[]>([])

	const showToast = (type: ToastType, message: string) => {
		const id = ++toastId
		setToasts((prev) => [...prev, { id, type, message }])
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id))
		}, 3000)
	}

	const ToastContainer = () => (
		<div className="fixed bottom-4 right-4 z-50 space-y-2">
			{toasts.map((t) => (
				<div
					key={t.id}
					className={`rounded-md px-4 py-2 text-sm shadow-lg ${
						t.type === 'success'
							? 'border border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
							: 'border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
					}`}
				>
					{t.message}
				</div>
			))}
		</div>
	)

	return { showToast, ToastContainer }
}

export default function Forms({ gameId, items, benches, onChanged, recipes }: FormsProps) {
	const { showToast, ToastContainer } = useToast()
	return (
		<>
			<ToastContainer />
			<div className="space-y-4">
				<GameForm onChanged={onChanged} showToast={showToast} />
				{gameId && (
					<>
						<ItemForm gameId={gameId} onChanged={onChanged} showToast={showToast} />
						<BenchForm gameId={gameId} onChanged={onChanged} showToast={showToast} />
						<RecipeForm
							gameId={gameId}
							items={items}
							benches={benches}
							onChanged={onChanged}
							showToast={showToast}
						/>
						<DeleteSection
							items={items}
							benches={benches}
							recipes={recipes}
							onChanged={onChanged}
							showToast={showToast}
						/>
					</>
				)}
			</div>
		</>
	)
}

type ToastFn = (type: ToastType, message: string) => void

const inputCls =
	'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="block">
			<span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
			{children}
		</label>
	)
}

function CollapsibleForm({
	title,
	children,
	onSubmit,
	submitLabel = 'Add',
	defaultOpen = false,
}: {
	title: string
	children: React.ReactNode
	onSubmit: (e: React.FormEvent) => void
	submitLabel?: string
	defaultOpen?: boolean
}) {
	const [open, setOpen] = useState(defaultOpen)
	return (
		<form
			onSubmit={onSubmit}
			className="rounded-lg border border-gray-200 dark:border-gray-800"
		>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800/50"
			>
				<span>{title}</span>
				<span className="text-gray-400">{open ? '▾' : '▸'}</span>
			</button>
			{open && (
				<div className="space-y-2 px-3 pb-3">
					{children}
					<button
						type="submit"
						className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
					>
						{submitLabel}
					</button>
				</div>
			)}
		</form>
	)
}

function GameForm({ onChanged, showToast }: { onChanged: () => void; showToast: ToastFn }) {
	const [name, setName] = useState('')
	const [link, setLink] = useState('')

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		try {
			await api.games.create({ name: name.trim(), link: link.trim() || undefined })
			showToast('success', `Game "${name.trim()}" created`)
			setName('')
			setLink('')
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create game')
		}
	}

	return (
		<CollapsibleForm title="Add Game" onSubmit={submit}>
			<Field label="Name">
				<input
					className={inputCls}
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Minecraft"
				/>
			</Field>
			<Field label="Link (optional)">
				<input
					className={inputCls}
					value={link}
					onChange={(e) => setLink(e.target.value)}
					placeholder="https://..."
				/>
			</Field>
		</CollapsibleForm>
	)
}

function ItemForm({
	gameId,
	onChanged,
	showToast,
}: {
	gameId: string
	onChanged: () => void
	showToast: ToastFn
}) {
	const [name, setName] = useState('')
	const [attrRows, setAttrRows] = useState<AttrRow[]>([{ key: '', value: '' }])

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		try {
			await api.items.create({ name: name.trim(), attributes: rowsToAttrs(attrRows), gameId })
			showToast('success', `Item "${name.trim()}" created`)
			setName('')
			setAttrRows([{ key: '', value: '' }])
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create item')
		}
	}

	return (
		<CollapsibleForm title="Add Item" onSubmit={submit}>
			<Field label="Name">
				<input
					className={inputCls}
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Iron Ingot"
				/>
			</Field>
			<AttributeEditor rows={attrRows} setRows={setAttrRows} />
		</CollapsibleForm>
	)
}

function BenchInputsEditor({
	inputs,
	setInputs,
}: {
	inputs: BenchInput[]
	setInputs: (inputs: BenchInput[]) => void
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
			{inputs.map((inp, i) => (
				<div key={i} className="flex flex-wrap items-center gap-1">
					<input
						className={`${inputCls} w-28`}
						value={inp.category ?? ''}
						onChange={(e) => update(i, { category: e.target.value || null })}
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
			<button type="button" onClick={add} className="text-xs text-blue-600 hover:text-blue-700">+ Add input slot</button>
		</div>
	)
}

function BenchForm({
	gameId,
	onChanged,
	showToast,
}: {
	gameId: string
	onChanged: () => void
	showToast: ToastFn
}) {
	const [name, setName] = useState('')
	const [inputs, setInputs] = useState<BenchInput[]>([])

	const submit = async (e: React.FormEvent) => {
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

	return (
		<CollapsibleForm title="Add Bench" onSubmit={submit}>
			<Field label="Name">
				<input
					className={inputCls}
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Furnace"
				/>
			</Field>
			<Field label="Input Slots (optional)">
				<BenchInputsEditor inputs={inputs} setInputs={setInputs} />
			</Field>
		</CollapsibleForm>
	)
}

interface SlotRow {
	item: string
	count: string
}

function RecipeForm({
	gameId,
	items,
	benches,
	onChanged,
	showToast,
}: {
	gameId: string
	items: Item[]
	benches: Bench[]
	onChanged: () => void
	showToast: ToastFn
}) {
	const [benchId, setBenchId] = useState('')
	const [inputs, setInputs] = useState<SlotRow[]>([{ item: '', count: '1' }])
	const [outputs, setOutputs] = useState<SlotRow[]>([{ item: '', count: '1' }])
	const [submitting, setSubmitting] = useState(false)

	const updateSlot = (
		arr: SlotRow[],
		setArr: (a: SlotRow[]) => void,
		idx: number,
		patch: Partial<SlotRow>,
	) => {
		setArr(arr.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
	}
	const addSlot = (arr: SlotRow[], setArr: (a: SlotRow[]) => void) =>
		setArr([...arr, { item: '', count: '1' }])
	const removeSlot = (arr: SlotRow[], setArr: (a: SlotRow[]) => void, idx: number) =>
		setArr(arr.filter((_, i) => i !== idx))

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!benchId) {
			showToast('error', 'Please select a bench')
			return
		}
		const cleanInputs = inputs.filter((s) => s.item)
		const cleanOutputs = outputs.filter((s) => s.item)
		if (cleanInputs.length === 0 || cleanOutputs.length === 0) {
			showToast('error', 'Recipe needs at least one input and one output')
			return
		}

		setSubmitting(true)
		try {
			await api.recipes.create({
				gameId,
				benchId,
				inputs: cleanInputs.map((s) => ({ item: s.item, count: Number(s.count) || 1 })),
				outputs: cleanOutputs.map((s) => ({ item: s.item, count: Number(s.count) || 1 })),
			})
			showToast('success', 'Recipe created')
			setBenchId('')
			setInputs([{ item: '', count: '1' }])
			setOutputs([{ item: '', count: '1' }])
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create recipe')
		} finally {
			setSubmitting(false)
		}
	}

	if (items.length === 0 || benches.length === 0) {
		return (
			<div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-xs text-gray-500">
				Create at least one item and one bench before adding a recipe.
			</div>
		)
	}

	const slotEditor = (
		arr: SlotRow[],
		setArr: (a: SlotRow[]) => void,
		label: string,
	) => (
		<div>
			<span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
			<div className="space-y-1">
				{arr.map((row, idx) => (
					<div key={idx} className="flex gap-1">
						<select
							className={inputCls}
							value={row.item}
							onChange={(e) => updateSlot(arr, setArr, idx, { item: e.target.value })}
						>
							<option value="">Select item...</option>
							{items.map((it) => (
								<option key={it.id} value={it.id}>
									{it.name}
								</option>
							))}
						</select>
						<input
							className={`${inputCls} w-16`}
							type="number"
							min="1"
							value={row.count}
							onChange={(e) => updateSlot(arr, setArr, idx, { count: e.target.value })}
						/>
						{arr.length > 1 && (
							<button
								type="button"
								onClick={() => removeSlot(arr, setArr, idx)}
								className="rounded px-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
							>
								✕
							</button>
						)}
					</div>
				))}
			</div>
			<button
				type="button"
				onClick={() => addSlot(arr, setArr)}
				className="mt-1 text-xs text-blue-600 hover:underline"
			>
				+ Add slot
			</button>
		</div>
	)

	return (
		<CollapsibleForm title="Add Recipe" onSubmit={submit} submitLabel={submitting ? 'Adding...' : 'Add'}>
			<Field label="Bench">
				<select
					className={inputCls}
					value={benchId}
					onChange={(e) => setBenchId(e.target.value)}
				>
					<option value="">Select bench...</option>
					{benches.map((b) => (
						<option key={b.id} value={b.id}>
							{b.name}
						</option>
					))}
				</select>
			</Field>
			{slotEditor(inputs, setInputs, 'Inputs')}
			{slotEditor(outputs, setOutputs, 'Outputs')}
		</CollapsibleForm>
	)
}

function DeleteSection({
	items,
	benches,
	recipes,
	onChanged,
	showToast,
}: {
	items: Item[]
	benches: Bench[]
	recipes: Recipe[]
	onChanged: () => void
	showToast: ToastFn
}) {
	const [expanded, setExpanded] = useState(false)
	const [confirmId, setConfirmId] = useState<string | null>(null)

	const handleDelete = async (type: 'item' | 'bench' | 'recipe', id: string, name: string) => {
		try {
			if (type === 'item') await api.items.delete(id)
			else if (type === 'bench') await api.benches.delete(id)
			else await api.recipes.delete(id)
			showToast('success', `${type === 'item' ? 'Item' : type === 'bench' ? 'Bench' : 'Recipe'} "${name}" deleted`)
			setConfirmId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : `Failed to delete ${type}`)
		}
	}

	const recipeLabel = (r: Recipe) => {
		const benchName = benches.find((b) => b.id === r.benchId)?.name ?? '?'
		const inNames = r.inputs.map((i) => i.itemName ?? items.find((it) => it.id === i.item)?.name ?? '?').join(', ')
		const outNames = r.outputs.map((o) => o.itemName ?? items.find((it) => it.id === o.item)?.name ?? '?').join(', ')
		return `${benchName}: ${inNames} → ${outNames}`
	}

	const entityCount = items.length + benches.length + recipes.length
	if (entityCount === 0) return null

	return (
		<div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex w-full items-center justify-between text-sm font-semibold text-red-600 dark:text-red-400"
			>
				<span>Manage / Delete</span>
				<span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
			</button>

			{expanded && (
				<div className="space-y-3">
					{items.length > 0 && (
						<div>
							<div className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
								Items ({items.length})
							</div>
							<div className="space-y-0.5">
								{items.map((it) => (
									<DeleteRow
										key={it.id}
										label={it.name ?? it.id}
										isConfirming={confirmId === it.id}
										onDelete={() => handleDelete('item', it.id, it.name ?? it.id)}
										onConfirm={() => setConfirmId(it.id)}
										onCancel={() => setConfirmId(null)}
									/>
								))}
							</div>
						</div>
					)}

					{benches.length > 0 && (
						<div>
							<div className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
								Benches ({benches.length})
							</div>
							<div className="space-y-0.5">
								{benches.map((b) => (
									<DeleteRow
										key={b.id}
										label={b.name ?? b.id}
										isConfirming={confirmId === b.id}
										onDelete={() => handleDelete('bench', b.id, b.name ?? b.id)}
										onConfirm={() => setConfirmId(b.id)}
										onCancel={() => setConfirmId(null)}
									/>
								))}
							</div>
						</div>
					)}

					{recipes.length > 0 && (
						<div>
							<div className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
								Recipes ({recipes.length})
							</div>
							<div className="space-y-0.5">
								{recipes.map((r) => (
									<DeleteRow
										key={r.id}
										label={recipeLabel(r)}
										isConfirming={confirmId === r.id}
										onDelete={() => handleDelete('recipe', r.id, recipeLabel(r))}
										onConfirm={() => setConfirmId(r.id)}
										onCancel={() => setConfirmId(null)}
									/>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

function DeleteRow({
	label,
	isConfirming,
	onDelete,
	onConfirm,
	onCancel,
}: {
	label: string
	isConfirming: boolean
	onDelete: () => void
	onConfirm: () => void
	onCancel: () => void
}) {
	if (isConfirming) {
		return (
			<div className="flex items-center gap-1 rounded bg-red-50 dark:bg-red-950 p-1">
				<span className="flex-1 truncate text-xs text-red-700 dark:text-red-300">Delete?</span>
				<button
					type="button"
					onClick={onDelete}
					className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
				>
					Yes
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					No
				</button>
			</div>
		)
	}
	return (
		<div className="group flex items-center gap-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 p-0.5">
			<span className="flex-1 truncate text-xs text-gray-600 dark:text-gray-400">{label}</span>
			<button
				type="button"
				onClick={onConfirm}
				className="rounded px-1.5 py-0.5 text-xs text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950"
			>
				🗑
			</button>
		</div>
	)
}
