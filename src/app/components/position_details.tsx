"use client"
import { useState, useEffect } from 'react'
import { Button, Group, Box, Text, Flex, Card, Input, Table, TextInput, UnstyledButton, Breadcrumbs, Badge, ScrollArea, ActionIcon, Divider, Modal } from '@mantine/core'
import JSBI from 'jsbi'
import UniswapV3Pool from '../../../contracts/UniswapV3Pool.json'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import { UseBlockchain } from '../context/blockchain_context'
import { ethers, isAddress } from 'ethers'
import { TickMath, encodeSqrtRatioX96,  Pool, Position, nearestUsableTick, FeeAmount } from '@uniswap/v3-sdk'
import { Token, CurrencyAmount} from '@uniswap/sdk-core'
import { useSearchParams } from 'next/navigation'
import { IconCoinFilled, IconArrowLeft } from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { useRouter } from 'next/navigation'
import {roundIfCloseToWhole, computeTokenAmount, updateTokenAmounts, handleTokenInputDisplay} from '../utils/position_details/compute_token_utils'

type PositionData = 
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

const quickSelectOptions = 
[
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: 'Max', value: 100 },
]

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

const validatePercentInput = (input: string): number | null => 
{
    input = input.trim()

    if (input === "") return null

    let parsed = parseInt(input, 10)

    if (isNaN(parsed)) return null

    if (parsed > 100 || parsed === 0) 
    {
        return 1
    }

    return parsed
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
    const [uniswapV3FactoryContract, setUniswapV3FactoryContract] = useState<ethers.Contract | null>(null)

    const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(null)
    const searchParams = useSearchParams()
    const [tokenId, setTokenId] = useState<bigint | null>(null)
    const [opened1, { open: originalOpen1, close: originalClose1 }] = useDisclosure(false)
    const [opened2, { open: open2, close: close2 }] = useDisclosure(false)

    const [percent, setPercent] = useState<number | null>(null)
    const [percentInput, setPercentInput] = useState<string>('')
    const router = useRouter()

    const [token0Amount, setToken0Amount] = useState<string>('')
    const [token1Amount, setToken1Amount] = useState<string>('')
    
    const [lastEditedField, setLastEditedField] = useState<"token0" | "token1" | null>(null)

    const [hideToken0DuringChange, setHideToken0DuringChange] = useState(false)
    const [hideToken1DuringChange, setHideToken1DuringChange] = useState(false)

    const open1 = () => 
    {
        originalOpen1()
        runAllUpdates()
    }

    const close1 = () => 
    {
        originalClose1()
        setToken0Amount("")
        setToken1Amount("")
    }

    const loadPositionDetails = async (position_id: bigint) => 
    {
        if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract) 
        {
            setUniswapV3FactoryContract(contracts?.UniswapV3FactoryContract ?? null)
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
                    token0Address: token0Address,
                    token1Address: token1Address,
                    token0: symbol0,
                    token1: symbol1,
                    fee: fee,
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

    const runAllUpdates = async () => 
    {
        const hasSelectedPosition = selectedPosition != null
        const hasToken0 = selectedPosition?.token0Address != null && selectedPosition.token0Address !== ""
        const hasToken1 = selectedPosition?.token1Address != null && selectedPosition.token1Address !== ""
        const hasFee = selectedPosition?.fee != null
        const hasCurrentPoolPrice = selectedPosition?.currentPrice != null

        if (!provider || !signer || !deploymentAddresses || !hasSelectedPosition || !hasToken0 || !hasToken1 || !hasFee || !hasCurrentPoolPrice) 
        {
            return
        }

        await handleTokenInputDisplay
        (
            selectedPosition.token0Address,  
            selectedPosition.token1Address, 
            selectedPosition.fee,
            tickToPrice(selectedPosition.tickLower),
            tickToPrice(selectedPosition.tickUpper),
            selectedPosition.currentPrice,
            computeTokenAmount,
            setHideToken0DuringChange,
            setHideToken1DuringChange,
            provider,
            signer,
            uniswapV3FactoryContract,
            getPoolContract
        )
        
        if (lastEditedField === "token0") 
        {
            await updateTokenAmounts(
            true,
            token0Amount,
            selectedPosition.token0Address,
            selectedPosition.token1Address,
            selectedPosition.fee,
            tickToPrice(selectedPosition.tickLower),
            tickToPrice(selectedPosition.tickUpper),
            selectedPosition.currentPrice,
            computeTokenAmount,
            setToken0Amount,
            setToken1Amount,
            lastEditedField,
            token0Amount,
            token1Amount,
            provider,
            signer,
            uniswapV3FactoryContract,
            getPoolContract
            )
        }
        if (lastEditedField === "token1") 
        {
            await updateTokenAmounts
            (
                false,
                token1Amount,
                selectedPosition.token0Address,
                selectedPosition.token1Address,
                selectedPosition.fee,
                tickToPrice(selectedPosition.tickLower),
                tickToPrice(selectedPosition.tickUpper),
                selectedPosition.currentPrice,
                computeTokenAmount,
                setToken0Amount,
                setToken1Amount,
                lastEditedField,
                token0Amount,
                token1Amount,
                provider,
                signer,
                uniswapV3FactoryContract,
                getPoolContract
            )
        }
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

    useDebounceEffect(() => 
    {
        runAllUpdates()
    }, [signer, contracts, deploymentAddresses, token0Amount, token1Amount, lastEditedField], 500)

    const addLiquidity = async () =>
    {
        console.log("Hello world")
    }

    const removeLiquidity = async () => 
    {
        if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract && tokenId !== null) 
        {
            try 
            {
                const uniswapV3NFTManagerContract = contracts.UniswapV3NFTManagerContract
                const totalLiquidity = selectedPosition?.liquidity ?? 0n

                const liquidityToRemove = (totalLiquidity * BigInt(percent?? 0)) / 100n

                const removeLiquidityTx = await uniswapV3NFTManagerContract.removeLiquidity
                ({
                    tokenId,
                    liquidity: liquidityToRemove
                })

                console.log("Remove liquidity tx sent, waiting for confirmation...")      
                const removeLiquidityReceipt = await removeLiquidityTx.wait()
                console.log(removeLiquidityReceipt)

                const collectFeeTx = await uniswapV3NFTManagerContract.collect
                ({
                    tokenId,
                    amount0: selectedPosition?.tokensOwed0,
                    amount1: selectedPosition?.tokensOwed1
                })

                console.log("Collect tx sent, waiting for confirmation...")
                const collectFeeReceipt = await collectFeeTx.wait()
                console.log(collectFeeReceipt)

                console.log("Liquidity removed and tokens collected successfully.")
            } 
            catch (error) 
            {
                console.log(error)
            }
        } 
    }


    return (
        <>
            {selectedPosition && (
            <>
                <Flex className="flex flex-col space-y-4 p-4 border-none rounded-lg shadow-md mx-auto mt-12 w-full sm:w-[90%] md:w-[70%] lg:w-[50%] xl:w-[40%]">

                    <Box className="flex flex-wrap p-4"mt={15} ml={15}>
                        <Text
                        key="positions"
                        className="cursor-pointer flex items-center gap-4"
                        size="lg"
                        fw={750}
                        c="#4f0099"
                        onClick={() => router.push('/position_main')}
                        >
                        <IconArrowLeft size={20} />
                        Your positions
                        </Text>
                    </Box>

                    <Card>
                        <div className="flex flex-wrap items-center w-full gap-y-4">
                            <Box mt={10} mb={{ base: 2, sm: 0 }} mr="auto" className="flex items-center space-x-2">
                                <ActionIcon radius="xl">
                                    <IconCoinFilled size={40} />
                                </ActionIcon>

                                <Text ml={10} className="whitespace-nowrap">
                                    {selectedPosition.token0} / {selectedPosition.token1}
                                </Text>

                                <Badge color="purple" ml={10}>
                                    <Text>{selectedPosition.fee}</Text>
                                </Badge>
                            </Box>

                            <Box mt={10} className="sm:mt-5 md:mt-5">
                                <Button radius="md" size="sm" onClick={() => open1()}>
                                    Add liquidity
                                </Button>
                                <Button radius="md" size="sm" ml={10} onClick={() => open2()}>
                                    Remove liquidity
                                </Button>
                            </Box>
                        </div>
                        <Divider size="lg" color="purple" mt={10} />
                    </Card>
                </Flex>

                <Modal
                opened={opened1}
                onClose={close1}
                title={<Text fw={750} c="#4f0099">Add liquidity</Text>}
                closeOnClickOutside={false}
                closeOnEscape={false}
                size="md"
                centered
                >
                    <Box mt={10} mb={{ base: 2, sm: 0 }} mr="auto" className="flex items-center space-x-2">
                        <ActionIcon radius="xl">
                            <IconCoinFilled size={40} />
                        </ActionIcon>

                        <Text ml={10} className="whitespace-nowrap">
                            {selectedPosition.token0} / {selectedPosition.token1}
                        </Text>

                        <Badge color="purple" ml={10}>
                            <Text>{selectedPosition.fee}</Text>
                        </Badge>
                    </Box>

                    {!hideToken0DuringChange && (
                        <Input
                        mt={20}
                        size="xl"
                        placeholder="0"
                        value={token0Amount}
                        onChange={async (event) => 
                        {
                            const input = event.currentTarget.value
                            if (/^\d*\.?\d*$/.test(input)) 
                            {
                                setToken0Amount(input)
                                setLastEditedField("token0")
                            }
                        }}
                        rightSection=
                        {
                            <Group align="center">
                                <Text>
                                {selectedPosition.token0} 
                                </Text>
                                <ActionIcon radius="xl">
                                <IconCoinFilled size={40} />
                                </ActionIcon>
                            </Group>
                        }
                        rightSectionWidth={100}
                        />
                    )}

                    {!hideToken1DuringChange && (
                        <Input
                        mt={20}
                        size="xl"
                        placeholder="0"
                        value={token1Amount}
                        onChange={async (event) => 
                        {
                            const input = event.currentTarget.value;
                            if (/^\d*\.?\d*$/.test(input)) 
                            {
                                setToken1Amount(input)
                                setLastEditedField("token1")
                            }
                        }}
                        rightSection=
                        {
                            <Group align="center">
                                <Text>
                                {selectedPosition.token1} 
                                </Text>
                                <ActionIcon radius="xl">
                                <IconCoinFilled size={40} />
                                </ActionIcon>
                            </Group>
                        }
                        rightSectionWidth={100}
                        />
                    )}

                    <Box mt={10}>
                        <Group justify="space-between">
                            <Text fw={700} size="md"  c="purple">
                            {selectedPosition.token0}
                            </Text>
                            <Text fw={700} size="md"  c="purple">
                            {roundIfCloseToWhole(selectedPosition.token0Amount0)}
                            </Text>
                        </Group>

                        <Group justify="space-between">
                            <Text fw={700} size="md"  c="purple">
                            {selectedPosition.token1}
                            </Text>
                            <Text fw={700} size="md"  c="purple">
                            {roundIfCloseToWhole(selectedPosition.token1Amount1)}
                            </Text>
                        </Group>
                    </Box>

                    <Button
                    fullWidth
                    radius="md"
                    className="mt-[5%]"
                    onClick={addLiquidity}>
                    Add liquidity
                    </Button>

                </Modal>

                <Modal
                opened={opened2}
                onClose={close2}
                title={<Text fw={750} c="#4f0099">Remove liquidity</Text>}
                closeOnClickOutside={false}
                closeOnEscape={false}
                size="md"
                centered
                >

                    <Box mt={10} mb={{ base: 2, sm: 0 }} mr="auto" className="flex items-center space-x-2">
                        <ActionIcon radius="xl">
                            <IconCoinFilled size={40} />
                        </ActionIcon>

                        <Text ml={10} className="whitespace-nowrap">
                            {selectedPosition.token0} / {selectedPosition.token1}
                        </Text>

                        <Badge color="purple" ml={10}>
                            <Text>{selectedPosition.fee}</Text>
                        </Badge>
                    </Box>

                    <Box mt={10}
                        style=
                        {{
                            border: '2px solid #ccc',
                            borderRadius: '12px',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                        }}
                    >
                        <Text size="sm" fw={500} c="dimmed">
                        Withdrawal amount
                        </Text>

                        <Input
                        value={percentInput}
                        placeholder="0.00"
                        styles={{
                            input: 
                            {
                                fontSize: '1.8rem',
                                fontWeight: 500,
                                border: 'none',
                                outline: 'none',
                                padding: 0,
                            },
                        }}

                        onChange={(event) => 
                        {
                            const percentInputRegex = /^\d*$/ // only digits allowed
                            const input = event.target.value.replace('%', '')

                            if (input === '') 
                            {
                                setPercentInput('')
                                setPercent(null)
                                return
                            }

                            if (percentInputRegex.test(input)) 
                            {
                                setPercentInput(input + '%')

                                const parsedInput = validatePercentInput(input)
                                if (parsedInput !== null) 
                                {
                                    setPercent(parsedInput)
                                    setPercentInput(parsedInput + '%')
                                }
                            }
                        }}
                        />



                        <Group gap="xs" mt={10}>
                        {quickSelectOptions.map(({ label, value }) => 
                        (
                            <Button
                            key={label}
                            variant="light"
                            size="xs"
                            radius="xl"
                            style={{ flex: 1 }}
                            onClick={() => 
                            {
                                const validated = validatePercentInput(value.toString())
                                if (validated !== null) 
                                {
                                    setPercent(validated)
                                    setPercentInput(validated + '%')
                                }
                            }}
                            >
                            {label}
                            </Button>
                        ))}
                        </Group>
                    </Box>

                    <Box mt={10}>
                    <Group justify="space-between">
                        <Text fw={700} size="md"  c="purple">
                        {selectedPosition.token0}
                        </Text>
                        <Text fw={700} size="md"  c="purple">
                        {roundIfCloseToWhole(selectedPosition.token0Amount0)}
                        </Text>
                    </Group>

                    <Group justify="space-between">
                        <Text fw={700} size="md"  c="purple">
                        {selectedPosition.token1}
                        </Text>
                        <Text fw={700} size="md"  c="purple">
                        {roundIfCloseToWhole(selectedPosition.token1Amount1)}
                        </Text>
                    </Group>
                    </Box>

                    <Button
                    fullWidth
                    radius="md"
                    className="mt-[5%]"
                    onClick={removeLiquidity}>
                    Remove liquidity
                    </Button>

                </Modal>

            </>
            )}
        </>
    )
}
