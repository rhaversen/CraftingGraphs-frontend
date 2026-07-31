import { redirect } from 'next/navigation'

interface PageProps {
	searchParams?: Promise<{ game?: string }>
}

export default async function ManagePage({ searchParams }: PageProps) {
	const params = await searchParams
	const game = params?.game
	const target = game ? `/manage/games?game=${encodeURIComponent(game)}` : '/manage/games'
	redirect(target)
}
