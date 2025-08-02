"use client"
import { createContext, useContext, useState } from "react"

export type PositionContextType = 
{
    selectedPosition: any | null,
    setSelectedPosition: (position: any) => void
}

const SelectedPositionContext = createContext<PositionContextType | undefined>(undefined)

export const SelectedPositionProvider = ({ children }: { children: React.ReactNode }) => 
{
    const [selectedPosition, setSelectedPosition] = useState<any | null>(null)

    return (
    <SelectedPositionContext.Provider value={{ selectedPosition, setSelectedPosition }}>
        {children}
    </SelectedPositionContext.Provider>
    )
}

export const UseSelectedPosition = () => 
{
    const context = useContext(SelectedPositionContext)
    if (!context) 
    {
        throw new Error("useSelectedPosition must be used within a SelectedPositionProvider")
    }
    return context
}
