"use client"
import { useSelector, useDispatch } from 'react-redux'
import type { AppDispatch } from "../redux/store"
import { blockchainSelector } from '../redux/blockchain_selectors'
import { useEffect, useState, useRef } from 'react'
import { connectWallet, loadBlockchainPositions } from '../redux/blockchain_slice'
import { Button, Group, Box, Text, Flex, Card, Table, TextInput, UnstyledButton, Badge, ScrollArea } from '@mantine/core'
import { IconPlus, IconComet } from '@tabler/icons-react'
import { useRouter } from "next/navigation"
import { ethers, isAddress } from 'ethers'
import UniswapV3Pool from '../../../contracts/UniswapV3Pool.json'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import { TickMath, encodeSqrtRatioX96,  Pool, Position, nearestUsableTick, FeeAmount } from '@uniswap/v3-sdk'
import { Token, CurrencyAmount} from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import {PositionData, sqrtPToPriceNumber, tickToPrice, roundIfCloseToWhole } from '../utils/compute_token_utils'
import { generateSignedToken } from "../utils/token_utils"

const pools = 
[
  { id: 1, pool: "ETH/USDT", tvl: "$50M", apr: "12%", volume: "$5M" },
  { id: 2, pool: "BTC/ETH", tvl: "$75M", apr: "8.5%", volume: "$7.5M" },
  { id: 3, pool: "SOL/USDC", tvl: "$30M", apr: "15%", volume: "$3M" },
  { id: 4, pool: "AVAX/DAI", tvl: "$20M", apr: "10%", volume: "$2M" },
  { id: 5, pool: "MATIC/USDT", tvl: "$15M", apr: "18%", volume: "$1.5M" },
]

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
  const dispatch = useDispatch<AppDispatch>()
  const { signer, contracts, positions: Positions } = useSelector(blockchainSelector)
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState(-1)
  const viewportRef = useRef<HTMLDivElement>(null)

useDebounceEffect(() => 
{
  if (signer && contracts) 
  {
    dispatch(loadBlockchainPositions())
  }
}, [signer, contracts, dispatch], 500)

const getRangeStatus = (tick: number, tickLower: number, tickUpper: number) => 
{
  if (tick < tickLower) return { status: 'Below Range', color: 'red' }
  if (tick >= tickUpper) return { status: 'Above Range', color: 'red' }
  return { status: 'In Range', color: 'green' }
}

const router = useRouter()

const HandleNavigation = () => 
{
    router.push("/position_main/position_create")
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

const filteredPositions = Positions?.filter((position) => 
{
  const pair = `${position.token0}/${position.token1}`.toLowerCase()
  return pair.includes(query.toLowerCase()) || position.token0.toLowerCase().includes(query.toLowerCase()) || position.token1.toLowerCase().includes(query.toLowerCase())
}) ?? []

return (

    <Flex ml={200} mt={50} className="flex flex-col space-y-4 p-4 border-none rounded-lg shadow-md w-4/10 max-w-md ml-1/4">
    
    <Box className="flex flex-wrap bg-gray-100 p-4 rounded-lg">
      <Text size="xl" fw={750} c="#4f0099" mt={10}>
        Your positions
      </Text>
    </Box>
    
    <Box mt={20} className="flex justify-start space-x-[1%]">
      <Button size="md" variant="filled" rightSection={<IconPlus size={20} />} onClick={HandleNavigation}>New</Button>
    </Box>

    {signer ? (
      <Card withBorder shadow="sm" radius="md" p="md" mt={25}>
          <TextInput
          mt={10}
          placeholder="Search token pair (e.g., ETH, LINK)"
          value={query}
          onChange={(event) => 
          {
            setQuery(event.currentTarget.value)
            setHovered(-1)
          }}
          onKeyDown={(event) => 
          {
            if (event.key === 'ArrowDown') 
              {
                event.preventDefault()
                setHovered((prev) => 
                {
                  const next = Math.min(prev + 1, filteredPositions.length - 1)
                  viewportRef.current?.querySelectorAll('[data-list-item]')?.[next]?.scrollIntoView({ block: 'nearest' })
                  return next
                })
              }
            if (event.key === 'ArrowUp') 
            {
              event.preventDefault()
              setHovered((prev) => 
              {
                const next = Math.max(prev - 1, 0)
                viewportRef.current?.querySelectorAll('[data-list-item]')?.[next]?.scrollIntoView({ block: 'nearest' })
                return next
              })
            }
          }}
        />

          <ScrollArea h={300} type="always" mt="md" viewportRef={viewportRef}>
            {filteredPositions.map((position, index) => 
            {
              const { status: rangeStatus, color: badgeColor } = getRangeStatus
              (
                position.currentTick,
                position.tickLower,
                position.tickUpper
              )

              return (
                <UnstyledButton
                  key={position.tokenId.toString()}
                  onClick={async () => 
                  {
                      const token = await generateSignedToken(position.tokenId.toString(), ethers.formatUnits(position.token0Amount0), ethers.formatUnits(position.token1Amount1))
                      if (token) 
                      {
                        router.push(`/position_main/position_details?token=${token}`);
                      }
                  }}
                  data-list-item
                  display="block"
                  bg={index === hovered ? 'var(--mantine-color-blue-light)' : undefined}
                  w="100%"
                  p={5}
                >
                  <Card withBorder shadow="sm" radius="md" p="md">
                    <Group mb="xs">
                      <Text fw={600}>
                        {position.token0} / {position.token1}
                      </Text>
                      <Badge color={badgeColor}>{rangeStatus}</Badge>
                    </Group>

                    {/* <Text size="sm" color="dimmed">Token ID: {position.tokenId.toString()}</Text> */}
                      <Text size="sm">Current Price: {roundIfCloseToWhole(String(position.currentPrice))}</Text>
                    <Text size="sm">Min: {roundIfCloseToWhole(String(position.minPrice))}</Text>
                    <Text size="sm">Max: {roundIfCloseToWhole(String(position.maxPrice))}</Text>
                    {/* <Text size="sm">Liquidity: {position.liquidity.toString()}</Text> */}
                    <Text size="sm">
                    Tokens added: {roundIfCloseToWhole(ethers.formatUnits(position.token0Amount0))} {position.token0} / {roundIfCloseToWhole(ethers.formatUnits(position.token1Amount1))} {position.token1}
                    </Text>

                    <Text size="sm">
                    Tick Lower: {(position.tickLower.toString())}
                    </Text>

                    <Text size="sm">
                    Tick Upper: {(position.tickUpper.toString())}
                    </Text>

                    <Text size="sm">
                    Liquidity: {(position.liquidity.toString())}
                    </Text>

                    <Text size="sm">
                    Fees earned: {roundIfCloseToWhole(ethers.formatUnits(position.tokensOwed0))} {position.token0} / {roundIfCloseToWhole(ethers.formatUnits(position.tokensOwed1))} {position.token1}
                    </Text>
                  </Card>
                </UnstyledButton>
              )
            })}
        </ScrollArea>
      </Card>
    ): 
    (
      <Card shadow="sm" padding="lg" radius="md" withBorder mt={20}>

      <IconComet size={40}/>

          <Text size="lg" c="black" mt={10}>
              Welcome to your positions
          </Text>

          <Text size="md" c="dimmed" mt={10}>
              Connect your wallet to view your current position
          </Text>
      </Card>
    )}


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