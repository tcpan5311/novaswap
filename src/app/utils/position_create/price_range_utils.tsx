
export const handleMinPriceMove = async (event: MouseEvent, chartRef: React.RefObject<HTMLDivElement | null>, maxPrice: number, graphMaxPrice: number, graphMinPrice: number, currentPoolPrice: number, setMinPrice: (price: number) => void) => 
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
}

export const handleMaxPriceMove = async (event: MouseEvent, chartRef: React.RefObject<HTMLDivElement | null>, minPrice: number, graphMaxPrice: number, graphMinPrice: number, currentPoolPrice: number, setMaxPrice: (price: number) => void) => 
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
}

export const handleMouseUp = (setDraggingType: (type: "min" | "max" | null) => void, handleMaxPriceMove: (event: MouseEvent) => Promise<void>, handleMinPriceMove: (event: MouseEvent) => Promise<void>) => 
{
    setDraggingType(null)
    document.removeEventListener("mousemove", handleMaxPriceMove as any)
    document.removeEventListener("mousemove", handleMinPriceMove as any)
    document.removeEventListener("mouseup", handleMouseUp as any)
}