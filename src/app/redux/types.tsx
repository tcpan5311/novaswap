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