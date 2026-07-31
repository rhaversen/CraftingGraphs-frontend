'use client'

import { useSearchParams } from 'next/navigation'
import { useGameData } from '../../components/GameDataProvider'
import { MissingRecipesTab } from '../../components/MissingRecipes'
import { useToast, Toasts, EmptyState } from '../_shared'

export default function MissingPage() {
	const { items, benches, recipes, games, refreshAll } = useGameData()
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
	const gameRecipes = recipes.filter((r) => r.gameId === selectedGameId)
	const selectedGame = games.find((g) => g.id === selectedGameId)
	const gameAttrKeys = selectedGame?.attributeKeys ?? []

	return (
		<>
			<MissingRecipesTab
				gameId={selectedGameId}
				items={gameItems}
				benches={gameBenches}
				recipes={gameRecipes}
				attributeKeys={gameAttrKeys}
				onChanged={refreshAll}
				showToast={showToast}
			/>
			<Toasts toasts={toasts} />
		</>
	)
}
