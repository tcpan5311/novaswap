"use client"
import { useState, useEffect } from 'react'
import JSBI from 'jsbi'
import UniswapV3Pool from '../../../contracts/UniswapV3Pool.json'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import { UseBlockchain } from '../context/blockchain_context'
import { ethers, isAddress } from 'ethers'
import { TickMath, encodeSqrtRatioX96,  Pool, Position, nearestUsableTick, FeeAmount } from '@uniswap/v3-sdk'
import { Token, CurrencyAmount} from '@uniswap/sdk-core'
import { useSearchParams } from 'next/navigation'

type PositionData = 
{
  tokenId: bigint
  token0: string
  token1: string
  pool: string
  tickLower: number
  tickUpper: number
  currentTick: number
  liquidity: bigint
  currentPrice: number
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint
  token0Amount0: string
  token1Amount1: string
}

const tickToPrice = (tick: number): number => 
{
    const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick)
    const numerator = JSBI.multiply(sqrtPriceX96, sqrtPriceX96)
    const denominator = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(192))
    return Number(JSBI.toNumber(numerator)) / Number(JSBI.toNumber(denominator))
}

const sqrtPToPriceNumber = (sqrtPriceX96: bigint): number => 
{
    const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))
    const sqrtPriceJSBI = JSBI.BigInt(sqrtPriceX96.toString())
    const sqrtPrice = JSBI.toNumber(sqrtPriceJSBI) / JSBI.toNumber(Q96)
    return sqrtPrice * sqrtPrice
}

export function useDebounceEffect(callback: () => void, deps: any[], delay: number) 
{
    useEffect(() => 
    {
        const handler = setTimeout(() => 
        {
            callback()
        }, delay)

        return () => clearTimeout(handler)
    }, [...deps, delay])
}

export default function PositionDetails() 
{
    const {account, provider, signer, isConnected, connectWallet, deploymentAddresses, contracts, getPoolContract} = UseBlockchain()
    const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(null)
    const searchParams = useSearchParams()
    const [tokenId, setTokenId] = useState<bigint | null>(null)


    const loadPositionDetails = async (position_id: bigint) => 
    {
        if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract) 
        {
            const manager = contracts.UniswapV3NFTManagerContract
            const address = await signer.getAddress()

            try 
            {
            const owner = await manager.ownerOf(position_id)
            if (owner.toLowerCase() !== address.toLowerCase()) return null

            const extracted = await manager.positions(position_id)
            const poolAddress = extracted.pool

            const pool = new ethers.Contract(poolAddress, UniswapV3Pool.abi, signer)
            const [token0Address, token1Address, feeRaw] = await Promise.all
            ([
                pool.token0(),
                pool.token1(),
                pool.fee()
            ])
            const fee = Number(feeRaw)

            const token0Contract = new ethers.Contract(token0Address, ERC20Mintable.abi, signer)
            const token1Contract = new ethers.Contract(token1Address, ERC20Mintable.abi, signer)
            const [symbol0, symbol1, decimals0, decimals1] = await Promise.all
            ([
                token0Contract.symbol(),
                token1Contract.symbol(),
                token0Contract.decimals(),
                token1Contract.decimals()
            ])

            const slot0 = await pool.slot0()
            const tick = Number(slot0.tick)
            const sqrtPriceX96 = slot0.sqrtPriceX96
            const price = sqrtPToPriceNumber(sqrtPriceX96)

            const positionKey = ethers.keccak256
            (
                ethers.solidityPacked(
                ['address', 'int24', 'int24'],
                [manager.target, extracted.lowerTick, extracted.upperTick]
                )
            )

            const positionOnPool = await pool.positions(positionKey)
            const liquidity = positionOnPool.liquidity.toString()

            const token0 = new Token(1, token0Address, Number(decimals0), symbol0)
            const token1 = new Token(1, token1Address, Number(decimals1), symbol1)

            const poolSdk = new Pool(token0, token1, fee, sqrtPriceX96.toString(), liquidity, tick)

            const positionEntity = new Position
            ({
                pool: poolSdk,
                liquidity: liquidity,
                tickLower: Number(extracted.lowerTick),
                tickUpper: Number(extracted.upperTick)
            })

            const amount0 = positionEntity.amount0.toFixed()
            const amount1 = positionEntity.amount1.toFixed()

            const positionData: PositionData = 
            {
                tokenId: position_id,
                token0: symbol0,
                token1: symbol1,
                pool: poolAddress,
                tickLower: Number(extracted.lowerTick),
                tickUpper: Number(extracted.upperTick),
                currentTick: tick,
                currentPrice: price,
                liquidity: positionOnPool.liquidity,
                feeGrowthInside0LastX128: positionOnPool.feeGrowthInside0LastX128,
                feeGrowthInside1LastX128: positionOnPool.feeGrowthInside1LastX128,
                tokensOwed0: positionOnPool.tokensOwed0,
                tokensOwed1: positionOnPool.tokensOwed1,
                token0Amount0: amount0,
                token1Amount1: amount1
            }

                console.log('single position:', positionData)
                return positionData
            } 
            catch (error) 
            {
                console.log(error)
                return null
            }
        }
        return null
    }

    const fetchPosition = async () => 
    {
        const data = await loadPositionDetails(tokenId ?? 0n)
        console.log(data)
        if (data) setSelectedPosition(data)
    }

    useEffect(() => 
    {
        const tokenIdParam = searchParams.get('tokenId')
        if (tokenIdParam) {
            try 
            {
                setTokenId(BigInt(tokenIdParam))
            } 
            catch (e) 
            {
                console.warn("Invalid tokenId param", tokenIdParam)
            }
        }
    }, [searchParams])

    useDebounceEffect(() => 
    {
        fetchPosition()
    }, [tokenId, signer, contracts, deploymentAddresses], 500)

    return (
        <>
            {selectedPosition && (
            <>
            <h1 className="text-xl font-bold mb-2">
            Token ID: {selectedPosition.tokenId.toString()}
            </h1>
            <p>Token Pair: {selectedPosition.token0} / {selectedPosition.token1}</p>
            <p>Current Price: {selectedPosition.currentPrice}</p>
            <p>Min Price: {tickToPrice(selectedPosition.tickLower)}</p>
            <p>Max Price: {tickToPrice(selectedPosition.tickUpper)}</p>
            <p>Liquidity: {selectedPosition.liquidity.toString()}</p>
            <p>
            Owed Tokens: {selectedPosition.tokensOwed0.toString()} {selectedPosition.token0} /{' '}
            {selectedPosition.tokensOwed1.toString()} {selectedPosition.token1}
            </p>
            <p>
            Tokens Added: {selectedPosition.token0Amount0} {selectedPosition.token0} /{' '}
            {selectedPosition.token1Amount1} {selectedPosition.token1}
            </p>
            </>
            )}
        </>
    )
}
