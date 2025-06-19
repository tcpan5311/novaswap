import { encodeSqrtRatioX96, TickMath, nearestUsableTick } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

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

// Constants
const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

// Helper: converts price to sqrtPriceX96
const priceToSqrtX96 = (price: number): JSBI => {
    const precision = 1e18 // Use 1e18 for consistent scaling
    return encodeSqrtRatioX96(
        JSBI.BigInt(Math.floor(price * precision)),
        JSBI.BigInt(precision)
    )
}

// Helper: multiply and divide in JSBI
const mulDiv = (a: JSBI, b: JSBI, denominator: JSBI): JSBI => {
    return JSBI.divide(JSBI.multiply(a, b), denominator)
}

// Helper: safely convert JSBI to float, with scaling
const jsbiToFloat = (value: JSBI, decimals: number = 18): number => {
    const divisor = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))
    const quotient = JSBI.divide(value, divisor)
    const remainder = JSBI.remainder(value, divisor)
    return Number(quotient.toString()) + Number(remainder.toString()) / Math.pow(10, decimals)
}

// Main function
export const calculateTokenAmounts = (
  isTokenA: boolean,
  amountGiven: number,
  minPrice: number,
  maxPrice: number,
  currentPrice: number
): { amountA: number; amountB: number } => {
  const sqrtMin = priceToSqrtX96(minPrice)
  const sqrtMax = priceToSqrtX96(maxPrice)
  const sqrtCurrent = priceToSqrtX96(currentPrice)

  const amountGivenScaled = JSBI.BigInt(Math.floor(amountGiven * 1e18))

  if (currentPrice <= minPrice) {
    return { amountA: amountGiven, amountB: 0 }
  }
  if (currentPrice >= maxPrice) {
    return { amountA: 0, amountB: amountGiven }
  }

  const sqrtRatioAX96 = JSBI.lessThan(sqrtCurrent, sqrtMin) ? sqrtCurrent : sqrtMin
  const sqrtRatioBX96 = JSBI.greaterThan(sqrtCurrent, sqrtMax) ? sqrtCurrent : sqrtMax

  let liquidity: JSBI

  if (isTokenA) {
    liquidity = mulDiv(
      amountGivenScaled,
      JSBI.multiply(sqrtRatioAX96, sqrtRatioBX96),
      JSBI.multiply(Q96, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96))
    )
  } else {
    liquidity = mulDiv(
      amountGivenScaled,
      Q96,
      JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)
    )
  }

  console.log('liquidity:', liquidity.toString())

  // Use mulDiv carefully to avoid truncation
  const rawAmountA = mulDiv(
    liquidity,
    JSBI.subtract(sqrtRatioBX96, sqrtCurrent),
    JSBI.multiply(sqrtCurrent, sqrtRatioBX96)
  )
  const rawAmountB = mulDiv(
    liquidity,
    JSBI.subtract(sqrtCurrent, sqrtRatioAX96),
    Q96
  )

  console.log('rawAmountA:', rawAmountA.toString())
  console.log('rawAmountB:', rawAmountB.toString())

  const amountA = jsbiToFloat(rawAmountA, 18)
  const amountB = jsbiToFloat(rawAmountB, 18)

  return { amountA, amountB }
}


export const updateTokenAmounts = (
  inputAmount: string,
  isInputTokenA: boolean,
  minPrice: number,
  maxPrice: number,
  currentPrice: number,
  setToken1Amount: (val: string) => void,
  setToken2Amount: (val: string) => void,
  setToken1Only: (val: boolean) => void,
  setToken2Only: (val: boolean) => void
) => {
  const parsedAmount = parseFloat(inputAmount)

  if (isNaN(parsedAmount)) {
    setToken1Amount('')
    setToken2Amount('')
    setToken1Only(false)
    setToken2Only(false)
    return
  }

  const { amountA, amountB } = calculateTokenAmounts(
    isInputTokenA,
    parsedAmount,
    minPrice,
    maxPrice,
    currentPrice
  )

  const isBelowMin = currentPrice <= minPrice
  const isAboveMax = currentPrice >= maxPrice

  if (isBelowMin) {
    setToken1Only(true)
    setToken2Only(false)

    if (isInputTokenA) {
      setToken1Amount(inputAmount)
      setToken2Amount('0')
    } else {
      setToken2Amount(inputAmount)
      setToken1Amount('0')
    }

    return
  }

  if (isAboveMax) {
    setToken1Only(false)
    setToken2Only(true)

    if (!isInputTokenA) {
      setToken2Amount(inputAmount)
      setToken1Amount('0')
    } else {
      setToken1Amount(inputAmount)
      setToken2Amount('0')
    }

    return
  }

  // Mid-range: provide both
  setToken1Only(false)
  setToken2Only(false)

  if (isInputTokenA) {
    setToken1Amount(inputAmount)
    setToken2Amount(amountB.toString())
  } else {
    setToken2Amount(inputAmount)
    setToken1Amount(amountA.toString())
  }
}





