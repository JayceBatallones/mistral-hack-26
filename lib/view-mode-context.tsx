"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type ViewMode = "visualisation" | "markdown"

interface ViewModeContextValue {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  hasMarkdown: boolean
  setHasMarkdown: (v: boolean) => void
}

const ViewModeContext = createContext<ViewModeContextValue>({
  viewMode: "visualisation",
  setViewMode: () => {},
  hasMarkdown: false,
  setHasMarkdown: () => {},
})

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>("visualisation")
  const [hasMarkdown, setHasMarkdown] = useState(false)

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, hasMarkdown, setHasMarkdown }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode() {
  return useContext(ViewModeContext)
}
