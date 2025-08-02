"use client"
import { UseSelectedPosition } from '../context/selected_position_context'
import { TickMath } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

const tickToPrice = (tick: number): number => 
{
    const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick)
    const numerator = JSBI.multiply(sqrtPriceX96, sqrtPriceX96)
    const denominator = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(192))
    return Number(JSBI.toNumber(numerator)) / Number(JSBI.toNumber(denominator))
}

export default function PositionDetails() 
{
    const { selectedPosition } = UseSelectedPosition()

    if (!selectedPosition) 
    {
        return <div className="p-4">No position selected. Go back and choose one.</div>
    }

    const minPrice = tickToPrice(selectedPosition.tickLower)
    const maxPrice = tickToPrice(selectedPosition.tickUpper)

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-2">
            Token ID: {selectedPosition.tokenId.toString()}
            </h1>
            <p>Token Pair: {selectedPosition.token0} / {selectedPosition.token1}</p>
            <p>Current Price: {selectedPosition.currentPrice}</p>
            <p>Min Price: {minPrice}</p>
            <p>Max Price: {maxPrice}</p>
            <p>Liquidity: {selectedPosition.liquidity.toString()}</p>
            <p>
            Owed Tokens: {selectedPosition.tokensOwed0.toString()} {selectedPosition.token0} /{' '}
            {selectedPosition.tokensOwed1.toString()} {selectedPosition.token1}
            </p>
            <p>
            Tokens Added: {selectedPosition.token0Amount0} {selectedPosition.token0} /{' '}
            {selectedPosition.token1Amount1} {selectedPosition.token1}
            </p>
        </div>
    )
}
