interface CryptocurrencyDetail 
{
    Label: string
    Address: string
}

export const shouldAllowStep = (step: number, highestStepVisited: number): boolean => 
{
    return highestStepVisited >= step
}

export const processStepClick = (
    step: number, 
    highestStepVisited: number, 
    setStepActive: (val: number) => void,
    selectedToken0: any, 
    selectedToken1: any, 
    fee: any, 
    validateFirstStep: (token0: any, token1: any, fee: any) => boolean, 
    setSelectedToken0: (val: any) => void, 
    setSelectedToken1: (val: any) => void, 
    setFee: (val: any) => void,
    setInitialPrice: (val: number) => void,
    setInitialPriceInput: (val: string) => void,
    setMinPrice: (val: number) => void,
    setMaxPrice: (val: number) => void,
    setMinPriceInput: (val: string) => void,
    setMaxPriceInput: (val: string) => void,
    setToken0Amount: (val: string) => void,
    setToken1Amount: (val: string) => void,
    updateTokenSelection: (shouldSet: boolean) => void) => 
    {
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
            if (step === 0) 
            {
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
            setStepActive(step + 1)
        }
    }

    export const processStepChange = async (
        direction: 'next' | 'back',
        stepActive: number,
        setStepActive: (val: number) => void,
        setHighestStepVisited: (fn: (prev: number) => number) => void,
        getCurrentPoolPrice: () => Promise<number | null | undefined>,
        setSelectedToken0: (val: any) => void, 
        setSelectedToken1: (val: any) => void, 
        setFee: (val: any) => void, 
        setInitialPrice: (val: number) => void,
        setInitialPriceInput: (val: string) => void,
        setMinPrice: (val: number) => void,
        setMaxPrice: (val: number) => void,
        setMinPriceInput: (val: string) => void,
        setMaxPriceInput: (val: string) => void,
        setToken0Amount: (val: string) => void,
        setToken1Amount: (val: string) => void,
        updateTokenSelection: (shouldSet: boolean) => void) => 
        {
            const delta = direction === 'next' ? 1 : -1
            const nextStep = stepActive + delta

            const isOutOfBounds = nextStep < 0 || nextStep > 2
            if (isOutOfBounds) return

            let currentPrice = 0

            if (direction === 'back') 
            {
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

            setStepActive(nextStep)
            setHighestStepVisited(prev => Math.max(prev, nextStep))

            currentPrice = await getCurrentPoolPrice() ?? 0

            const minPrice = Math.floor(currentPrice * 0.85)
            const maxPrice = Math.ceil(currentPrice * 1.15)

            updateTokenSelection(true)
            setMinPrice(minPrice)
            setMaxPrice(maxPrice)
            setMinPriceInput(minPrice.toString())
            setMaxPriceInput(maxPrice.toString())
        }
