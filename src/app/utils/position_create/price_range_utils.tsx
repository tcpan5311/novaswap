import { Dispatch, SetStateAction } from "react"

const BUFFER_PERCENTAGE = 0.01
const PRICE_STEP_PERCENTAGE = 0.01

type SetPrice = (price: number) => void
type SetInput = (input: string) => void

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const calculateDynamicBuffer = (minPrice: number, maxPrice: number) => (maxPrice - minPrice) * BUFFER_PERCENTAGE

export const handlePriceMove = async (event: MouseEvent, chartRef: React.RefObject<HTMLDivElement | null>, minPriceAllowed: number, maxPriceAllowed: number, setPrice: SetPrice, setPriceInput: SetInput) => 
{
    if (!chartRef.current) return

    const rect = chartRef.current.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const chartHeight = rect.height

    let newPrice = maxPriceAllowed - ((offsetY / chartHeight) * (maxPriceAllowed - minPriceAllowed))
    const dynamicBuffer = calculateDynamicBuffer(minPriceAllowed, maxPriceAllowed)

    newPrice = clamp(newPrice, minPriceAllowed, maxPriceAllowed - dynamicBuffer)
    setPrice(newPrice)
    setPriceInput(newPrice.toFixed(18))
}

export const handleMouseUp = (setDraggingType: (type: "min" | "max" | null) => void, handlePriceMoveFns: Array<(event: MouseEvent) => Promise<void>>) => 
{
    setDraggingType(null)
    handlePriceMoveFns.forEach(fn => document.removeEventListener("mousemove", fn as any))
    document.removeEventListener("mouseup", handleMouseUp as any)
}

export const handleClampedPrice = async (type: "min" | "max", currentPoolPrice: number, otherPrice: number, setPrice: Dispatch<SetStateAction<number>>, setPriceInput?: Dispatch<SetStateAction<string>>): Promise<number> => 
{
    const BUFFER_PERCENTAGE = 0.05
    let clamped: number

    setPrice((prev) => 
    {
        if (type === "min") 
        {
            const minAllowed = currentPoolPrice * 0.85
            const buffer = (otherPrice - minAllowed) * BUFFER_PERCENTAGE
            const maxLimit = otherPrice - buffer
            clamped = Math.max(Math.min(prev, maxLimit), minAllowed)
        } 
        else 
        {
            const maxAllowed = currentPoolPrice * 1.15
            const buffer = (maxAllowed - otherPrice) * BUFFER_PERCENTAGE
            const minLimit = otherPrice + buffer
            clamped = Math.min(Math.max(prev, minLimit), maxAllowed)
        }

        if (setPriceInput) 
        {
            setPriceInput(clamped.toFixed(18))
        }

        return clamped
    })

    return clamped!
}

export const handlePriceClick = (direction: "increase" | "decrease", currentPrice: number, minPrice: number, maxPrice: number, setPrice: Dispatch<SetStateAction<number>>, setPriceInput: Dispatch<SetStateAction<string>>) => 
{
    const step = (prev: number) => 
    {
        const step = prev * PRICE_STEP_PERCENTAGE
        let newPrice = direction === "increase" ? prev + step : prev - step
        const minAllowed = currentPrice * 0.75
        const maxAllowed = currentPrice * 1.25
        const dynamicBuffer = calculateDynamicBuffer(minPrice, maxPrice)
        newPrice = clamp(newPrice, minAllowed, maxAllowed - dynamicBuffer)
        setPriceInput(newPrice.toFixed(18))
        return newPrice
    }

    setPrice(step)
}
