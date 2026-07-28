'use client'

import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGameData } from '../components/GameDataProvider'
import { api } from '../api'
import type { Bench, Game, Item, Recipe, RecipeSlot } from '../types'
import { AttributeEditor, type AttrRow, attrsToRows, rowsToAttrs } from '../components/AttributeEditor'
import { MissingRecipesTab } from '../components/MissingRecipes'

type TabId = 'games' | 'items' | 'benches' | 'recipes' | 'missing'

type ToastType = 'success' | 'error'
interface ToastMsg {
	id: number
	type: ToastType
	message: string
}

let toastCounter = 0

function useToast() {
	const [toasts, setToasts] = useState<ToastMsg[]>([])

	const showToast = (type: ToastType, message: string) => {
		const id = ++toastCounter
		setToasts((prev) => [...prev, { id, type, message }])
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id))
		}, 3000)
	}

	return { showToast, toasts }
}

const inputCls =
	'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

const btnPrimary =
	'rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
const btnGhost =
	'rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
const btnDanger =
	'rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950'

function Toasts({ toasts }: { toasts: ToastMsg[] }) {
	return (
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
}

function SectionCard({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-800">
			<div className="flex items-center justify-between px-3 py-2">
				<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
					{title}
					{count !== undefined && (
						<span className="ml-2 text-xs text-gray-400">({count})</span>
					)}
				</span>
			</div>
			<div className="px-3 pb-3">{children}</div>
		</div>
	)
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="py-6 text-center text-sm text-gray-400">{message}</div>
	)
}

