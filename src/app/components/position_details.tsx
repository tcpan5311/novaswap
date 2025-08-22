"use client"
import { useState, useEffect } from 'react'
import { Grid, Tabs, Button, Group, Box, Text, Flex, Card, Input, Table, TextInput, UnstyledButton, Breadcrumbs, Badge, ScrollArea, ActionIcon, Divider, Modal, LoadingOverlay } from '@mantine/core'
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
import {PositionData, sqrtPToPriceNumber, priceToTick, tickToPrice, roundIfCloseToWhole, computeTokenAmount, updateTokenAmounts, handleTokenInputDisplay} from '../utils/compute_token_utils'
import { validateAmounts, validatePercent } from '../utils/validator_utils'
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,} from "recharts"
import { fetchVerifyToken } from '../utils/token_utils'

const quickSelectOptions = 
[
    { label: '25%', value: 25 },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: 'Max', value: 100 },
]

const mockData = 
[
    { name: "Day 1", value: 400 },
    { name: "Day 2", value: 300 },
    { name: "Day 3", value: 600 },
    { name: "Day 4", value: 800 },
    { name: "Day 5", value: 500 },
    { name: "Day 6", value: 700 },
]

const tabData = 
[
    { value: '1d', label: '1D' },
    { value: '1w', label: '1W' },
    { value: '1m', label: '1M' },
    { value: '1y', label: '1Y' },
    { value: 'all', label: 'All Time' },
]

