import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from './components/ThemeProvider'
import { GameDataProvider } from './components/GameDataProvider'
import NavBar from './components/NavBar'

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
})

export const metadata: Metadata = {
	title: 'CraftingGraphs',
	description: 'A collection of crafting graphs from computer games',
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				<ThemeProvider>
					<GameDataProvider>
						<NavBar />
						<div className="flex flex-1 flex-col">{children}</div>
					</GameDataProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
