interface CryptocurrencyDetail 
{
    Label: string
    Address: string
}

export const shouldAllowStep = (step: number, highestStepVisited: number): boolean => 
{
    return highestStepVisited >= step
}

export const processStepClick = (step: number, highestStepVisited: number, stepActive: number, selectedToken1: any, selectedToken2: any, fee: any, validateFirstStep: (token1: any, token2: any, fee: any) => boolean, setSelectedToken1: (val: any) => void, setSelectedToken2: (val: any) => void, setFee: (val: any) => void, setStepActive: (val: number) => void) => 
{
    if (!shouldAllowStep(step, highestStepVisited)) return

    if (step === 1) 
    {
        if (validateFirstStep(selectedToken1, selectedToken2, fee)) 
        {
            setStepActive(step + 1)
        }
    } 
    else 
    {
        if (step === 0) 
        {
            setSelectedToken1(null)
            setSelectedToken2(null)
            setFee(null)
        }
        setStepActive(step + 1)
    }
}

export const processStepChange = async (
    nextStep: number, 
    stepActive: number, 
    selectedToken1: CryptocurrencyDetail | null, 
    selectedToken2: CryptocurrencyDetail | null, 
    fee: number | null,
    setSelectedToken1: (val: any) => void, 
    setSelectedToken2: (val: any) => void, 
    setFee: (val: any) => void, 
    setStepActive: (val: number) => void, 
    setHighestStepVisited: (fn: (prev: number) => number) => void,     
    doesPoolExistFn: (token1Address: string | null, token2Address: string | null, fee: number | null) => Promise<boolean>,
    initialPrice: number,   
    getCurrentPoolPrice: () => Promise<number | null | undefined>,
    setMinPrice: (val: number) => void,
    setMaxPrice: (val: number) => void,
    setMinPriceInput: (val: string) => void,
    setMaxPriceInput: (val: string) => void) => 
    {
        const isOutOfBounds = nextStep < 0 || nextStep > 2
        if (isOutOfBounds) return

        if (nextStep < stepActive) 
        {
            setSelectedToken1(null)
            setSelectedToken2(null)
            setFee(null)
        }

        setStepActive(nextStep + 1)
        setHighestStepVisited(prev => Math.max(prev, nextStep))

        const poolExists = await doesPoolExistFn(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)

        let currentPrice: number
        if (poolExists) 
        {
            currentPrice = await getCurrentPoolPrice() ?? 0
        } 
        else 
        {
            currentPrice = initialPrice
        }

        const minPrice = Math.floor(currentPrice * 0.85)
        const maxPrice = Math.ceil(currentPrice * 1.15)

        setMinPrice(minPrice)
        setMaxPrice(maxPrice)
        setMinPriceInput(minPrice.toString())
        setMaxPriceInput(maxPrice.toString())
    }
