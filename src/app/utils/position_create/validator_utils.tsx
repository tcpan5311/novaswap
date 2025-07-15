export interface CryptocurrencyDetail 
{
    Label: string
    Address: string
}

export type TokenSetter = React.Dispatch<React.SetStateAction<CryptocurrencyDetail | null>>

export const validateFirstStep = (token1: CryptocurrencyDetail | null, token2: CryptocurrencyDetail | null, fee: number | null): boolean => 
{
    const isTokenValid = (token: CryptocurrencyDetail | null): boolean => token !== null && typeof token.Label === 'string' && token.Label.trim() !== '' && typeof token.Address === 'string' && token.Address.trim() !== ''
    const isFeeValid = (fee: number | null): boolean => fee !== null && !isNaN(fee) && fee >= 0
    const isSameToken = token1 && token2 && token1.Address === token2.Address
    return isTokenValid(token1) && isTokenValid(token2) && isFeeValid(fee) && !isSameToken
}

export const validateFullFirstStep = async (token1: CryptocurrencyDetail | null, token2: CryptocurrencyDetail | null, fee: number | null, initialPrice: number, doesPoolExist: (token1Address: string | null, token2Address: string | null, fee: number | null) => Promise<boolean>): Promise<{ isValid: boolean; poolExists: boolean }> => 
{

    if (!validateFirstStep(token1, token2, fee)) return { isValid: false, poolExists: false }

    const token1Address = token1?.Address ?? null
    const token2Address = token2?.Address ?? null

    const poolExists = await doesPoolExist(token1Address, token2Address, fee)
    const isValid = poolExists || initialPrice > 0

    return { isValid, poolExists }
}

export const validateSecondStep = async (token1: CryptocurrencyDetail | null, token2: CryptocurrencyDetail | null, fee: number | null, minPrice: number, maxPrice: number, token1Amount: string | null, token2Amount: string | null, currentPrice: number | null, computeTokenAmount: (isAToB: boolean, overrideAmount?: string, initialPrice?: number) => Promise<{ amountA: string, amountB: string }>): Promise<boolean> => 
{
    if (!validateFirstStep(token1, token2, fee)) 
    {
        return false
    }

    const isPriceValid = (min: number, max: number): boolean => !isNaN(min) && !isNaN(max) && min >= 0 && max >= min
    const isAmountValid = (amount: string | null): boolean => amount !== null && amount.trim() !== '' && !isNaN(Number(amount)) && Number(amount) > 0

    if (!isPriceValid(minPrice, maxPrice)) 
    {
        return false
    }

    const price = currentPrice ?? 0
    const isAboveRange = price > maxPrice
    const isBelowRange = price < minPrice
    const isWithinRange = price >= minPrice && price <= maxPrice

    if (isAboveRange) 
    {
        return isAmountValid(token2Amount) 
    }

    if (isBelowRange) 
    {
        return isAmountValid(token1Amount) 
    }

    if (isWithinRange) 
    {
        try 
        {
            const resultAtoB = await computeTokenAmount(true, "0.0001", price)
            const resultBtoA = await computeTokenAmount(false, "0.0001", price)

            const amountA_from_B = Number(resultBtoA.amountA)
            const amountB_from_A = Number(resultAtoB.amountB)

            const token1Disabled = amountA_from_B === 0
            const token2Disabled = amountB_from_A === 0

            if (token1Disabled && !token2Disabled) 
            {
                return isAmountValid(token2Amount)
            } 
            else if (!token1Disabled && token2Disabled) 
            {
                return isAmountValid(token1Amount)
            } 
            else 
            {
                return isAmountValid(token1Amount) && isAmountValid(token2Amount)
            }
        } 
        catch (error) 
        {
            return false
        }
    }

    return false 
}