export default function ManagePage() {
	const { games, items, benches, recipes, loading, error, clearError, refreshAll } = useGameData()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')
	const [tab, setTab] = useState<TabId>('games')
	const { showToast, toasts } = useToast()

	const gameItems = items.filter((i) => i.gameId === selectedGameId)
	const gameBenches = benches.filter((b) => b.gameId === selectedGameId)
	const gameRecipes = recipes.filter((r) => r.gameId === selectedGameId)

	const tabs: { id: TabId; label: string; count: number }[] = [
		{ id: 'games', label: 'Games', count: games.length },
		{ id: 'items', label: 'Items', count: gameItems.length },
		{ id: 'benches', label: 'Benches', count: gameBenches.length },
		{ id: 'recipes', label: 'Recipes', count: gameRecipes.length },
		{ id: 'missing', label: 'Missing', count: 0 },
	]

	if (loading) {
		return (
			<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
				<div className="h-10 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
				<div className="h-96 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
			</main>
		)
	}

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
			<Toasts toasts={toasts} />

			{error && (
				<div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-2 text-sm text-red-700 dark:text-red-300">
					{error}
					<button className="ml-2 underline" onClick={clearError}>dismiss</button>
				</div>
			)}

			{!selectedGameId && tab !== 'games' && (
				<div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-2 text-sm text-amber-700 dark:text-amber-300">
					Select a game in the navbar above to manage its items, benches, and recipes. The Games tab is always available.
				</div>
			)}

			{/* Tab bar */}
			<div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
				{tabs.map((t) => (
					<button
						key={t.id}
						onClick={() => setTab(t.id)}
						className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
							tab === t.id
								? 'border-x border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400'
								: 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
						}`}
					>
						{t.label}
						<span className="ml-1.5 text-xs text-gray-400">{t.count}</span>
					</button>
				))}
			</div>

			{/* Tab content */}
			{tab === 'games' && (
				<GamesTab games={games} onChanged={refreshAll} showToast={showToast} />
			)}
			{tab === 'items' && selectedGameId && (
				<ItemsTab
					gameId={selectedGameId}
					items={gameItems}
					onChanged={refreshAll}
					showToast={showToast}
				/>
			)}
			{tab === 'benches' && selectedGameId && (
				<BenchesTab
					gameId={selectedGameId}
					benches={gameBenches}
					onChanged={refreshAll}
					showToast={showToast}
				/>
			)}
			{tab === 'recipes' && selectedGameId && (
				<RecipesTab
					gameId={selectedGameId}
					items={gameItems}
					benches={gameBenches}
					recipes={gameRecipes}
					onChanged={refreshAll}
					showToast={showToast}
				/>
			)}
			{tab === 'missing' && selectedGameId && (
				<MissingRecipesTab
					gameId={selectedGameId}
					items={gameItems}
					benches={gameBenches}
					recipes={gameRecipes}
					onChanged={refreshAll}
					showToast={showToast}
				/>
			)}
			{tab !== 'games' && !selectedGameId && (
				<EmptyState message="Select a game in the navbar to manage its content." />
			)}
		</main>
	)
}

// ─── Games Tab ────────────────────────────────────────────

function GamesTab({
	games,
	onChanged,
	showToast,
}: {
	games: Game[]
	onChanged: () => void
	showToast: (type: ToastType, message: string) => void
}) {
	const [showAdd, setShowAdd] = useState(false)
	const [name, setName] = useState('')
	const [link, setLink] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const [editLink, setEditLink] = useState('')
	const [confirmId, setConfirmId] = useState<string | null>(null)

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		try {
			await api.games.create({ name: name.trim(), link: link.trim() || undefined })
			showToast('success', `Game "${name.trim()}" created`)
			setName('')
			setLink('')
			setShowAdd(false)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create game')
		}
	}

	const startEdit = (g: Game) => {
		setEditingId(g.id)
		setEditName(g.name ?? '')
		setEditLink(g.link ?? '')
		setConfirmId(null)
	}

	const handleSave = async (id: string) => {
		try {
			await api.games.update(id, { name: editName.trim(), link: editLink.trim() || undefined })
			showToast('success', 'Game updated')
			setEditingId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to update game')
		}
	}

	const handleDelete = async (id: string, name: string) => {
		try {
			await api.games.delete(id)
			showToast('success', `Game "${name}" deleted`)
			setConfirmId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to delete game')
		}
	}

	return (
		<div className="space-y-4">
			<SectionCard title="Add Game">
				{showAdd ? (
					<form onSubmit={handleAdd} className="space-y-2">
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Game name" autoFocus />
							<input className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Wiki link (optional)" />
						</div>
						<div className="flex gap-2">
							<button type="submit" className={btnPrimary}>Create</button>
							<button type="button" className={btnGhost} onClick={() => setShowAdd(false)}>Cancel</button>
						</div>
					</form>
				) : (
					<button onClick={() => setShowAdd(true)} className={btnGhost}>+ Add new game</button>
				)}
			</SectionCard>

			<SectionCard title="Games" count={games.length}>
				{games.length === 0 ? (
					<EmptyState message="No games yet. Create one above." />
				) : (
					<div className="space-y-1">
						{games.map((g) => (
							<div key={g.id} className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
								{editingId === g.id ? (
									<div className="space-y-2">
										<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
											<input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
											<input className={inputCls} value={editLink} onChange={(e) => setEditLink(e.target.value)} placeholder="Link" />
										</div>
										<div className="flex gap-2">
											<button onClick={() => handleSave(g.id)} className={btnPrimary}>Save</button>
											<button onClick={() => setEditingId(null)} className={btnGhost}>Cancel</button>
										</div>
									</div>
								) : confirmId === g.id ? (
									<div className="flex items-center gap-2">
							<span className="flex-1 text-xs text-red-700 dark:text-red-300">Delete &ldquo;{g.name ?? g.id}&rdquo; and all its data?</span>
							<button onClick={() => handleDelete(g.id, g.name ?? g.id)} className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700">Yes</button>
										<button onClick={() => setConfirmId(null)} className={btnGhost}>No</button>
									</div>
								) : (
									<div className="group flex items-center gap-2">
										<div className="flex-1 min-w-0">
											<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{g.name}</span>
											{g.link && (
												<a href={g.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-blue-500 hover:underline truncate">
													{g.link}
												</a>
											)}
										</div>
										<button onClick={() => startEdit(g)} className={`${btnGhost} opacity-0 group-hover:opacity-100`}>Edit</button>
										<button onClick={() => setConfirmId(g.id)} className={`${btnDanger} opacity-0 group-hover:opacity-100`}>🗑</button>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</SectionCard>
		</div>
	)
}

// ─── Items Tab ────────────────────────────────────────────

function ItemsTab({
	gameId,
	items,
	onChanged,
	showToast,
}: {
	gameId: string
	items: Item[]
	onChanged: () => void
	showToast: (type: ToastType, message: string) => void
}) {
	const [showAdd, setShowAdd] = useState(false)
	const [name, setName] = useState('')
	const [attrRows, setAttrRows] = useState<AttrRow[]>([{ key: '', value: '' }])
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const [editAttrRows, setEditAttrRows] = useState<AttrRow[]>([{ key: '', value: '' }])
	const [confirmId, setConfirmId] = useState<string | null>(null)

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		try {
			await api.items.create({ name: name.trim(), attributes: rowsToAttrs(attrRows), gameId })
			showToast('success', `Item "${name.trim()}" created`)
			setName('')
			setAttrRows([{ key: '', value: '' }])
			setShowAdd(false)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create item')
		}
	}

	const startEdit = (it: Item) => {
		setEditingId(it.id)
		setEditName(it.name ?? '')
		setEditAttrRows(attrsToRows(it.attributes))
		setConfirmId(null)
	}

	const handleSave = async (id: string) => {
		try {
			await api.items.update(id, { name: editName.trim(), attributes: rowsToAttrs(editAttrRows) })
			showToast('success', 'Item updated')
			setEditingId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to update item')
		}
	}

	const handleDelete = async (id: string, name: string) => {
		try {
			await api.items.delete(id)
			showToast('success', `Item "${name}" deleted`)
			setConfirmId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to delete item')
		}
	}

	return (
		<div className="space-y-4">
			<SectionCard title="Add Item">
				{showAdd ? (
					<form onSubmit={handleAdd} className="space-y-2">
					<input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" autoFocus />
					<AttributeEditor rows={attrRows} setRows={setAttrRows} />
						<div className="flex gap-2">
							<button type="submit" className={btnPrimary}>Create</button>
							<button type="button" className={btnGhost} onClick={() => setShowAdd(false)}>Cancel</button>
						</div>
					</form>
				) : (
					<button onClick={() => setShowAdd(true)} className={btnGhost}>+ Add new item</button>
				)}
			</SectionCard>

			<SectionCard title="Items" count={items.length}>
				{items.length === 0 ? (
					<EmptyState message="No items yet. Create one above." />
				) : (
					<div className="space-y-1">
						{items.map((it) => (
							<div key={it.id} className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
								{editingId === it.id ? (
									<div className="space-y-2">
										<input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
										<AttributeEditor rows={editAttrRows} setRows={setEditAttrRows} />
										<div className="flex gap-2">
											<button onClick={() => handleSave(it.id)} className={btnPrimary}>Save</button>
											<button onClick={() => setEditingId(null)} className={btnGhost}>Cancel</button>
										</div>
									</div>
								) : confirmId === it.id ? (
									<div className="flex items-center gap-2">
							<span className="flex-1 text-xs text-red-700 dark:text-red-300">Delete &ldquo;{it.name ?? it.id}&rdquo;?</span>
							<button onClick={() => handleDelete(it.id, it.name ?? it.id)} className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700">Yes</button>
										<button onClick={() => setConfirmId(null)} className={btnGhost}>No</button>
									</div>
								) : (
									<div className="group flex items-center gap-2">
							<span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{it.name ?? it.id}</span>

										<button onClick={() => startEdit(it)} className={`${btnGhost} opacity-0 group-hover:opacity-100`}>Edit</button>
										<button onClick={() => setConfirmId(it.id)} className={`${btnDanger} opacity-0 group-hover:opacity-100`}>🗑</button>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</SectionCard>
		</div>
	)
}

// ─── Benches Tab ──────────────────────────────────────────

function BenchesTab({
	gameId,
	benches,
	onChanged,
	showToast,
}: {
	gameId: string
	benches: Bench[]
	onChanged: () => void
	showToast: (type: ToastType, message: string) => void
}) {
	const [showAdd, setShowAdd] = useState(false)
	const [name, setName] = useState('')
	const [inputCount, setInputCount] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const [editInputCount, setEditInputCount] = useState('')
	const [confirmId, setConfirmId] = useState<string | null>(null)

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		try {
			await api.benches.create({ name: name.trim(), inputCount: Number(inputCount) || null, gameId })
			showToast('success', `Bench "${name.trim()}" created`)
			setName('')
			setInputCount('')
			setShowAdd(false)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create bench')
		}
	}

	const startEdit = (b: Bench) => {
		setEditingId(b.id)
		setEditName(b.name ?? '')
		setEditInputCount(b.inputCount != null ? String(b.inputCount) : '')
		setConfirmId(null)
	}

	const handleSave = async (id: string) => {
		try {
			await api.benches.update(id, { name: editName.trim(), inputCount: Number(editInputCount) || null })
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
				{showAdd ? (
					<form onSubmit={handleAdd} className="space-y-2">
					<input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bench name" autoFocus />
					<input className={inputCls} type="number" min="0" value={inputCount} onChange={(e) => setInputCount(e.target.value)} placeholder="Input count (optional)" />
					<div className="flex gap-2">
						<button type="submit" className={btnPrimary}>Create</button>
						<button type="button" className={btnGhost} onClick={() => setShowAdd(false)}>Cancel</button>
					</div>
				</form>
				) : (
					<button onClick={() => setShowAdd(true)} className={btnGhost}>+ Add new bench</button>
				)}
			</SectionCard>

			<SectionCard title="Benches" count={benches.length}>
				{benches.length === 0 ? (
					<EmptyState message="No benches yet. Create one above." />
				) : (
					<div className="space-y-1">
						{benches.map((b) => (
							<div key={b.id} className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
								{editingId === b.id ? (
									<div className="space-y-2">
									<input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
									<input className={inputCls} type="number" min="0" value={editInputCount} onChange={(e) => setEditInputCount(e.target.value)} placeholder="Input count (optional)" />
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
									<div className="group flex items-center gap-2">
							<span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{b.name ?? b.id}</span>
							{b.inputCount != null && <span className="text-xs text-gray-400">{b.inputCount} inputs</span>}
										<button onClick={() => startEdit(b)} className={`${btnGhost} opacity-0 group-hover:opacity-100`}>Edit</button>
										<button onClick={() => setConfirmId(b.id)} className={`${btnDanger} opacity-0 group-hover:opacity-100`}>🗑</button>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</SectionCard>
		</div>
	)
}

// ─── Recipes Tab ──────────────────────────────────────────

interface SlotRow {
	item: string
	count: string
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
}: {
	arr: SlotRow[]
	setArr: (a: SlotRow[]) => void
	label: string
	items: Item[]
}) {
	return (
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
								<option key={it.id} value={it.id}>{it.name}</option>
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
							<button type="button" onClick={() => removeSlot(arr, setArr, idx)} className="rounded px-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950">✕</button>
						)}
					</div>
				))}
			</div>
			<button type="button" onClick={() => addSlot(arr, setArr)} className="mt-1 text-xs text-blue-600 hover:underline">+ Add slot</button>
		</div>
	)
}

function RecipesTab({
	gameId,
	items,
	benches,
	recipes,
	onChanged,
	showToast,
}: {
	gameId: string
	items: Item[]
	benches: Bench[]
	recipes: Recipe[]
	onChanged: () => void
	showToast: (type: ToastType, message: string) => void
}) {
	const [showAdd, setShowAdd] = useState(false)
	const [benchId, setBenchId] = useState('')
	const [inputs, setInputs] = useState<SlotRow[]>([{ item: '', count: '1' }])
	const [outputs, setOutputs] = useState<SlotRow[]>([{ item: '', count: '1' }])
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editBenchId, setEditBenchId] = useState('')
	const [editInputs, setEditInputs] = useState<SlotRow[]>([])
	const [editOutputs, setEditOutputs] = useState<SlotRow[]>([])
	const [confirmId, setConfirmId] = useState<string | null>(null)

	const slotToRow = (s: RecipeSlot): SlotRow => ({ item: s.item, count: String(s.count) })
	const rowToSlot = (r: SlotRow) => ({ item: r.item, count: Number(r.count) || 1 })

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		const cleanInputs = inputs.filter((s) => s.item)
		const cleanOutputs = outputs.filter((s) => s.item)
		if (!benchId) { showToast('error', 'Please select a bench'); return }
		if (cleanInputs.length === 0 || cleanOutputs.length === 0) {
			showToast('error', 'Recipe needs at least one input and one output')
			return
		}
		try {
			await api.recipes.create({
				gameId,
				benchId,
				inputs: cleanInputs.map(rowToSlot),
				outputs: cleanOutputs.map(rowToSlot),
			})
			showToast('success', 'Recipe created')
			setBenchId('')
			setInputs([{ item: '', count: '1' }])
			setOutputs([{ item: '', count: '1' }])
			setShowAdd(false)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create recipe')
		}
	}

	const startEdit = (r: Recipe) => {
		setEditingId(r.id)
		setEditBenchId(r.benchId)
		setEditInputs(r.inputs.map(slotToRow))
		setEditOutputs(r.outputs.map(slotToRow))
		setConfirmId(null)
	}

	const handleSave = async (id: string) => {
		const cleanInputs = editInputs.filter((s) => s.item)
		const cleanOutputs = editOutputs.filter((s) => s.item)
		if (!editBenchId) { showToast('error', 'Please select a bench'); return }
		if (cleanInputs.length === 0 || cleanOutputs.length === 0) {
			showToast('error', 'Recipe needs at least one input and one output')
			return
		}
		try {
			await api.recipes.update(id, {
				benchId: editBenchId,
				inputs: cleanInputs.map(rowToSlot),
				outputs: cleanOutputs.map(rowToSlot),
			})
			showToast('success', 'Recipe updated')
			setEditingId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to update recipe')
		}
	}

	const handleDelete = async (id: string, label: string) => {
		try {
			await api.recipes.delete(id)
			showToast('success', `Recipe deleted: ${label}`)
			setConfirmId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to delete recipe')
		}
	}

	const recipeLabel = (r: Recipe) => {
		const benchName = benches.find((b) => b.id === r.benchId)?.name ?? '?'
		const inNames = r.inputs.map((i) => i.itemName ?? items.find((it) => it.id === i.item)?.name ?? '?').join(', ')
		const outNames = r.outputs.map((o) => o.itemName ?? items.find((it) => it.id === o.item)?.name ?? '?').join(', ')
		return `${benchName}: ${inNames} → ${outNames}`
	}

	const noItemsOrBenches = items.length === 0 || benches.length === 0

	return (
		<div className="space-y-4">
			<SectionCard title="Add Recipe">
				{noItemsOrBenches ? (
					<EmptyState message="Create at least one item and one bench before adding a recipe." />
				) : showAdd ? (
					<form onSubmit={handleAdd} className="space-y-2">
						<select className={inputCls} value={benchId} onChange={(e) => setBenchId(e.target.value)}>
							<option value="">Select bench...</option>
							{benches.map((b) => (
								<option key={b.id} value={b.id}>{b.name}</option>
							))}
						</select>
						<SlotEditor arr={inputs} setArr={setInputs} label="Inputs" items={items} />
						<SlotEditor arr={outputs} setArr={setOutputs} label="Outputs" items={items} />
						<div className="flex gap-2">
							<button type="submit" className={btnPrimary}>Create</button>
							<button type="button" className={btnGhost} onClick={() => setShowAdd(false)}>Cancel</button>
						</div>
					</form>
				) : (
					<button onClick={() => setShowAdd(true)} className={btnGhost}>+ Add new recipe</button>
				)}
			</SectionCard>

			<SectionCard title="Recipes" count={recipes.length}>
				{recipes.length === 0 ? (
					<EmptyState message="No recipes yet. Create one above." />
				) : (
					<div className="space-y-1">
						{recipes.map((r) => (
							<div key={r.id} className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
								{editingId === r.id ? (
									<div className="space-y-2">
									<select className={inputCls} value={editBenchId} onChange={(e) => setEditBenchId(e.target.value)}>
										<option value="">Select bench...</option>
										{benches.map((b) => (
											<option key={b.id} value={b.id}>{b.name}</option>
										))}
									</select>
									<SlotEditor arr={editInputs} setArr={setEditInputs} label="Inputs" items={items} />
									<SlotEditor arr={editOutputs} setArr={setEditOutputs} label="Outputs" items={items} />

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
									<div className="group flex items-center gap-2">
										<span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">{recipeLabel(r)}</span>

										<button onClick={() => startEdit(r)} className={`${btnGhost} opacity-0 group-hover:opacity-100`}>Edit</button>
										<button onClick={() => setConfirmId(r.id)} className={`${btnDanger} opacity-0 group-hover:opacity-100`}>🗑</button>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</SectionCard>
		</div>
	)
}
