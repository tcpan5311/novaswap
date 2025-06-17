// validator_utils.tsx

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

export const validateSecondStep = (token1: CryptocurrencyDetail | null, token2: CryptocurrencyDetail | null, fee: number | null, minPrice: number, maxPrice: number, token1Amount: string | null, token2Amount: string | null): boolean => 
{
    if (!validateFirstStep(token1, token2, fee)) 
    {
        return false
    }

    const isPriceValid = (min: number, max: number): boolean => !isNaN(min) && !isNaN(max) && min >= 0 && max >= min

    const isAmountValid = (amount: string | null): boolean => amount !== null && amount.trim() !== '' && !isNaN(Number(amount)) && Number(amount) > 0

    return (isPriceValid(minPrice, maxPrice) && isAmountValid(token1Amount) && isAmountValid(token2Amount))
}

import { encodeSqrtRatioX96, TickMath, nearestUsableTick } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

// Constants
const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

// Helper: converts price to sqrtPriceX96
const priceToSqrtX96 = (price: number): JSBI => {
    const precision = 1e6
    return encodeSqrtRatioX96(
        JSBI.BigInt(Math.floor(price * precision)),
        JSBI.BigInt(precision)
    )
}

// Helper: multiply and divide in JSBI
const mulDiv = (a: JSBI, b: JSBI, denominator: JSBI): JSBI => {
    return JSBI.divide(JSBI.multiply(a, b), denominator)
}

export const calculateTokenAmounts = (isTokenA: boolean, amountGiven: number, minPrice: number, maxPrice: number, currentPrice: number): { amountA: number; amountB: number } => 
{
    const sqrtMin = priceToSqrtX96(minPrice)
    const sqrtMax = priceToSqrtX96(maxPrice)
    const sqrtCurrent = priceToSqrtX96(currentPrice)

    if (currentPrice <= minPrice) 
    {
        const delta = JSBI.subtract(sqrtMax, sqrtMin)
        const numerator = JSBI.multiply(JSBI.BigInt(amountGiven * 1e18), sqrtMax)
        const denominator = JSBI.multiply(delta, Q96)
        const amountA = amountGiven
        const amountB = 0
        return { amountA, amountB }
    }

    if (currentPrice >= maxPrice) 
    {
        const delta = JSBI.subtract(sqrtMax, sqrtMin)
        const numerator = JSBI.multiply(JSBI.BigInt(amountGiven * 1e18), Q96)
        const denominator = JSBI.multiply(sqrtMax, sqrtMin)
        const amountA = 0
        const amountB = amountGiven
        return { amountA, amountB }
    }

    const sqrtRatioAX96 = JSBI.lessThan(sqrtCurrent, sqrtMin) ? sqrtCurrent : sqrtMin
    const sqrtRatioBX96 = JSBI.greaterThan(sqrtCurrent, sqrtMax) ? sqrtCurrent : sqrtMax

    let liquidity: JSBI
    if (isTokenA) 
    {
        const amount = JSBI.BigInt(amountGiven * 1e18)
        liquidity = mulDiv(amount, JSBI.multiply(sqrtRatioAX96, sqrtRatioBX96), JSBI.multiply(Q96, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)))
    } 

    else 
    {
        const amount = JSBI.BigInt(amountGiven * 1e18)
        liquidity = mulDiv(amount, Q96, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96))
    }


    const amountA = Number(JSBI.toNumber(mulDiv(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtCurrent), JSBI.multiply(sqrtCurrent, sqrtRatioBX96))) / 1e18)
    const amountB = Number(JSBI.toNumber(mulDiv(liquidity, JSBI.subtract(sqrtCurrent, sqrtRatioAX96), Q96)) / 1e18)

    return { amountA, amountB }
}

