import { TickMath, encodeSqrtRatioX96, Pool, Position, nearestUsableTick } from '@uniswap/v3-sdk'
import { Token, CurrencyAmount } from '@uniswap/sdk-core'
import { ethers } from 'ethers'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import JSBI from 'jsbi'

export type PositionData = 
{
    tokenId: bigint
    token0Address: string
    token1Address: string
    token0: string
    token1: string
    fee: number
    pool: string
    tickLower: number
    tickUpper: number
    minPrice: number,
    maxPrice: number
    currentTick: number
    liquidity: bigint
    currentPrice: number
    feeGrowthInside0LastX128: bigint
    feeGrowthInside1LastX128: bigint
    tokensOwed0: bigint
    tokensOwed1: bigint
    token0Amount0: bigint
    token1Amount1: bigint
}

//Helper functions
export const priceToSqrtPBigNumber = (price: number): bigint => 
{
    const DECIMALS = 18
    const SCALE = 10 ** DECIMALS

    const numerator = JSBI.BigInt(Math.round(price * SCALE))
    const denominator = JSBI.BigInt(SCALE)

    const jsbi = encodeSqrtRatioX96(numerator, denominator)
    return BigInt(jsbi.toString())
}

export const sqrtPToPriceNumber = (sqrtPriceX96: bigint): number => 
{
    const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))
    const sqrtPriceJSBI = JSBI.BigInt(sqrtPriceX96.toString())
    const sqrtPrice = JSBI.toNumber(sqrtPriceJSBI) / JSBI.toNumber(Q96)
    return sqrtPrice * sqrtPrice
}

export const priceToSqrtP = (price: number) => 
{
    const DECIMALS = 18
    const SCALE = 10 ** DECIMALS

    const numerator = JSBI.BigInt(Math.round(price * SCALE))
    const denominator = JSBI.BigInt(SCALE)

    return encodeSqrtRatioX96(numerator, denominator)
}

export const priceToTick = (price: number) => TickMath.getTickAtSqrtRatio(priceToSqrtP(price))

export const tickToPrice = (tick: number): number => 
{
    const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick)
    const numerator = JSBI.multiply(sqrtPriceX96, sqrtPriceX96)
    const denominator = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(192))
    return Number(JSBI.toNumber(numerator)) / Number(JSBI.toNumber(denominator))
}

export const roundIfCloseToWhole = (amountStr: string): string => 
{
    const epsilon = 1e-18

    const val = parseFloat(amountStr)
    const rounded = Math.round(val)

    if (Math.abs(val - rounded) < epsilon) 
    {
        return rounded.toString()  
    }
    
    return amountStr
}

export const computeTokenAmount = async (
    isAToB: boolean,
    overrideAmount: string,
    currentPrice: number,
    signer: ethers.Signer,
    token0Address: string,
    token1Address: string,
    fee: number,
    token0Amount: string,
    token1Amount: string,
    minPrice: number,
    maxPrice: number,
    uniswapV3FactoryContract: any,
    getPoolContract: (address: string) => any
): Promise<{ amountA: string; amountB: string }> => 
    {

    if (!signer.provider) 
    {
        throw new Error("Provider not available from signer")
    }
    
    const network = await signer.provider.getNetwork()
    const chainId = Number(network.chainId)

    const [contract1, contract2] = [token0Address, token1Address].map(addr => new ethers.Contract(addr, ERC20Mintable.abi, signer))

    const [decimalA, decimalB, symA, symB] = await Promise.all
    ([
        contract1.decimals(),
        contract2.decimals(),
        contract1.symbol(),
        contract2.symbol()
    ])

    const [tokenA, tokenB] = 
    [
        new Token(chainId, token0Address, Number(decimalA), symA),
        new Token(chainId, token1Address, Number(decimalB), symB)
    ]

    const poolAddress = await uniswapV3FactoryContract.getPoolAddress(token0Address, token1Address, fee)
    const poolCallContract = getPoolContract(poolAddress)

    let pool: Pool
    try 
    {
        const [slot0, liquidity] = await Promise.all
        ([
            poolCallContract.slot0(),
            poolCallContract.liquidity()
        ])

        const sqrtPriceX96 = slot0.sqrtPriceX96.toString()
        const currentTick = slot0.tick

        pool = new Pool(tokenA, tokenB, fee, sqrtPriceX96, liquidity.toString(), Number(currentTick))

    } 
    catch 
    {
        const sqrtPriceX96 = encodeSqrtRatioX96(ethers.parseUnits((currentPrice).toString(), decimalA).toString(), ethers.parseUnits('1', decimalB).toString()).toString()

        pool = new Pool
        (
            tokenA,
            tokenB,
            fee,
            sqrtPriceX96,
            '0',
            priceToTick(currentPrice)
        )
    }

    const buffer = 0.0001
    let tickLower: number
    let tickUpper: number
    
    if (minPrice <= tickToPrice(TickMath.MIN_TICK)) 
    {
        tickLower = nearestUsableTick(TickMath.MIN_TICK, 60)
    } 
    else 
    {
        tickLower = nearestUsableTick(priceToTick(minPrice - buffer), 60)
    }

    if (maxPrice >= tickToPrice(TickMath.MAX_TICK)) 
    {
        tickUpper = nearestUsableTick(TickMath.MAX_TICK, 60)
    } 
    else 
    {
        tickUpper = nearestUsableTick(priceToTick(maxPrice + buffer), 60)
    }

    const getAmount = (amountStr: string, token: Token, decimals: number) => CurrencyAmount.fromRawAmount(token, ethers.parseUnits(amountStr, decimals).toString())

    let amountTokenA: CurrencyAmount<Token>, amountTokenB: CurrencyAmount<Token>
    const MAX_REASONABLE_AMOUNT = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(36))

    try 
    {
        if (isAToB) 
        {
            const amountStr = overrideAmount || token0Amount
            amountTokenA = getAmount(amountStr, tokenA, decimalA)

            const position = Position.fromAmount0
            ({
                pool,
                tickLower,
                tickUpper,
                amount0: amountTokenA.quotient,
                useFullPrecision: true
            })

            amountTokenB = position.amount1
        } 
        else 
        {
            const amountStr = overrideAmount || token1Amount
            amountTokenB = getAmount(amountStr, tokenB, decimalB)

            const position = Position.fromAmount1
            ({
                pool,
                tickLower,
                tickUpper,
                amount1: amountTokenB.quotient
            })

            amountTokenA = position.amount0
        }

        if (JSBI.greaterThan(amountTokenA.quotient, MAX_REASONABLE_AMOUNT) || JSBI.greaterThan(amountTokenB.quotient, MAX_REASONABLE_AMOUNT)) 
        {
            return { amountA: '0', amountB: '0' }
        }

        return {
            amountA: roundIfCloseToWhole(amountTokenA.toFixed(18)),
            amountB: roundIfCloseToWhole(amountTokenB.toFixed(18))
        }
    } 
    catch 
    {
        return { amountA: '0', amountB: '0' }
    }
}

