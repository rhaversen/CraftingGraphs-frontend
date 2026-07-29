'use client'

import { useState, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGameData } from '../components/GameDataProvider'
import { api } from '../api'
import type { Bench, BenchInput, Game, Item, Recipe, RecipeSlot } from '../types'
import { AttributeEditor, type AttrRow, attrsToRows, keysToRows, rowsToAttrs } from '../components/AttributeEditor'
import { MissingRecipesTab } from '../components/MissingRecipes'
import { NewItemFields } from '../components/NewItemFields'
import { CleanupTab } from '../components/CleanupTab'
import { ExpandableRow, useExpanded } from '../components/ExpandableRow'
import { Combobox, type ComboboxOption } from '../components/Combobox'

type TabId = 'games' | 'items' | 'benches' | 'recipes' | 'missing' | 'cleanup'

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
	const selectedGame = games.find((g) => g.id === selectedGameId)
	const gameAttrKeys = selectedGame?.attributeKeys ?? []

	const tabs: { id: TabId; label: string; count: number }[] = [
		{ id: 'games', label: 'Games', count: games.length },
		{ id: 'items', label: 'Items', count: gameItems.length },
		{ id: 'benches', label: 'Benches', count: gameBenches.length },
		{ id: 'recipes', label: 'Recipes', count: gameRecipes.filter((r) => r.outputs.length > 0).length },
		{ id: 'missing', label: 'Missing', count: 0 },
		{ id: 'cleanup', label: 'Cleanup', count: 0 },
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
					attributeKeys={gameAttrKeys}
					onChanged={refreshAll}
					showToast={showToast}
				/>
			)}
			{tab === 'benches' && selectedGameId && (
				<BenchesTab
					gameId={selectedGameId}
					benches={gameBenches}
					items={gameItems}
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
					attributeKeys={gameAttrKeys}
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
					attributeKeys={gameAttrKeys}
					onChanged={refreshAll}
					showToast={showToast}
				/>
			)}
			{tab === 'cleanup' && selectedGameId && (
				<CleanupTab
					items={gameItems}
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
	const [attrKeys, setAttrKeys] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const [editLink, setEditLink] = useState('')
	const [editAttrKeys, setEditAttrKeys] = useState('')
	const [confirmId, setConfirmId] = useState<string | null>(null)

	const parseKeys = (s: string): string[] =>
		s.split(',').map((k) => k.trim()).filter(Boolean)

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		try {
			await api.games.create({ name: name.trim(), link: link.trim() || undefined, attributeKeys: parseKeys(attrKeys) })
			showToast('success', `Game "${name.trim()}" created`)
			setName('')
			setLink('')
			setAttrKeys('')
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
		setEditAttrKeys((g.attributeKeys ?? []).join(', '))
		setConfirmId(null)
	}

	const handleSave = async (id: string) => {
		try {
			await api.games.update(id, { name: editName.trim(), link: editLink.trim() || undefined, attributeKeys: parseKeys(editAttrKeys) })
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
						<input className={inputCls} value={attrKeys} onChange={(e) => setAttrKeys(e.target.value)} placeholder="Default attribute keys (comma-separated, e.g. value, rarity)" />
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
										</div>									<input className={inputCls} value={editAttrKeys} onChange={(e) => setEditAttrKeys(e.target.value)} placeholder="Default attribute keys (comma-separated)" />										<div className="flex gap-2">
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
											)}										{g.attributeKeys && g.attributeKeys.length > 0 && (
											<span className="ml-2 text-xs text-gray-400">keys: {g.attributeKeys.join(', ')}</span>
										)}										</div>
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
	attributeKeys,
	onChanged,
	showToast,
}: {
	gameId: string
	items: Item[]
	attributeKeys: string[]
	onChanged: () => void
	showToast: (type: ToastType, message: string) => void
}) {
	const [name, setName] = useState('')
	const [category, setCategory] = useState('')
	const [attrRows, setAttrRows] = useState<AttrRow[]>(keysToRows(attributeKeys))
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const [editCategory, setEditCategory] = useState('')
	const [editAttrRows, setEditAttrRows] = useState<AttrRow[]>([{ key: '', value: '' }])
	const [confirmId, setConfirmId] = useState<string | null>(null)
	const { expandedIds, toggleExpand } = useExpanded()
	const nameRef = useRef<HTMLInputElement>(null)
	const sortedItems = [...items].sort((a, b) => {
		const ca = a.category ?? '~'
		const cb = b.category ?? '~'
		if (ca !== cb) return ca.localeCompare(cb)
		return (a.name ?? '').localeCompare(b.name ?? '')
	})

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		try {
			await api.items.create({ name: name.trim(), attributes: rowsToAttrs(attrRows), category: category.trim() || null, gameId })
			showToast('success', `Item "${name.trim()}" created`)
			setName('')
			setCategory('')
			setAttrRows(keysToRows(attributeKeys))
			onChanged()
			nameRef.current?.focus()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to create item')
		}
	}

	const startEdit = (it: Item) => {
		setEditingId(it.id)
		setEditName(it.name ?? '')
		setEditCategory(it.category ?? '')
		setEditAttrRows(attrsToRows(it.attributes))
		setConfirmId(null)
	}

	const handleSave = async (id: string) => {
		try {
			await api.items.update(id, { name: editName.trim(), attributes: rowsToAttrs(editAttrRows), category: editCategory.trim() || null })
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
				<form onSubmit={handleAdd} className="space-y-2">
					<NewItemFields
						ref={nameRef}
						name={name}
						setName={setName}
						category={category}
						setCategory={setCategory}
						attrRows={attrRows}
						setAttrRows={setAttrRows}
						autoFocus
						existingNames={items.map((it) => it.name).filter((n): n is string => n !== null)}
						categories={[...new Set(items.map((it) => it.category).filter((c): c is string => c !== null))].sort().map((c) => ({ value: c, label: c }))}
					/>
					<div className="flex gap-2">
						<button type="submit" className={btnPrimary}>Create</button>
					</div>
				</form>
			</SectionCard>

			<SectionCard title="Items" count={items.length}>
				{items.length === 0 ? (
					<EmptyState message="No items yet. Create one above." />
				) : (
					<div className="space-y-1">
						{sortedItems.map((it) => (
							<div key={it.id} className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
								{editingId === it.id ? (
									<div className="space-y-2">
										<input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
									<input className={inputCls} value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Category (optional)" />
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
									<ExpandableRow
										isExpanded={expandedIds.has(it.id)}
										onToggle={() => toggleExpand(it.id)}
										summary={
											<span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
												<span className="inline-block w-40 truncate align-bottom">{it.name ?? it.id}</span>
												{it.category && (
													<span className="ml-2 inline-block align-bottom text-xs text-gray-400">
														<span className="inline-block w-20 font-medium">Category:</span>
														<span className="inline-block w-28 truncate align-bottom">{it.category}</span>
													</span>
												)}
												{it.attributes && Object.keys(it.attributes).length > 0 && (
													<span className="ml-2 inline-block align-bottom text-xs text-gray-400">
														<span className="inline-block w-20 font-medium">Attributes:</span>
														<span className="inline-block truncate align-bottom">{Object.entries(it.attributes).map(([k, v]) => `${k}${Array.isArray(v) ? ` (${v.length})` : ''}`).join(', ')}</span>
													</span>
												)}
											</span>
										}
										details={
											<div className="space-y-1">
												{it.attributes && Object.keys(it.attributes).length > 0 ? (
													Object.entries(it.attributes).map(([k, v]) => (
														<div key={k} className="flex gap-2">
															<span className="font-medium text-gray-500 dark:text-gray-500">{k}:</span>
															<span>{Array.isArray(v) ? v.join(', ') : String(v)}</span>
														</div>
													))
												) : (
													<span className="text-xs text-gray-400">No attributes</span>
												)}
											</div>
										}
										actions={
											<>
												<button onClick={() => startEdit(it)} className={`${btnGhost} opacity-0 group-hover:opacity-100`}>Edit</button>
												<button onClick={() => setConfirmId(it.id)} className={`${btnDanger} opacity-0 group-hover:opacity-100`}>🗑</button>
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

// ─── Benches Tab ──────────────────────────────────────────

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
	showToast: (type: ToastType, message: string) => void
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

// ─── Recipes Tab ──────────────────────────────────────────

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
}: {
	arr: SlotRow[]
	setArr: (a: SlotRow[]) => void
	label: string
	items: Item[]
	attributeKeys: string[]
}) {
	return (
		<div>
			<span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
			<div className="space-y-1">
				{arr.map((row, idx) => (
					<div key={idx} className="space-y-1 rounded-md border border-gray-100 dark:border-gray-800 p-1">
						<div className="flex gap-1">
							<button
								type="button"
								className={`rounded px-2 py-1 text-xs font-medium ${!row.isNew ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
								onClick={() => updateSlot(arr, setArr, idx, { isNew: false })}
							>Existing</button>
							<button
								type="button"
								className={`rounded px-2 py-1 text-xs font-medium ${row.isNew ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
								onClick={() => updateSlot(arr, setArr, idx, { isNew: true, item: '', newName: row.newName ?? '', newAttrRows: row.newAttrRows ?? keysToRows(attributeKeys) })}
							>New</button>
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
						{row.isNew ? (
							<NewItemFields
								name={row.newName ?? ''}
								setName={(s) => updateSlot(arr, setArr, idx, { newName: s })}
								category={row.newCategory ?? ''}
								setCategory={(s) => updateSlot(arr, setArr, idx, { newCategory: s })}
								attrRows={row.newAttrRows ?? keysToRows(attributeKeys)}
								setAttrRows={(r) => updateSlot(arr, setArr, idx, { newAttrRows: r })}
							existingNames={items.map((it) => it.name).filter((n): n is string => n !== null)}
							categories={[...new Set(items.map((it) => it.category).filter((c): c is string => c !== null))].sort().map((c) => ({ value: c, label: c }))}
						/>
					) : (
							<Combobox
								className={inputCls}
								value={row.item}
								onChange={(v) => updateSlot(arr, setArr, idx, { item: v })}
								options={items.map((it) => ({ value: it.id, label: it.name ?? it.id }))}
								placeholder="Search item..."
							/>
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

	const slotToRow = (s: RecipeSlot): SlotRow => ({ item: s.item, count: String(s.count) })

	const resolveSlots = async (rows: SlotRow[]): Promise<RecipeSlot[] | null> => {
		const slots: RecipeSlot[] = []
		for (const row of rows) {
			if (row.isNew) {
				if (!row.newName?.trim()) continue
				try {
					const created = await api.items.create({
						gameId,
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
		const resolvedInputs = await resolveSlots(inputs)
		const resolvedOutputs = await resolveSlots(outputs)
		if (resolvedInputs === null || resolvedOutputs === null) return
		if (resolvedInputs.length === 0 || resolvedOutputs.length === 0) {
			showToast('error', 'Recipe needs at least one input and one output')
			return
		}
		try {
			await api.recipes.create({
				gameId,
				benchId,
				inputs: resolvedInputs,
				outputs: resolvedOutputs,
			})
			showToast('success', 'Recipe created')
			setBenchId('')
			setInputs([{ item: '', count: '1' }])
			setOutputs([{ item: '', count: '1' }])
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
		if (!editBenchId) { showToast('error', 'Please select a bench'); return }
		const resolvedInputs = await resolveSlots(editInputs)
		const resolvedOutputs = await resolveSlots(editOutputs)
		if (resolvedInputs === null || resolvedOutputs === null) return
		if (resolvedInputs.length === 0 || resolvedOutputs.length === 0) {
			showToast('error', 'Recipe needs at least one input and one output')
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
	const visibleRecipes = showNullRecipes ? recipes : recipes.filter((r) => r.outputs.length > 0)
	const sortedRecipes = [...visibleRecipes].sort((a, b) => {
		const catOf = (r: Recipe) => {
			const firstOut = r.outputs[0]
			if (!firstOut) return '~'
			return items.find((it) => it.id === firstOut.item)?.category ?? '~'
		}
		const ca = catOf(a) ?? '~'
		const cb = catOf(b) ?? '~'
		if (ca !== cb) return ca.localeCompare(cb)
		return recipeLabel(a).localeCompare(recipeLabel(b))
	})

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
							onChange={setBenchId}
							options={benches.map((b) => ({ value: b.id, label: b.name ?? b.id }))}
							placeholder="Search bench..."
						/>
						<SlotEditor arr={inputs} setArr={setInputs} label="Inputs" items={items} attributeKeys={attributeKeys} />
						<SlotEditor arr={outputs} setArr={setOutputs} label="Outputs" items={items} attributeKeys={attributeKeys} />
						<button type="submit" className={btnPrimary}>Create</button>
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
										onChange={setEditBenchId}
										options={benches.map((b) => ({ value: b.id, label: b.name ?? b.id }))}
										placeholder="Search bench..."
									/>
<SlotEditor arr={editInputs} setArr={setEditInputs} label="Inputs" items={items} attributeKeys={attributeKeys} />
					<SlotEditor arr={editOutputs} setArr={setEditOutputs} label="Outputs" items={items} attributeKeys={attributeKeys} />

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
														<span className="inline-block truncate align-bottom">{r.outputs.map((o) => `${o.itemName ?? items.find((it) => it.id === o.item)?.name ?? '?'}×${o.count}`).join(', ')}</span>
													</span>
												)}
											</span>
										}
										details={
											<div className="space-y-2">
												<div>
													<span className="font-medium text-gray-500 dark:text-gray-500">Bench: </span>
													{benches.find((b) => b.id === r.benchId)?.name ?? '?'}
												</div>
												<div>
													<span className="font-medium text-gray-500 dark:text-gray-500">Inputs:</span>
													<div className="ml-4">
														{r.inputs.map((i, idx) => (
															<div key={idx}>{i.itemName ?? items.find((it) => it.id === i.item)?.name ?? '?'} ×{i.count}</div>
														))}
													</div>
												</div>
												<div>
													<span className="font-medium text-gray-500 dark:text-gray-500">Outputs:</span>
													<div className="ml-4">
														{r.outputs.map((o, idx) => (
															<div key={idx}>{o.itemName ?? items.find((it) => it.id === o.item)?.name ?? '?'} ×{o.count}</div>
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
		</div>
	)
}
