export interface CryptocurrencyDetail 
{
    Label: string
    Address: string
}

export const validateFirstStep = (token1: CryptocurrencyDetail | null, token2: CryptocurrencyDetail | null, fee: number | null): boolean => 
{
    const isTokenValid = (token: CryptocurrencyDetail | null): boolean => token !== null && typeof token.Label === 'string' && token.Label.trim() !== '' && typeof token.Address === 'string' && token.Address.trim() !== ''
    const isFeeValid = (fee: number | null): boolean => fee !== null && !isNaN(fee) && fee >= 0
    return isTokenValid(token1) && isTokenValid(token2) && isFeeValid(fee)
}

export const validateSecondStep = (token1: CryptocurrencyDetail | null, token2: CryptocurrencyDetail | null, fee: number | null, minPrice: number, maxPrice: number, token1Amount: string | null, token2Amount: string | null, currentPrice: number | null ): boolean => 
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
        return isAmountValid(token1Amount) && isAmountValid(token2Amount) 
    }

    return false 
}







