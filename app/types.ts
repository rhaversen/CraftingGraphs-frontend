export type AttributeValue = string | string[]
export type Attributes = Record<string, AttributeValue>

export interface Game {
	id: string
	name: string | null
	link: string | null
}

export interface Item {
	id: string
	name: string | null
	attributes: Attributes
	gameId: string
}

export interface Bench {
	id: string
	name: string | null
	inputCount: number | null
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
