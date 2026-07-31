'use client'

import { useState } from 'react'
import { useGameData } from '../../components/GameDataProvider'
import { api } from '../../api'
import type { Game } from '../../types'
import { useToast, Toasts, SectionCard, EmptyState, inputCls, btnPrimary, btnGhost, btnDanger } from '../_shared'

function parseKeys(s: string): string[] {
	return s.split(',').map((k) => k.trim()).filter(Boolean)
}

export default function GamesPage() {
	const { games, refreshAll } = useGameData()
	const { showToast, toasts } = useToast()

	const [showAdd, setShowAdd] = useState(false)
	const [name, setName] = useState('')
	const [link, setLink] = useState('')
	const [attrKeys, setAttrKeys] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const [editLink, setEditLink] = useState('')
	const [editAttrKeys, setEditAttrKeys] = useState('')
	const [confirmId, setConfirmId] = useState<string | null>(null)

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
			refreshAll()
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
			refreshAll()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to update game')
		}
	}

	const handleDelete = async (id: string, name: string) => {
		try {
			await api.games.delete(id)
			showToast('success', `Game "${name}" deleted`)
			setConfirmId(null)
			refreshAll()
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
										</div>
										<input className={inputCls} value={editAttrKeys} onChange={(e) => setEditAttrKeys(e.target.value)} placeholder="Default attribute keys (comma-separated)" />
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
											{g.attributeKeys && g.attributeKeys.length > 0 && (
												<span className="ml-2 text-xs text-gray-400">keys: {g.attributeKeys.join(', ')}</span>
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

			<Toasts toasts={toasts} />
		</div>
	)
}
