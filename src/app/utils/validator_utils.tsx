export interface CryptocurrencyDetail 
{
    Label: string
    Address: string
}

export type TokenSetter = React.Dispatch<React.SetStateAction<CryptocurrencyDetail | null>>

export const validateFirstStep = (token0Address: string, token1Address: string, fee: number): boolean => 
{
    const isTokenValid = (address: string): boolean => address !== null && typeof address === 'string' && address.trim() !== ''
    const isFeeValid = (fee: number): boolean => fee !== null && !isNaN(fee) && fee >= 0
    const isSameToken = token0Address && token1Address && token0Address === token1Address
    return isTokenValid(token0Address) && isTokenValid(token1Address) && isFeeValid(fee) && !isSameToken
}

export const validateFullFirstStep = async (token0Address: string, token1Address: string, fee: number, initialPrice: number, doesPoolExist: (token0Address: string, token1Address: string, fee: number) => Promise<boolean>): Promise<{ isValid: boolean; poolExists: boolean }> => 
{
    if (!validateFirstStep(token0Address, token1Address, fee)) return { isValid: false, poolExists: false }

    const poolExists = await doesPoolExist(token0Address, token1Address, fee)
    const isValid = poolExists || initialPrice > 0

    return { isValid, poolExists }
}

export const validateSecondStep = async (
    provider: any,
    signer: any,
    token0Address: string,
    token1Address: string,
    fee: number,
    minPrice: number,
    maxPrice: number,
    token0Amount: string,
    token1Amount: string,
    currentPrice: number,
    computeTokenAmount: (
        isAToB: boolean,
        overrideAmount: string,
        currentPrice: number,
        provider: any,
        signer: any,
        token0Address: string,
        token1Address: string,
        fee: number,
        token0Amount: string,
        token1Amount: string,
        minPrice: number,
        maxPrice: number,
        uniswapV3FactoryContract: any,
        getPoolContract: (address: string) => any
    ) => Promise<{ amountA: string; amountB: string }>,
    uniswapV3FactoryContract: any,
    getPoolContract: (address: string) => any
): Promise<boolean> => 
{
    if (!validateFirstStep(token0Address, token1Address, fee)) 
    {
        return false
    }

    const isPriceValid = (min: number, max: number): boolean => !isNaN(min) && !isNaN(max) && min > 0 && max >= min
    const isAmountValid = (amount: string): boolean => amount !== null && amount.trim() !== '' && !isNaN(Number(amount)) && Number(amount) > 0

    if (!isPriceValid(minPrice, maxPrice)) 
    {
        return false
    }

    if (!token0Address || !token1Address || fee === null || currentPrice === null || currentPrice <= 0) 
    {
        return false
    }

    const threshold = 1e-12
    
    try 
    {
        const resultAtoB = await computeTokenAmount
        (
            true,
            "0.0001",
            currentPrice,
            provider,
            signer,
            token0Address,
            token1Address,
            fee,
            "",
            "",
            minPrice,
            maxPrice,
            uniswapV3FactoryContract,
            getPoolContract
        )

        const amountA = parseFloat(resultAtoB?.amountA ?? "0")
        const amountB = parseFloat(resultAtoB?.amountB ?? "0")

        if (amountA >= threshold && amountB < threshold) 
        {
            return isAmountValid(token0Amount)
        }

        if (amountB >= threshold && amountA < threshold) 
        {
            return isAmountValid(token0Amount)
        }

        if (amountA >= threshold && amountB >= threshold) 
        {
            return isAmountValid(token0Amount) || isAmountValid(token1Amount)
        }

        const resultBtoA = await computeTokenAmount
        (
            false,
            "0.0001",
            currentPrice,
            provider,
            signer,
            token0Address,
            token1Address,
            fee,
            "",
            "",
            minPrice,
            maxPrice,
            uniswapV3FactoryContract,
            getPoolContract
        )

        const reverseA = parseFloat(resultBtoA?.amountA ?? "0")
        const reverseB = parseFloat(resultBtoA?.amountB ?? "0")

        if (reverseA >= threshold && reverseB < threshold) 
        {
            return isAmountValid(token1Amount)
        }

        if (reverseB >= threshold && reverseA < threshold) 
        {
            return isAmountValid(token1Amount)
        }

        if (reverseA >= threshold && reverseB >= threshold) 
        {
            return isAmountValid(token0Amount) || isAmountValid(token1Amount)
        }

        return false
    } 
    catch (error) 
    {
        console.log(error)
        return false
    }
}

export const validateAmounts = (token0Amount: string, token1Amount: string): boolean => 
{
    const isAmountValid = (amount: string): boolean => 
    {
        if (amount === null || typeof amount !== 'string') return false
        const num = parseFloat(amount)
        return !isNaN(num) && num > 0
    }

    return isAmountValid(token0Amount) && isAmountValid(token1Amount)
}

export const validatePercent = (percent: string): boolean => 
{
    if (percent === null || typeof percent !== 'string') return false
    const num = parseFloat(percent)
    return !isNaN(num) && num >= 1 && num <= 100
}









