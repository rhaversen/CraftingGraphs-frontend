'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'
import type { Bench, Game, Item, Recipe } from '../types'

interface GameDataContextValue {
	games: Game[]
	items: Item[]
	benches: Bench[]
	recipes: Recipe[]
	loading: boolean
	error: string | null
	refreshing: boolean
	refreshAll: () => Promise<void>
	clearError: () => void
}

const GameDataContext = createContext<GameDataContextValue | null>(null)

export function GameDataProvider({ children }: { children: ReactNode }) {
	const [games, setGames] = useState<Game[]>([])
	const [items, setItems] = useState<Item[]>([])
	const [benches, setBenches] = useState<Bench[]>([])
	const [recipes, setRecipes] = useState<Recipe[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState(false)

	const refreshAll = useCallback(async () => {
		setRefreshing(true)
		try {
			const [g, i, b, r] = await Promise.all([
				api.games.list(),
				api.items.list(),
				api.benches.list(),
				api.recipes.list(),
			])
			setGames(g)
			setItems(i)
			setBenches(b)
			setRecipes(r)
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load data')
		} finally {
			setLoading(false)
			setRefreshing(false)
		}
	}, [])

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
		refreshAll()
	}, [refreshAll])

	const value = useMemo<GameDataContextValue>(
		() => ({
			games,
			items,
			benches,
			recipes,
			loading,
			error,
			refreshing,
			refreshAll,
			clearError: () => setError(null),
		}),
		[games, items, benches, recipes, loading, error, refreshing, refreshAll],
	)

	return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>
}

export function useGameData() {
	const ctx = useContext(GameDataContext)
	if (!ctx) throw new Error('useGameData must be used within GameDataProvider')
	return ctx
}
