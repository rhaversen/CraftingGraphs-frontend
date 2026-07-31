'use client'

import { useSearchParams } from 'next/navigation'
import { useGameData } from '../../components/GameDataProvider'
import { CleanupTab } from '../../components/CleanupTab'
import { useToast, Toasts, EmptyState } from '../_shared'

export default function CleanupPage() {
	const { items, refreshAll } = useGameData()
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

	return (
		<>
			<CleanupTab items={gameItems} onChanged={refreshAll} showToast={showToast} />
			<Toasts toasts={toasts} />
		</>
	)
}
