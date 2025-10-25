import { CryptocurrencyDetail } from "@/app/redux/types"

type Setters = 
{
    setStepActive: (value: number) => void
    setHighestStepVisited: (fn: (prev: number) => number) => void
    setSelectedToken0: (value: CryptocurrencyDetail | undefined) => void
    setSelectedToken1: (value: CryptocurrencyDetail | undefined) => void
    setFee: (value: number | undefined) => void
    setInitialPrice: (value: number) => void
    setInitialPriceInput: (value: string) => void
    setMinPrice: (value: number) => void
    setMaxPrice: (value: number) => void
    setMinPriceInput: (value: string) => void
    setMaxPriceInput: (value: string) => void
    setToken0Amount: (value: string) => void
    setToken1Amount: (value: string) => void
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

    setSelectedToken0(undefined)
    setSelectedToken1(undefined)
    setFee(undefined)
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

export const processStepClick = (step: number, highestStepVisited: number, setters: Setters, selectedToken0: CryptocurrencyDetail | undefined, selectedToken1: CryptocurrencyDetail | undefined, fee: number | undefined, validateFirstStep: (token0: string, token1: string, fee: number) => boolean,) => 
{
    const { setStepActive } = setters
    if (!shouldAllowStep(step, highestStepVisited)) return

    if (step === 1) 
    {
        if (!selectedToken0 || !selectedToken1 || fee === undefined) return

        if (validateFirstStep(selectedToken0.Address, selectedToken1.Address, fee)) 
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


export const processStepChange = async (direction: 'next' | 'back', stepActive: number, setters: Setters, getCurrentPoolPrice: () => Promise<number | undefined>,) => 
{
    const { setStepActive, setHighestStepVisited } = setters

    let delta
    if (direction === 'next') 
    {
        delta = 1
    } 
    else 
    {
        delta = -1
    }
    const nextStep = stepActive + delta
    
    if (nextStep < 0 || nextStep > 2) return

    if (direction === 'back') resetFormState(setters)

    setStepActive(nextStep)
    if (setHighestStepVisited) 
    {
        setHighestStepVisited(prev => Math.max(prev, nextStep))
    }

    const poolPrice = (await getCurrentPoolPrice())
    let currentPrice
    if (poolPrice !== undefined) 
    {
        currentPrice = poolPrice
    } 
    else 
    {
        currentPrice = 0
    }
    const minPrice = Math.floor(currentPrice * 0.85)
    const maxPrice = Math.ceil(currentPrice * 1.15)

    setters.updateTokenSelection(true)
    setters.setMinPrice(minPrice)
    setters.setMaxPrice(maxPrice)
    setters.setMinPriceInput(minPrice.toString())
    setters.setMaxPriceInput(maxPrice.toString())
}