const nftTabData = 
[
    { value: 'Chart', label: 'Chart' },
    { value: 'Nft', label: 'NFT' },
]

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

    const [nftManagerContractAddress, setNftManagerContractAddress] = useState('')
    const [uniswapV3FactoryContract, setUniswapV3FactoryContract] = useState<ethers.Contract | null>(null)

    const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(null)
    const searchParams = useSearchParams()
    const [tokenId, setTokenId] = useState<bigint | null>(null)
    const [opened1, { open: originalOpen1, close: originalClose1 }] = useDisclosure(false)
    const [opened2, { open: originalOpen2, close: originalClose2 }] = useDisclosure(false)

    const [percent, setPercent] = useState<number | null>(null)
    const [percentInput, setPercentInput] = useState<string>('')
    const router = useRouter()

    const [token0Amount, setToken0Amount] = useState<string>('')
    const [token1Amount, setToken1Amount] = useState<string>('')
    
    const [lastEditedField, setLastEditedField] = useState<"token0" | "token1" | null>(null)

    const [hideToken0DuringChange, setHideToken0DuringChange] = useState(false)
    const [hideToken1DuringChange, setHideToken1DuringChange] = useState(false)

    const [loading, setLoading] = useState(false)

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

    const open2 = () => 
    {
        originalOpen2()
    }

    const close2 = () => 
    {
        originalClose2()
        setPercent(null)
        setPercentInput("")
    }

    const loadPositionDetails = async (position_id: bigint) => 
    {
        if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract) 
        {
            setNftManagerContractAddress(deploymentAddresses?.UniswapV3NFTManagerAddress ?? "")
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
                    minPrice: tickToPrice(Number(extracted.lowerTick)),
                    maxPrice: tickToPrice(Number(extracted.upperTick)),
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
            selectedPosition.minPrice,
            selectedPosition.maxPrice,
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
            selectedPosition.minPrice,
            selectedPosition.maxPrice,
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
                selectedPosition.minPrice,
                selectedPosition.maxPrice,
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
        const tokenParam = searchParams.get("token")
        if (!tokenParam) return

        const fetchPosition = async () => 
        {
            const { tokenId, error } = await fetchVerifyToken(tokenParam)

            if (tokenId) 
            {
                setTokenId(BigInt(tokenId))
                const data = await loadPositionDetails(BigInt(tokenId))
                setSelectedPosition(data)
            } 
        }

    fetchPosition()
    }, [searchParams])

    useDebounceEffect(() => 
    {
        fetchPosition()
    }, [tokenId, signer, contracts, deploymentAddresses], 500)

    useDebounceEffect(() => 
    {
        runAllUpdates()
    }, [signer, contracts, deploymentAddresses, token0Amount, token1Amount, lastEditedField], 500)

    const getRangeStatus = (tick: number, tickLower: number, tickUpper: number) => 
    {
        if (tick < tickLower) return { status: 'Below Range', color: 'red' }
        if (tick >= tickUpper) return { status: 'Above Range', color: 'red' }
        return { status: 'In Range', color: 'green' }
    }
    const { status: rangeStatus, color: rangeColor } = getRangeStatus(selectedPosition?.currentTick ?? 0, selectedPosition?.tickLower ?? 0, selectedPosition?.tickUpper ?? 0)
    
    const approveTokenTransaction = async (tokenAddress: string | null, spenderAddress: string, amount: string, signer: ethers.Signer) => 
    {
        const approveTokenContract = new ethers.Contract(tokenAddress ?? (() => { throw new Error("Token address is required in approveTokenTransaction")})(), ERC20Mintable.abi, signer)
        const parsedAmount = ethers.parseEther(amount)
        await approveTokenContract.approve(spenderAddress, parsedAmount)
    }

    const addLiquidity = async () => 
    {
        if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract && tokenId !== null && selectedPosition) 
        {
            console.log(selectedPosition?.token0Address, selectedPosition?.token1Address, token0Amount, token1Amount)
            const token0Amount_ = token0Amount
            const token1Amount_ = token1Amount
            setLoading(true)
            
            try
            {
                const uniswapV3NFTManagerContract = contracts.UniswapV3NFTManagerContract     
                const amount0Desired = ethers.parseEther(token0Amount_)
                const amount1Desired = ethers.parseEther(token1Amount_)

                if (parseFloat(token0Amount) > 0) 
                {
                    await approveTokenTransaction(selectedPosition?.token0Address, nftManagerContractAddress, token0Amount_, signer)
                }
                if (parseFloat(token1Amount) > 0) 
                {
                    await approveTokenTransaction(selectedPosition?.token1Address, nftManagerContractAddress, token1Amount_, signer)
                }

                const addLiquidityParams = 
                {
                    tokenId,
                    amount0Desired,
                    amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0
                }

                const nftManagerAddLiquidity = await uniswapV3NFTManagerContract?.addLiquidity(addLiquidityParams)
                const nftManagerAddLiquidityTx = await nftManagerAddLiquidity.wait()
                console.log(nftManagerAddLiquidityTx)

            }
            catch(error)
            {
                console.log(error)
            }
            finally
            {
                close1()
                setLoading(false)
            }
        }

    }

    const removeLiquidity = async () => 
    {
        if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract && tokenId !== null) 
        {
            setLoading(true)
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
            finally
            {
                close2()
                setLoading(false)
            }
        } 
    }

    return (
        <Box pos="relative">
            {selectedPosition && (
            <>
                <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ fixed: true, radius: "sm", blur: 2 }} />
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

                                <Badge color={rangeColor} ml={10}>
                                    {rangeStatus}
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

                    <Grid gutter={{ base: 20, md: 64 }} mt={20} px={8}>
                        <Grid.Col span={{ base: 12, md: 7 }}>
                            <Card className="h-[400px] w-full">
                                <Box className="w-full h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={mockData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} dot={false} />
                                    </LineChart>
                                    </ResponsiveContainer>
                                </Box>

                            </Card>

                            <Grid gutter="md" mt={10} ml={50}>
                                <Grid.Col span={6}>
                                    <Tabs color="grape" variant="pills" radius="xl" defaultValue="1d" mt={10}
                                    styles=
                                    {{
                                        list: {
                                        border: '2px solid purple', 
                                        padding: '2px',             
                                        borderRadius: '25px',      
                                    },
                                    }}>
                                        <Tabs.List justify="center" grow>
                                            {tabData.map(tab => 
                                            (
                                                <Tabs.Tab key={tab.value} value={tab.value} className="w-5 text-center">
                                                    {tab.label}
                                                </Tabs.Tab>
                                            ))}
                                        </Tabs.List>
                                    </Tabs>
                                </Grid.Col>

                                <Grid.Col span={2}></Grid.Col>

                                <Grid.Col span={4}>
                                    <Tabs color="grape" variant="pills" radius="xl" defaultValue="Chart" mt={10}
                                    styles=
                                    {{
                                        list: {
                                        border: '2px solid purple', 
                                        padding: '2px',             
                                        borderRadius: '25px',      
                                    },
                                    }}>                                    
                                        <Tabs.List justify="center" grow>
                                        {nftTabData.map(tab => 
                                        (
                                            <Tabs.Tab key={tab.value} value={tab.value} className="w-5 text-center">
                                                {tab.label}
                                            </Tabs.Tab>
                                        ))}
                                        </Tabs.List>
                                    </Tabs>
                                </Grid.Col>
                            </Grid>

                            <Grid gutter="md" mt={20} ml={55}>
                                <Grid.Col span={12}>
                                    <Text fw={700} size="xl">
                                    Price Range
                                    </Text>
                                </Grid.Col>

                                <Grid.Col span={4}>
                                    <Text fw={700} size="md" c="dimmed">
                                        Min price
                                    </Text>
                                    <Text fw={700}>
                                        {selectedPosition.minPrice}
                                    </Text>
                                </Grid.Col>
                                <Grid.Col span={4}>
                                    <Text fw={700} size="md" c="dimmed">
                                        Max price
                                    </Text>
                                    <Text fw={700}>
                                        {selectedPosition.maxPrice}
                                    </Text>
                                </Grid.Col>
                                <Grid.Col span={4}>
                                    <Text fw={700} size="md" c="dimmed">
                                        Market price
                                    </Text>
                                </Grid.Col>
    
                            </Grid>
                        </Grid.Col>

                        <Grid.Col span={{ base: 12, md: 5 }} className="flex flex-col items-center gap-5">
                            <Card className="w-9/10 flex flex-col items-start p-4" shadow="md" padding="lg" radius="md">
                                <Grid>
                                    <Grid.Col span={8}>
                                        <Text fw={700} size="xl">
                                        Position
                                        </Text>
                                    </Grid.Col>
                                    <Grid.Col span={4} /> 
                                </Grid>

                                <Grid>
                                    <Grid.Col span={8} mt={10}>
                                        <Text size="40px" fw={500}>
                                        $145.76
                                        </Text>
                                    </Grid.Col>
                                    <Grid.Col span={4} /> 
                                </Grid>

                                <Grid align="center" mt={20}>
                                    <Grid.Col span={6}>
                                        <Group gap="xs" align="center">
                                        <IconCoinFilled size={30} color="purple" />
                                        <Text fw={700} size="md" truncate  c="dimmed">
                                            {selectedPosition.token0} position
                                        </Text>
                                        </Group>
                                    </Grid.Col>
                                    <Grid.Col span={6}>
                                        <Text fw={700} size="md" c="black" ta="right">
                                        {roundIfCloseToWhole(selectedPosition.token0Amount0)}
                                        </Text>
                                    </Grid.Col>

                                    <Grid.Col span={6}>
                                        <Group gap="xs" align="center">
                                        <IconCoinFilled size={30} color="purple" />
                                        <Text fw={700} size="md" truncate c="dimmed">
                                            {selectedPosition.token1} position
                                        </Text>
                                        </Group>
                                    </Grid.Col>
                                    <Grid.Col span={6}>
                                        <Text fw={700} size="md" c="black" ta="right">
                                        {roundIfCloseToWhole(selectedPosition.token1Amount1)}
                                        </Text>
                                    </Grid.Col>
                                </Grid>

                            </Card>

                            <Card className="w-9/10 flex flex-col items-start p-4" shadow="md" padding="lg" radius="md" mt={20}>
                                <Text fw={700} size="lg">Fees earned</Text>
                                <Text mt={2}>$0</Text>
                                <Text mt={1} size="sm" c="dimmed">You have no earnings yet</Text>
                            </Card>

                        </Grid.Col>
                    </Grid>

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

                        <Badge color={rangeColor} ml={10}>
                            {rangeStatus}
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
                    onClick={addLiquidity}
                    disabled={!validateAmounts(token0Amount, token1Amount)}>
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

                        <Badge color={rangeColor} ml={10}>
                            {rangeStatus}
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
                    onClick={removeLiquidity}
                    disabled={!validatePercent(percentInput)}>
                    Remove liquidity
                    </Button>

                </Modal>

            </>
            )}
        </Box>
    )
}
