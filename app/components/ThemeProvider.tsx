'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
	theme: Theme
	toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
	const ctx = useContext(ThemeContext)
	if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
	return ctx
}

const THEME_EVENT = 'themechange'

function subscribe(callback: () => void) {
	window.addEventListener(THEME_EVENT, callback)
	const media = window.matchMedia('(prefers-color-scheme: dark)')
	media.addEventListener('change', callback)
	return () => {
		window.removeEventListener(THEME_EVENT, callback)
		media.removeEventListener('change', callback)
	}
}

function getClientSnapshot(): Theme {
	const stored = localStorage.getItem('theme') as Theme | null
	if (stored === 'light' || stored === 'dark') return stored
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getServerSnapshot(): Theme {
	return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const theme = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

	useEffect(() => {
		const root = document.documentElement
		if (theme === 'dark') root.classList.add('dark')
		else root.classList.remove('dark')
	}, [theme])

	const toggleTheme = useCallback(() => {
		const current = getClientSnapshot()
		localStorage.setItem('theme', current === 'dark' ? 'light' : 'dark')
		window.dispatchEvent(new Event(THEME_EVENT))
	}, [])

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	)
}
