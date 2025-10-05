import { Dispatch, SetStateAction } from "react"
const BUFFER_PERCENTAGE = 0.01
const PRICE_STEP_PERCENTAGE = 0.01

export const handleMinPriceMove = async (event: MouseEvent, chartRef: React.RefObject<HTMLDivElement | null>, maxPrice: number, graphMaxPrice: number, graphMinPrice: number, currentPoolPrice: number, setMinPrice: (price: number) => void, setMinPriceInput: (input: string) => void) => 
{
    if (!chartRef.current) return

    const rect = chartRef.current.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const chartHeight = rect.height

    const minAllowedPrice = currentPoolPrice * 0.75
    const dynamicBuffer = (maxPrice - minAllowedPrice) * BUFFER_PERCENTAGE

    let newMinPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))

    if (newMinPrice > maxPrice - dynamicBuffer) 
    {
        newMinPrice = maxPrice - dynamicBuffer
    } 
    else if (newMinPrice < minAllowedPrice) 
    {
        newMinPrice = minAllowedPrice
    }

    setMinPrice(newMinPrice)
    setMinPriceInput(newMinPrice.toFixed(18))
}

export const handleMaxPriceMove = async (event: MouseEvent, chartRef: React.RefObject<HTMLDivElement | null>, minPrice: number, graphMaxPrice: number, graphMinPrice: number, currentPoolPrice: number, setMaxPrice: (price: number) => void, setMaxPriceInput: (input: string) => void) => 
{
    if (!chartRef.current) return

    const rect = chartRef.current.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const chartHeight = rect.height

    const maxAllowedPrice = currentPoolPrice * 1.25
    const dynamicBuffer = (maxAllowedPrice - minPrice) * BUFFER_PERCENTAGE

    let newMaxPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))

    if (newMaxPrice < minPrice + dynamicBuffer) 
    {
        newMaxPrice = minPrice + dynamicBuffer
    } 
    else if (newMaxPrice > maxAllowedPrice) 
    {
        newMaxPrice = maxAllowedPrice
    }

    setMaxPrice(newMaxPrice)
    setMaxPriceInput(newMaxPrice.toFixed(18))
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
    const minAllowed = currentPoolPrice * 0.85
    const buffer = (maxPrice - minAllowed) * BUFFER_PERCENTAGE
    const maxLimit = maxPrice - buffer

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
    const maxAllowed = currentPoolPrice * 1.15
    const buffer = (maxAllowed - minPrice) * BUFFER_PERCENTAGE
    const minLimit = minPrice + buffer

    let clamped: number
    setMaxPrice((prev) => 
    {
        clamped = Math.min(Math.max(prev, minLimit), maxAllowed)
        return clamped
    })

    return clamped!
}

export const handleMinClick = (direction: "increase" | "decrease", currentPoolPrice: number, maxPrice: number, setMinPrice: Dispatch<SetStateAction<number>>, setMinPriceInput: Dispatch<SetStateAction<string>>) => 
{
    const minAllowedPrice = currentPoolPrice * 0.75
    const dynamicBuffer = (maxPrice - minAllowedPrice) * BUFFER_PERCENTAGE

    setMinPrice((prev) => 
    {
        const step = prev * PRICE_STEP_PERCENTAGE
        let newPrice = direction === "increase" ? prev + step : prev - step

        if (newPrice > maxPrice - dynamicBuffer) 
        {
            newPrice = maxPrice - dynamicBuffer
        } 
        else if (newPrice < minAllowedPrice) 
        {
            newPrice = minAllowedPrice
        }

        setMinPriceInput(newPrice.toFixed(18))
        return newPrice
    })
}

export const handleMaxClick = (direction: "increase" | "decrease", currentPoolPrice: number, minPrice: number, setMaxPrice: Dispatch<SetStateAction<number>>, setMaxPriceInput: Dispatch<SetStateAction<string>>) => 
{
    const maxAllowedPrice = currentPoolPrice * 1.25
    const dynamicBuffer = (maxAllowedPrice - minPrice) * BUFFER_PERCENTAGE

    setMaxPrice((prev) => 
    {
        const step = prev * PRICE_STEP_PERCENTAGE
        let newPrice = direction === "increase" ? prev + step : prev - step

        if (newPrice < minPrice + dynamicBuffer) 
        {
            newPrice = minPrice + dynamicBuffer
        } 
        else if (newPrice > maxAllowedPrice) 
        {
            newPrice = maxAllowedPrice
        }

        setMaxPriceInput(newPrice.toFixed(18))
        return newPrice
    })
}


