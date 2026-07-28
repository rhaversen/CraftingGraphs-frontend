import type { Attributes, Bench, Game, Item, Recipe } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {}),
		},
	})
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: unknown } | null
		const message = body?.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`
		throw new Error(message)
	}
	if (res.status === 204) return undefined as T
	return (await res.json()) as T
}

function buildQuery(params: Record<string, string | undefined>): string {
	const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][]
	if (entries.length === 0) return ''
	return `?${new URLSearchParams(entries).toString()}`
}

export const api = {
	games: {
		list: () => request<Game[]>('/api/v1/games'),
		get: (id: string) => request<Game>(`/api/v1/games/${id}`),
		create: (data: { name: string | null; link?: string | null; attributeKeys?: string[] }) =>
			request<Game>('/api/v1/games', { method: 'POST', body: JSON.stringify(data) }),
		update: (id: string, data: Partial<Pick<Game, 'name' | 'link' | 'attributeKeys'>>) =>
			request<Game>(`/api/v1/games/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
		delete: (id: string) =>
			request<void>(`/api/v1/games/${id}`, { method: 'DELETE' }),
	},
	items: {
		list: (gameId?: string) =>
			request<Item[]>(`/api/v1/items${buildQuery({ gameId })}`),
		get: (id: string) => request<Item>(`/api/v1/items/${id}`),
		create: (data: { name: string | null; attributes?: Attributes; gameId: string }) =>
			request<Item>('/api/v1/items', { method: 'POST', body: JSON.stringify(data) }),
		update: (
			id: string,
			data: Partial<Pick<Item, 'name' | 'attributes' | 'gameId'>>,
		) =>
			request<Item>(`/api/v1/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
		delete: (id: string) =>
			request<void>(`/api/v1/items/${id}`, { method: 'DELETE' }),
	},
	benches: {
		list: (gameId?: string) =>
			request<Bench[]>(`/api/v1/benches${buildQuery({ gameId })}`),
		get: (id: string) => request<Bench>(`/api/v1/benches/${id}`),
		create: (data: { name: string | null; inputCount?: number | null; gameId: string }) =>
			request<Bench>('/api/v1/benches', { method: 'POST', body: JSON.stringify(data) }),
		update: (id: string, data: Partial<Pick<Bench, 'name' | 'inputCount' | 'gameId'>>) =>
			request<Bench>(`/api/v1/benches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
		delete: (id: string) =>
			request<void>(`/api/v1/benches/${id}`, { method: 'DELETE' }),
	},
	recipes: {
		list: (gameId?: string, benchId?: string) =>
			request<Recipe[]>(
				`/api/v1/recipes${buildQuery({ gameId, benchId })}`,
			),
		get: (id: string) => request<Recipe>(`/api/v1/recipes/${id}`),
		create: (data: {
			gameId: string
			benchId: string
			inputs: { item: string; count: number }[]
			outputs: { item: string; count: number }[]
		}) =>
			request<Recipe>('/api/v1/recipes', { method: 'POST', body: JSON.stringify(data) }),
		update: (
			id: string,
			data: Partial<{
				gameId: string
				benchId: string
				inputs: { item: string; count: number }[]
				outputs: { item: string; count: number }[]
			}>,
		) =>
			request<Recipe>(`/api/v1/recipes/${id}`, {
				method: 'PUT',
				body: JSON.stringify(data),
			}),
		delete: (id: string) =>
			request<void>(`/api/v1/recipes/${id}`, { method: 'DELETE' }),
	},
}
