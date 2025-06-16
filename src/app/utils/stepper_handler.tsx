// utils/stepperHelpers.ts

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

export const processStepChange = (nextStep: number, stepActive: number, setSelectedToken1: (val: any) => void, setSelectedToken2: (val: any) => void, setFee: (val: any) => void, setStepActive: (val: number) => void, setHighestStepVisited: (fn: (prev: number) => number) => void) => 
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
}
