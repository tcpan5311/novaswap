import { Dispatch, SetStateAction } from "react"

export const handleMinPriceMove = async (event: MouseEvent, chartRef: React.RefObject<HTMLDivElement | null>, maxPrice: number, graphMaxPrice: number, graphMinPrice: number, currentPoolPrice: number, setMinPrice: (price: number) => void, setMinPriceInput: (input: string) => void) => 
{
    if (!chartRef.current) return

    const rect = chartRef.current.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const chartHeight = rect.height

    const minAllowedPrice = currentPoolPrice * 0.75

    let newMinPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))

    if (newMinPrice > maxPrice - 10) 
    {
        newMinPrice = maxPrice - 10
    } 
    else if (newMinPrice < minAllowedPrice) 
    {
        newMinPrice = minAllowedPrice
    }

    setMinPrice(newMinPrice)
    setMinPriceInput(newMinPrice.toFixed(4))
}

export const handleMaxPriceMove = async (event: MouseEvent, chartRef: React.RefObject<HTMLDivElement | null>, minPrice: number, graphMaxPrice: number, graphMinPrice: number, currentPoolPrice: number, setMaxPrice: (price: number) => void, setMaxPriceInput: (input: string) => void) => 
{
    if (!chartRef.current) return

    const rect = chartRef.current.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const chartHeight = rect.height

    const maxAllowedPrice = currentPoolPrice * 1.25

    let newMaxPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))

    if (newMaxPrice < minPrice + 10) 
    {
        newMaxPrice = minPrice + 10
    } 
    else if (newMaxPrice > maxAllowedPrice) 
    {
        newMaxPrice = maxAllowedPrice
    }

    setMaxPrice(newMaxPrice)
    setMaxPriceInput(newMaxPrice.toFixed(4))
}


export const handleMouseUp = (setDraggingType: (type: "min" | "max" | null) => void, handleMaxPriceMove: (event: MouseEvent) => Promise<void>, handleMinPriceMove: (event: MouseEvent) => Promise<void>) => 
{
    setDraggingType(null)
    document.removeEventListener("mousemove", handleMaxPriceMove as any)
    document.removeEventListener("mousemove", handleMinPriceMove as any)
    document.removeEventListener("mouseup", handleMouseUp as any)
}

export const handleMinPrice = async (currentPoolPrice: number, maxPrice: number, setMinPrice: Dispatch<SetStateAction<number>>): Promise<number> => 
{
    const minAllowed = currentPoolPrice * 0.75
    const maxLimit = maxPrice - 10

    let clamped: number
    setMinPrice((prev) => 
    {
        clamped = Math.max(Math.min(prev, maxLimit), minAllowed)
        return clamped
    })

    return clamped!
}

export const handleMaxPrice = async (currentPoolPrice: number, minPrice: number, setMaxPrice: Dispatch<SetStateAction<number>>): Promise<number> => 
{
    const maxAllowed = currentPoolPrice * 1.25
    const minLimit = minPrice + 10

    let clamped: number
    setMaxPrice((prev) => 
    {
        clamped = Math.min(Math.max(prev, minLimit), maxAllowed)
        return clamped
    })

    return clamped!
}
