export type AttributeValue = string | string[]
export type Attributes = Record<string, AttributeValue>

export interface Game {
	id: string
	name: string | null
	link: string | null
	attributeKeys: string[]
}

export interface Item {
	id: string
	name: string | null
	attributes: Attributes
	category: string | null
	gameId: string
}

export interface BenchInput {
	category: string | null
	required: boolean
}

export interface Bench {
	id: string
	name: string | null
	inputs: BenchInput[]
	gameId: string
}

export interface RecipeSlot {
	item: string
	itemName?: string | null
	count: number
}

export interface Recipe {
	id: string
	gameId: string
	benchId: string
	benchName?: string | null
	inputs: RecipeSlot[]
	outputs: RecipeSlot[]
}

export type Entity = Game | Item | Bench | Recipe
