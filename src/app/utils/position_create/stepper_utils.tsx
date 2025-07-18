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
    selectedToken1: any, 
    selectedToken2: any, 
    fee: any, 
    validateFirstStep: (token1: any, token2: any, fee: any) => boolean, 
    setSelectedToken1: (val: any) => void, 
    setSelectedToken2: (val: any) => void, 
    setFee: (val: any) => void,
    setInitialPrice: (val: number) => void,
    setInitialPriceInput: (val: string) => void,
    setMinPrice: (val: number) => void,
    setMaxPrice: (val: number) => void,
    setMinPriceInput: (val: string) => void,
    setMaxPriceInput: (val: string) => void,
    setToken1Amount: (val: string) => void,
    setToken2Amount: (val: string) => void) => 
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
                setInitialPrice(0)
                setInitialPriceInput("")
                setMinPrice(0)
                setMaxPrice(0)
                setMinPriceInput("")
                setMaxPriceInput("")
                setToken1Amount("")
                setToken2Amount("")
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
        setSelectedToken1: (val: any) => void, 
        setSelectedToken2: (val: any) => void, 
        setFee: (val: any) => void, 
        setInitialPrice: (val: number) => void,
        setInitialPriceInput: (val: string) => void,
        setMinPrice: (val: number) => void,
        setMaxPrice: (val: number) => void,
        setMinPriceInput: (val: string) => void,
        setMaxPriceInput: (val: string) => void,
        setToken1Amount: (val: string) => void,
        setToken2Amount: (val: string) => void
    ) => {
        const delta = direction === 'next' ? 1 : -1
        const nextStep = stepActive + delta

        const isOutOfBounds = nextStep < 0 || nextStep > 2
        if (isOutOfBounds) return

        let currentPrice = 0

        if (direction === 'back') 
        {
            setSelectedToken1(null)
            setSelectedToken2(null)
            setFee(null)
            setInitialPrice(0)
            setInitialPriceInput("")
            setMinPrice(0)
            setMaxPrice(0)
            setMinPriceInput("")
            setMaxPriceInput("")
            setToken1Amount("")
            setToken2Amount("")
        }

        setStepActive(nextStep)
        setHighestStepVisited(prev => Math.max(prev, nextStep))

        currentPrice = await getCurrentPoolPrice() ?? 0

        const minPrice = Math.floor(currentPrice * 0.85)
        const maxPrice = Math.ceil(currentPrice * 1.15)

        setMinPrice(minPrice)
        setMaxPrice(maxPrice)
        setMinPriceInput(minPrice.toString())
        setMaxPriceInput(maxPrice.toString())
    }


// export const processStepChange = async (
//     nextStep: number, 
//     stepActive: number, 
//     setStepActive: (val: number) => void, 
//     setHighestStepVisited: (fn: (prev: number) => number) => void,     
//     getCurrentPoolPrice: () => Promise<number | null | undefined>,
//     setSelectedToken1: (val: any) => void, 
//     setSelectedToken2: (val: any) => void, 
//     setFee: (val: any) => void, 
//     setInitialPrice: (val: number) => void,
//     setInitialPriceInput: (val: string) => void,
//     setMinPrice: (val: number) => void,
//     setMaxPrice: (val: number) => void,
//     setMinPriceInput: (val: string) => void,
//     setMaxPriceInput: (val: string) => void,
//     setToken1Amount: (val: string) => void,
//     setToken2Amount: (val: string) => void) => 
//     {
//         const isOutOfBounds = nextStep < 0 || nextStep > 2
//         if (isOutOfBounds) return

//         let currentPrice: number

//         if (nextStep < stepActive) 
//         {
//             setSelectedToken1(null)
//             setSelectedToken2(null)
//             setFee(null)
//             setInitialPrice(0)
//             setInitialPriceInput("")
//             setMinPrice(0)
//             setMaxPrice(0)
//             setMinPriceInput("")
//             setMaxPriceInput("")
//             setToken1Amount("")
//             setToken2Amount("")
//             currentPrice = 0
//         }

//         setStepActive(nextStep + 1)
//         setHighestStepVisited(prev => Math.max(prev, nextStep))

//         currentPrice = await getCurrentPoolPrice() ?? 0

//         const minPrice = Math.floor(currentPrice * 0.85)
//         const maxPrice = Math.ceil(currentPrice * 1.15)

//         setMinPrice(minPrice)
//         setMaxPrice(maxPrice)
//         setMinPriceInput(minPrice.toString())
//         setMaxPriceInput(maxPrice.toString())
//     }
