'use client'

import { useMemo, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGameData } from '../../components/GameDataProvider'
import { api } from '../../api'
import type { Item } from '../../types'
import { AttributeEditor, type AttrRow, attrsToRows, keysToRows, rowsToAttrs } from '../../components/AttributeEditor'
import { NewItemFields } from '../../components/NewItemFields'
import { ExpandableRow, useExpanded } from '../../components/ExpandableRow'
import { useToast, Toasts, SectionCard, EmptyState, inputCls, btnPrimary, btnGhost, btnDanger } from '../_shared'

export default function ItemsPage() {
	const { items, games, refreshAll } = useGameData()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')
	const { showToast, toasts } = useToast()

	const gameItems = useMemo(() => items.filter((i) => i.gameId === selectedGameId), [items, selectedGameId])
	const gameAttrKeys = useMemo(
		() => games.find((g) => g.id === selectedGameId)?.attributeKeys ?? [],
		[games, selectedGameId],
	)

	const [name, setName] = useState('')
	const [category, setCategory] = useState('')
	const [attrRows, setAttrRows] = useState<AttrRow[]>(keysToRows(gameAttrKeys))
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const [editCategory, setEditCategory] = useState('')
	const [editAttrRows, setEditAttrRows] = useState<AttrRow[]>([{ key: '', value: '' }])
	const [confirmId, setConfirmId] = useState<string | null>(null)
	const { expandedIds, toggleExpand } = useExpanded()
	const nameRef = useRef<HTMLInputElement>(null)

	const sortedItems = useMemo(
		() =>
			[...gameItems].sort((a, b) => {
				const ca = a.category ?? '~'
				const cb = b.category ?? '~'
				if (ca !== cb) return ca.localeCompare(cb)
				return (a.name ?? '').localeCompare(b.name ?? '')
			}),
		[gameItems],
	)

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim() || !selectedGameId) return
		try {
			await api.items.create({ name: name.trim(), attributes: rowsToAttrs(attrRows), category: category.trim() || null, gameId: selectedGameId })
			showToast('success', `Item "${name.trim()}" created`)
			setName('')
			setCategory('')
			setAttrRows(keysToRows(gameAttrKeys))
			refreshAll()
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
			refreshAll()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to update item')
		}
	}

	const handleDelete = async (id: string, name: string) => {
		try {
			await api.items.delete(id)
			showToast('success', `Item "${name}" deleted`)
			setConfirmId(null)
			refreshAll()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to delete item')
		}
	}

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
						existingNames={gameItems.map((it) => it.name).filter((n): n is string => n !== null)}
						categories={[...new Set(gameItems.map((it) => it.category).filter((c): c is string => c !== null))].sort().map((c) => ({ value: c, label: c }))}
					/>
					<div className="flex gap-2">
						<button type="submit" className={btnPrimary}>Create</button>
					</div>
				</form>
			</SectionCard>

			<SectionCard title="Items" count={gameItems.length}>
				{gameItems.length === 0 ? (
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

			<Toasts toasts={toasts} />
		</div>
	)
}
