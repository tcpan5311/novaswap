type Setters = 
{
    setStepActive: (val: number) => void
    setHighestStepVisited?: (fn: (prev: number) => number) => void
    setSelectedToken0: (val: any) => void
    setSelectedToken1: (val: any) => void
    setFee: (val: any) => void
    setInitialPrice: (val: number) => void
    setInitialPriceInput: (val: string) => void
    setMinPrice: (val: number) => void
    setMaxPrice: (val: number) => void
    setMinPriceInput: (val: string) => void
    setMaxPriceInput: (val: string) => void
    setToken0Amount: (val: string) => void
    setToken1Amount: (val: string) => void
    updateTokenSelection: (shouldSet: boolean) => void
}

export const shouldAllowStep = (step: number, highestStepVisited: number): boolean => highestStepVisited >= step

const resetFormState = (setters: Setters) => 
{
    const 
    {
        setSelectedToken0, 
        setSelectedToken1, 
        setFee,
        setInitialPrice, 
        setInitialPriceInput,
        setMinPrice, 
        setMaxPrice, 
        setMinPriceInput, 
        setMaxPriceInput,
        setToken0Amount, 
        setToken1Amount, 
        updateTokenSelection
    } = setters

    setSelectedToken0(null)
    setSelectedToken1(null)
    setFee(null)
    setInitialPrice(0)
    setInitialPriceInput("")
    setMinPrice(0)
    setMaxPrice(0)
    setMinPriceInput("")
    setMaxPriceInput("")
    setToken0Amount("")
    setToken1Amount("")
    updateTokenSelection(false)
}

export const processStepClick = (step: number, highestStepVisited: number, setters: Setters, selectedToken0: any, selectedToken1: any, fee: any, validateFirstStep: (token0: any, token1: any, fee: any) => boolean,) => 
{
    const { setStepActive } = setters
    if (!shouldAllowStep(step, highestStepVisited)) return

    if (step === 1) 
    {
        if (validateFirstStep(selectedToken0, selectedToken1, fee)) 
        {
            setStepActive(step + 1)
        }
    } 
    else 
    {
        if (step === 0) resetFormState(setters)
        setStepActive(step + 1)
    }
}


export const processStepChange = async (direction: 'next' | 'back', stepActive: number, setters: Setters, getCurrentPoolPrice: () => Promise<number | null | undefined>,) => 
{
    const { setStepActive, setHighestStepVisited } = setters

    const delta = direction === 'next' ? 1 : -1
    const nextStep = stepActive + delta
    
    if (nextStep < 0 || nextStep > 2) return

    if (direction === 'back') resetFormState(setters)

    setStepActive(nextStep)
    setHighestStepVisited?.(prev => Math.max(prev, nextStep))

    const currentPrice = (await getCurrentPoolPrice()) ?? 0
    const minPrice = Math.floor(currentPrice * 0.85)
    const maxPrice = Math.ceil(currentPrice * 1.15)

    setters.updateTokenSelection(true)
    setters.setMinPrice(minPrice)
    setters.setMaxPrice(maxPrice)
    setters.setMinPriceInput(minPrice.toString())
    setters.setMaxPriceInput(maxPrice.toString())
}