export const updateTokenAmounts = async (
    isAToB: boolean,
    inputValue: string,
    token0Address: string,
    token1Address: string,
    fee: number,
    minPrice: number,
    maxPrice: number,
    currentPrice: number,
    computeTokenAmount: (
        isAToB: boolean,
        overrideAmount: string,
        currentPrice: number,
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
    setToken0Amount: (value: string) => void,
    setToken1Amount: (value: string) => void,
    lastEditedField: string,
    token0Amount: string,
    token1Amount: string,
    signer: any,
    uniswapV3FactoryContract: any,
    getPoolContract: (address: string) => any
): Promise<void> => 
{
    if (!token0Address || !token1Address || !fee || !minPrice || !maxPrice)  return
    
    const trimmed = inputValue.trim()
    if (trimmed === "") 
    {
        setToken0Amount("")
        setToken1Amount("")
        return
    }

    if (!currentPrice || currentPrice <= 0) 
    {
        return
    }

    const { amountA, amountB } = await computeTokenAmount
    (
        isAToB,
        trimmed,
        currentPrice,
        signer,
        token0Address,
        token1Address,
        fee,
        token0Amount,
        token1Amount,
        minPrice,
        maxPrice,
        uniswapV3FactoryContract,
        getPoolContract
    )

    if (isAToB && lastEditedField !== "token1") 
    {
        setToken1Amount(amountB.toString())
    } 
    else if (!isAToB && lastEditedField !== "token0") 
    {
        setToken0Amount(amountA.toString())
    }

    console.log(`Token 0 Amount: ${amountA}, Token 1 Amount: ${amountB}, Price: ${currentPrice}`)
}

export const handleTokenInputDisplay = async (
    token0Address: string,
    token1Address: string,
    fee: number,
    minPrice: number,
    maxPrice: number,
    currentPrice: number,
    computeTokenAmount: (
        isAToB: boolean,
        overrideAmount: string,
        currentPrice: number,
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
    setHideToken0DuringChange: (value: boolean) => void,
    setHideToken1DuringChange: (value: boolean) => void,
    signer: any,
    uniswapV3FactoryContract: any,
    getPoolContract: (address: string) => any
) => 
{
    if (!token0Address || !token1Address || !fee || !minPrice || !maxPrice)  return

    try 
    {
        const threshold = 1e-12

        const resultAtoB = await computeTokenAmount
        (
            true,
            "0.0001",
            currentPrice,
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

        const amountA = parseFloat(resultAtoB.amountA || "0")
        const amountB = parseFloat(resultAtoB.amountB || "0")

        if (amountA >= threshold && amountB < threshold) 
        {
            setHideToken0DuringChange(false)
            setHideToken1DuringChange(true)
            return
        }

        if (amountB >= threshold && amountA < threshold) 
        {
            setHideToken0DuringChange(true)
            setHideToken1DuringChange(false)
            return
        }

        if (amountA >= threshold && amountB >= threshold) 
        {
            setHideToken0DuringChange(false)
            setHideToken1DuringChange(false)
            return
        }

        // Fallback: Try B→A
        const resultBtoA = await computeTokenAmount
        (
            false,
            "0.0001",
            currentPrice,
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

        const reverseAmountA = parseFloat(resultBtoA.amountA || "0")
        const reverseAmountB = parseFloat(resultBtoA.amountB || "0")

        if (reverseAmountB >= threshold && reverseAmountA < threshold) 
        {
            setHideToken0DuringChange(true)
            setHideToken1DuringChange(false)
            return
        }

        if (reverseAmountA >= threshold && reverseAmountB < threshold) 
        {
            setHideToken0DuringChange(false)
            setHideToken1DuringChange(true)
            return
        }

        if (reverseAmountA >= threshold && reverseAmountB >= threshold) 
        {
            setHideToken0DuringChange(false)
            setHideToken1DuringChange(false)
            return
        }

        setHideToken0DuringChange(false)
        setHideToken1DuringChange(false)
    } 

    catch (error) 
    {
        console.log(error)
    }
}
