"use client"
import { useEffect, useState } from 'react'
import { UseBlockchain } from '../context/blockchain_context'
import { Button, Group, Box, Text, Flex, Card, Table } from '@mantine/core'
import { IconPlus, IconComet } from '@tabler/icons-react'
import { useRouter } from "next/navigation"
import { ethers, isAddress } from 'ethers'
import UniswapV3Pool from '../../../contracts/UniswapV3Pool.json'

const pools = 
[
  { id: 1, pool: "ETH/USDT", tvl: "$50M", apr: "12%", volume: "$5M" },
  { id: 2, pool: "BTC/ETH", tvl: "$75M", apr: "8.5%", volume: "$7.5M" },
  { id: 3, pool: "SOL/USDC", tvl: "$30M", apr: "15%", volume: "$3M" },
  { id: 4, pool: "AVAX/DAI", tvl: "$20M", apr: "10%", volume: "$2M" },
  { id: 5, pool: "MATIC/USDT", tvl: "$15M", apr: "18%", volume: "$1.5M" },
]

type PositionData = 
{
  tokenId: bigint
  pool: string
  tickLower: number
  tickUpper: number
  liquidity: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint
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

  export default function PositionMain() 
  {
    const {account, provider, signer, isConnected, connectWallet, deploymentAddresses, contracts, getPoolContract} = UseBlockchain()
    const [uniswapV3NFTManagerContract, setUniswapV3NFTManagerContract] = useState<ethers.Contract | null>(null)

    const loadPositions = async () => 
    {
      if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract) 
      {
        const uniswapV3NFTManagerContract = contracts.UniswapV3NFTManagerContract

        const totalSupply: bigint = await uniswapV3NFTManagerContract.totalSupply()

        const allPositions: PositionData[] = []

        for (let tokenId = 0n; tokenId < totalSupply; tokenId++) 
        {
          try 
          {
            const pos = await uniswapV3NFTManagerContract.positions(tokenId)
            const poolAddress = pos.pool

            const poolContract = new ethers.Contract(poolAddress, UniswapV3Pool.abi, provider)

            const key = ethers.keccak256
            (
              ethers.solidityPacked(["address", "int24", "int24"], [uniswapV3NFTManagerContract.target, pos.lowerTick, pos.upperTick])
            )

            const position = await poolContract.positions(key)

            allPositions.push
            ({
              tokenId,
              pool: poolAddress,
              tickLower: Number(pos.lowerTick),
              tickUpper: Number(pos.upperTick),
              liquidity: position.liquidity,
              feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
              feeGrowthInside1LastX128: position.feeGrowthInside1LastX128,
              tokensOwed0: position.tokensOwed0,
              tokensOwed1: position.tokensOwed1
            })
          } 
          catch (error) 
          {
            console.log(`Error on tokenId ${tokenId.toString()}:`, error)
            continue
          }
        }

        console.log("all positions:", allPositions)
      }
    }

  useDebounceEffect(() => 
  {
    loadPositions()
  }, [signer, contracts, deploymentAddresses], 500)

  const router = useRouter()

  const HandleNavigation = () => 
  {
      router.push("/position_main/position_create")
  }

const removeLiquidity = async () => 
{
  if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract) 
  {
    try 
    {
      const uniswapV3NFTManagerContract = contracts.UniswapV3NFTManagerContract
      const tokenId = 0n
      const liquidityToRemove = BigInt("1566553709122544960774") / 4n

      const tx = await uniswapV3NFTManagerContract.removeLiquidity
      ({
        tokenId,
        liquidity: liquidityToRemove,
      })

      console.log("Transaction sent, waiting for confirmation...")      
      const receipt = await tx.wait()
      console.log(receipt)
    } 
    catch (error) 
    {
      console.log(error)
    }
  } 
}


  const rows = pools.map((pool) => 
  (
      <Table.Tr key={pool.id}>
        <Table.Td>
          <Text size="md">
            {pool.id}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="md">
            {pool.pool}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="md">
            {pool.tvl}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="md">
            {pool.apr}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="md">
            {pool.volume}
          </Text>
        </Table.Td>
      </Table.Tr>
  ))


  return (

      <Flex ml={200} mt={50} className="flex flex-col space-y-4 p-4 border-none rounded-lg shadow-md w-4/10 max-w-md ml-1/4">
      <Button
      fullWidth
      radius="md"
      className="mt-[5%]"
      onClick={() => removeLiquidity()}
      >
      Remove liquidity
      </Button>
      
      <Box className="flex flex-wrap bg-gray-100 p-4 rounded-lg">
        <Text size="xl" fw={750} c="#4f0099" mt={10}>
          Your positions
        </Text>
      </Box>
      
      <Box mt={20} className="flex justify-start space-x-[1%]">
        <Button size="md" variant="filled" rightSection={<IconPlus size={20} />} onClick={HandleNavigation}>New</Button>
      </Box>

      <Card shadow="sm" padding="lg" radius="md" withBorder mt={20}>

      <IconComet size={40}/>

          <Text size="lg" c="black" mt={10}>
              Welcome to your positions
          </Text>

          <Text size="md" c="dimmed" mt={10}>
              Connect your wallet to view your current position
          </Text>
      </Card>

      <Table highlightOnHover withColumnBorders mt={50}>
          <Table.Thead>
              <Table.Tr>
                  <Table.Th>
                    <Text fw={700} size="lg">
                      #
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={700} size="lg">
                      Pool
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={700} size="lg">
                      TVL
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={700}size="lg">
                      APR
                    </Text>
                  </Table.Th> 
                  <Table.Th>
                    <Text fw={700} size="lg">
                      1D Vol
                    </Text>
                  </Table.Th>
              </Table.Tr>
          </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
      </Table>

    </Flex>
  )
}