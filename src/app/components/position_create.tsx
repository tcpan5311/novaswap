"use client"
import { useState, useRef, useEffect, useMemo } from 'react'
import { LoadingOverlay, Button, Group, Box, Text, Flex, Card, Table, Breadcrumbs, Grid, Stepper, MultiSelect, Modal, Input, NumberInput, Stack, ActionIcon, Textarea, ScrollArea, UnstyledButton, Tabs, Select, Badge} from '@mantine/core'
// import { LineChart } from '@mantine/charts'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts"
import { IconPlus, IconMinus, IconCoinFilled, IconChevronDown, IconSearch, IconPercentage, IconChevronUp, IconTagPlus } from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import JSBI from 'jsbi'
import { ethers, isAddress } from 'ethers'
import { useRouter } from 'next/navigation'
import { UseBlockchain } from '../context/blockchain_context'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import UniswapV3Pool from '../../../contracts/UniswapV3Pool.json'
import { TickMath, encodeSqrtRatioX96,  Pool, Position, nearestUsableTick, FeeAmount } from '@uniswap/v3-sdk'
import { Token, CurrencyAmount} from '@uniswap/sdk-core'
import {handleMinPriceMove, handleMaxPriceMove, handleMouseUp, handleMinPrice, handleMaxPrice, handleMinClick, handleMaxClick} from '../utils/position_create/price_range_utils'
import {shouldAllowStep, processStepClick, processStepChange } from '../utils/position_create/stepper_utils'
import {CryptocurrencyDetail, TokenSetter, validateFirstStep, validateFullFirstStep, validateSecondStep} from '../utils/validator_utils'
import {PositionData, priceToSqrtPBigNumber, sqrtPToPriceNumber, priceToSqrtP, priceToTick, tickToPrice, roundIfCloseToWhole, computeTokenAmount, updateTokenAmounts, handleTokenInputDisplay} from '../utils/compute_token_utils'

let cryptocurrencies: CryptocurrencyDetail[] = []

const feeStructure = 
[
    { label: 0.01, value: 100, description: 'Best for very stable pairs.' },
    { label: 0.05, value: 500, description: 'Best for stable pairs.' },
    { label: 0.3, value: 3000, description: 'Best for most pairs.' },
    { label: 1, value: 10000, description: 'Best for exotic pairs.' },
]

const data = 
[
    { date: "Mar 22", Price: 3000 },
    { date: "Mar 23", Price: 4500 },
    { date: "Mar 24", Price: 6200 },
    { date: "Mar 24", Price: 7000 },
    { date: "Mar 27", Price: 8500 },
    { date: "Mar 28", Price: 10000 },
]

type data = {date: string; Price: number}

const getPriceRange = (data: data[]): {highestPrice: number; lowestPrice: number, graphMaxPrice: number; graphMinPrice: number} => 
{
    const prices = data.map((item: data) => item.Price)
    const highestPrice = Math.max(...prices)
    const lowestPrice = Math.min(...prices)
    
    const graphMaxPrice = highestPrice * 1.2
    const graphMinPrice = lowestPrice * 0.8

    return {
        highestPrice,
        lowestPrice,
        graphMaxPrice,
        graphMinPrice
    }
}

const getCanonicalOrder = (tokenA: CryptocurrencyDetail, tokenB: CryptocurrencyDetail) => 
{
    const token0First = tokenA.Address.toLowerCase() < tokenB.Address.toLowerCase()

    return token0First ? 
    {
        token0: tokenA,
        token1: tokenB
    }
    : 
    {
        token0: tokenB,
        token1: tokenA
    }
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
    
export default function PositionCreate() 
{
    const router = useRouter()
    const viewportRef = useRef<HTMLDivElement>(null)
    const [query, setQuery] = useState('')
    const filtered = cryptocurrencies.filter(item => item.Label.toLowerCase().includes(query.toLowerCase()))
    const [hovered, setHovered] = useState(-1)
    const [selectedToken0, setSelectedToken0] = useState<CryptocurrencyDetail | null>(null)
    const [selectedToken1, setSelectedToken1] = useState<CryptocurrencyDetail | null>(null)
    const [fee, setFee] = useState<number | null>(null)
    const {account, provider, signer, isConnected, connectWallet, deploymentAddresses, contracts, getPoolContract} = UseBlockchain()

    const [ethereumContractAddress, setEthereumContractAddress] = useState("")
    const [usdcContractAddress, setUsdcContractAddress] = useState("")
    const [uniswapContractAddress, setUniswapContractAddress] = useState("")
    const [factoryContractAddress, setFactoryContractAddress] = useState('')
    const [managerContractAddress, setManagerContractAddress] = useState('')
    const [nftManagerContractAddress, setNftManagerContractAddress] = useState('')
    const [quoterContractAddress, setQuoterContractAddress] = useState('')

    const [ethereumContract, setEthereumContract] = useState<ethers.Contract | null>(null)
    const [usdcContract, setUsdcContract] = useState<ethers.Contract | null>(null)
    const [uniswapContract, setUniswapContract] = useState<ethers.Contract | null>(null)
    const [uniswapV3FactoryContract, setUniswapV3FactoryContract] = useState<ethers.Contract | null>(null)
    const [uniswapV3ManagerContract, setUniswapV3ManagerContract] = useState<ethers.Contract | null>(null)
    const [uniswapV3NFTManagerContract, setUniswapV3NFTManagerContract] = useState<ethers.Contract | null>(null)
    const [uniswapV3QuoterContract, setUniswapV3QuoterContract] = useState<ethers.Contract | null>(null)

    const links = 
    [
        { title: 'Your positions', href: '/position_main' },
        { title: 'New position', href: '' }
    ]
    .map((link, index) => 
    (
        <Text className="cursor-pointer" size="md" fw={750} c="#4f0099" onClick={() => router.push(link.href)}>
            {link.title}
        </Text>
    ))

    const items = filtered.map((item, index) => 
    (
      <UnstyledButton
        data-list-item
        key={item.Address}
        display="block"
        w="100%"
        p={5}
      >
      {item.Label}
      </UnstyledButton>
    ))

    //For handling of modal opening and closing
    const [opened1, { open: open1, close: close1 }] = useDisclosure(false)
    const [opened2, { open: open2, close: close2 }] = useDisclosure(false)

    //For setting liquidity price range
    let {highestPrice, lowestPrice, graphMaxPrice, graphMinPrice } = getPriceRange(data)

    const [rangeType, setRangeType] = useState<"full_range" | "custom_range">("full_range")

    const [initialPrice, setInitialPrice] = useState(0)
    const [initialPriceInput, setInitialPriceInput] = useState<string>(initialPrice.toString())

    const [minPrice, setMinPrice] = useState(0)
    const [maxPrice, setMaxPrice] = useState(0)

    const [minPriceInput, setMinPriceInput] = useState<string>(minPrice.toString())
    const [maxPriceInput, setMaxPriceInput] = useState<string>(maxPrice.toString())

    const [token0Amount, setToken0Amount] = useState<string>('')
    const [token1Amount, setToken1Amount] = useState<string>('')

    const [draggingType, setDraggingType] = useState<"min" | "max" | null>(null)
    const chartRef = useRef<HTMLDivElement>(null)

    const [isFirstStepValid, setIsFirstStepValid] = useState(false)
    const [isSecondStepValid, setIsSecondStepValid] = useState(false)
    const [secondStepError, setSecondStepError] = useState<string>("")

    const [token0Balance, setToken0Balance] = useState<string>("0")
    const [token1Balance, setToken1Balance] = useState<string>("0")

    const [requireInitialPrice, setRequireInitialPrice] = useState<boolean | null>(null)

    const [hideToken0DuringChange, setHideToken0DuringChange] = useState(false)
    const [hideToken1DuringChange, setHideToken1DuringChange] = useState(false)

    const [lastEditedField, setLastEditedField] = useState<"token0" | "token1" | null>(null)
    const [loading, setLoading] = useState(false)

    const [tokenSelection, setTokenSelection] = useState({displayToken0Name: '', displayToken1Name: '', displayFee: 0})

    const loadData = async () => 
    {
        if (signer && deploymentAddresses && contracts) 
        {
            setEthereumContractAddress(deploymentAddresses?.EthereumAddress ?? "")
            setUsdcContractAddress(deploymentAddresses?.USDCAddress ?? "")
            setUniswapContractAddress(deploymentAddresses?.UniswapAddress ?? "")
            setFactoryContractAddress(deploymentAddresses?.UniswapV3FactoryAddress ?? "")
            setManagerContractAddress(deploymentAddresses?.UniswapV3ManagerAddress ?? "")
            setNftManagerContractAddress(deploymentAddresses?.UniswapV3NFTManagerAddress ?? "")
            setQuoterContractAddress(deploymentAddresses?.UniswapV3QuoterAddress ?? "")

            setEthereumContract(contracts?.EthereumContract ?? null)
            setUsdcContract(contracts?.USDCContract ?? null)
            setUniswapContract(contracts?.UniswapContract ?? null)
            setUniswapV3FactoryContract(contracts?.UniswapV3FactoryContract ?? null)
            setUniswapV3ManagerContract(contracts?.UniswapV3ManagerContract ?? null)
            setUniswapV3NFTManagerContract(contracts?.UniswapV3NFTManagerContract ?? null)
            setUniswapV3QuoterContract(contracts?.UniswapV3QuoterContract ?? null)

            const [ethereumName, ethereumSymbol, usdcName, usdcSymbol, uniswapName, uniswapSymbol] = 
            await Promise.all
            ([
                contracts.EthereumContract?.name(), contracts.EthereumContract?.symbol(),
                contracts.USDCContract?.name(), contracts.USDCContract?.symbol(),
                contracts.UniswapContract?.name(), contracts.UniswapContract?.symbol()
            ])

            cryptocurrencies = 
            [
                { Label: `${ethereumName} (${ethereumSymbol})`, Address: deploymentAddresses?.EthereumAddress ?? "" },
                { Label: `${usdcName} (${usdcSymbol})`, Address: deploymentAddresses?.USDCAddress ?? "" },
                { Label: `${uniswapName} (${uniswapSymbol})`, Address: deploymentAddresses?.UniswapAddress ?? "" },
            ]
        }
    }

    const loadPositions = async (): Promise<PositionData[]> => 
    {
        const allPositions: PositionData[] = []
        if (signer && deploymentAddresses && contracts?.UniswapV3NFTManagerContract) 
        {
            const manager = contracts.UniswapV3NFTManagerContract
            const address = await signer.getAddress()
            const totalSupply: bigint = await manager.totalSupply()

            for (let tokenId = 0n; tokenId < totalSupply; tokenId++) 
            {
                try 
                {
                const owner = await manager.ownerOf(tokenId)
                if (owner.toLowerCase() !== address.toLowerCase()) continue

                const extracted = await manager.positions(tokenId)
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

                allPositions.push
                ({
                    tokenId,
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
                    token0Amount0: BigInt(positionEntity.amount0.quotient.toString()),
                    token1Amount1:  BigInt(positionEntity.amount1.quotient.toString())
                })
                } 
                catch (error) 
                {
                    console.log(error)
                }
            }
        }
        return allPositions
    }

    useDebounceEffect(() => 
    {
        loadData()
    }, [signer, contracts, deploymentAddresses], 500)
    

    useEffect(() => 
    {
        const attachListeners = async () => 
        {
            if (!isFirstStepValid) return
            
            let currentPrice = await getCurrentPoolPrice() ?? 0

            const wrappedHandleMinPriceMove = async (event: MouseEvent) => 
            {
                await handleMinPriceMove(event, chartRef, maxPrice, graphMaxPrice, graphMinPrice, currentPrice, setMinPrice, setMinPriceInput)
            }

            const wrappedHandleMaxPriceMove = async (event: MouseEvent) => 
            {
                await handleMaxPriceMove(event, chartRef, minPrice, graphMaxPrice, graphMinPrice, currentPrice, setMaxPrice, setMaxPriceInput)
            }

            const wrappedHandleMouseUp = () => 
            {
                handleMouseUp(setDraggingType, wrappedHandleMaxPriceMove, wrappedHandleMinPriceMove)
            }

            if (draggingType === "max") 
            {
                document.addEventListener("mousemove", wrappedHandleMaxPriceMove as any)
            } 
            else if (draggingType === "min") 
            {
                document.addEventListener("mousemove", wrappedHandleMinPriceMove as any)
            }

            document.addEventListener("mouseup", wrappedHandleMouseUp as any)

            return () => 
            {
                document.removeEventListener("mousemove", wrappedHandleMaxPriceMove as any)
                document.removeEventListener("mousemove", wrappedHandleMinPriceMove as any)
                document.removeEventListener("mouseup", wrappedHandleMouseUp as any)
            }
        }

        attachListeners()
    }, [draggingType, isFirstStepValid, minPrice, maxPrice])

    const handleMinPriceClick = async (direction: "increase" | "decrease") => 
    {
        const currentPrice = (await getCurrentPoolPrice()) ?? 0
        handleMinClick(direction, currentPrice, maxPrice, setMinPrice, setMinPriceInput)
    }

    const handleMaxPriceClick = async (direction: "increase" | "decrease") => 
    {
        const currentPrice = (await getCurrentPoolPrice()) ?? 0
        handleMaxClick(direction, currentPrice, minPrice, setMaxPrice, setMaxPriceInput)
    }

    useDebounceEffect(() => 
    {
        const runAllUpdates = async () => 
        {
            // Step 1: Basic validations
            if (!selectedToken0 || !selectedToken1 || !fee)
            {
                setIsFirstStepValid(false)
                setRequireInitialPrice(false)
                return
            }

            if (!validateFirstStep(selectedToken0.Address, selectedToken1.Address, fee))
            {
                setIsFirstStepValid(false)
                setRequireInitialPrice(false)
                return
            }

            // Step 2: Full first step validation
            const { isValid: firstStepValid, poolExists } = await validateFullFirstStep(
                selectedToken0.Address,
                selectedToken1.Address,
                fee,
                initialPrice,
                doesPoolExist
            )

            setIsFirstStepValid(firstStepValid)
            setRequireInitialPrice(!poolExists)

            if (!firstStepValid) return

            
            // Step 3: Validate min and max prices
            if (rangeType === "custom_range") 
            {
                await validateMinPrice()
                await validateMaxPrice()
            }

            // Step 4: Fetch balances
            fetchBalances(selectedToken0.Address, selectedToken1.Address)

            // Step 5: Get current pool price
            const currentPrice = await getCurrentPoolPrice() ?? 0

            let effectiveMinPrice: number
            let effectiveMaxPrice: number
            
            if (rangeType === "full_range") 
            {
                effectiveMinPrice = tickToPrice(TickMath.MIN_TICK)
                effectiveMaxPrice = tickToPrice(TickMath.MAX_TICK)
            } 
            else 
            {
                effectiveMinPrice = minPrice
                effectiveMaxPrice = maxPrice
            }

            // Step 6: Update token display
            await handleTokenInputDisplay(
                selectedToken0.Address,
                selectedToken1.Address,
                fee,
                effectiveMinPrice,
                effectiveMaxPrice,
                currentPrice,
                computeTokenAmount,
                setHideToken0DuringChange,
                setHideToken1DuringChange,
                provider,
                signer,
                uniswapV3FactoryContract,
                getPoolContract
            )

            // Step 7: Update token amounts based on last edited field
            if (lastEditedField === "token0")
            {
                await updateTokenAmounts(
                    true,
                    token0Amount,
                    selectedToken0.Address,
                    selectedToken1.Address,
                    fee,
                    effectiveMinPrice,
                    effectiveMaxPrice,
                    currentPrice,
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
                await updateTokenAmounts(
                    false,
                    token1Amount,
                    selectedToken0.Address,
                    selectedToken1.Address,
                    fee,
                    effectiveMinPrice,
                    effectiveMaxPrice,
                    currentPrice,
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

            // Step 8: Second step validation
            const { isValid, errorMessage } = await validateSecondStep(
                provider,
                signer,
                selectedToken0.Address,
                selectedToken1.Address,
                fee,
                effectiveMinPrice,
                effectiveMaxPrice,
                token0Amount,
                token1Amount,
                currentPrice,
                computeTokenAmount,
                uniswapV3FactoryContract,
                getPoolContract,
                (address, signerOrProvider) => new ethers.Contract(address, ERC20Mintable.abi, signerOrProvider)
            )

            setIsSecondStepValid(isValid)
            setSecondStepError(errorMessage || "")
        }

        runAllUpdates()

    }, [
        signer,
        contracts,
        deploymentAddresses,
        selectedToken0,
        selectedToken1,
        fee,
        initialPrice,
        minPrice,
        maxPrice,
        token0Amount,
        token1Amount,
        lastEditedField,
        isFirstStepValid,
        rangeType 
    ], 500)


    const handleTokenSelect = (selectedItem: CryptocurrencyDetail, currentToken: CryptocurrencyDetail | null, otherToken: CryptocurrencyDetail | null, setCurrentToken: TokenSetter, setOtherToken: TokenSetter, closeModal: () => void): void => 
    {
        if (!selectedItem) return

        if (otherToken?.Address === selectedItem.Address) 
        {
            setOtherToken(null)
            setCurrentToken(selectedItem)
        }
        else if (currentToken?.Address === selectedItem.Address) 
        {
            setCurrentToken(selectedItem)
        }
        else 
        {
            if (!otherToken && currentToken) 
            {
                setOtherToken(currentToken)
            }
            setCurrentToken(selectedItem)
        }

        closeModal()
    }

    //Stepper logic implementation
    const [stepActive, setStepActive] = useState(1)
    const [highestStepVisited, setHighestStepVisited] = useState(stepActive)

    const handleStepClick = (step: number) => 
    {
        processStepClick(step, highestStepVisited, setStepActive, selectedToken0, selectedToken1, fee, validateFirstStep, setSelectedToken0, setSelectedToken1, setFee, setInitialPrice, setInitialPriceInput, setMinPrice, setMaxPrice, setMinPriceInput, setMaxPriceInput, setToken0Amount, setToken1Amount, updateTokenSelection)
    }

    const shouldAllowSelectStep = (step: number) => 
    {
        return shouldAllowStep(step, highestStepVisited)
    }

    const handleNext = () => processStepChange(
        'next', 
        stepActive, 
        setStepActive, 
        setHighestStepVisited,
        getCurrentPoolPrice, 
        setSelectedToken0, 
        setSelectedToken1,
        setFee, 
        setInitialPrice, 
        setInitialPriceInput,
        setMinPrice, 
        setMaxPrice, 
        setMinPriceInput, 
        setMaxPriceInput,
        setToken0Amount, 
        setToken1Amount,
        updateTokenSelection
    )

    const handleBack = () => processStepChange(
        'back', 
        stepActive, 
        setStepActive, 
        setHighestStepVisited,
        getCurrentPoolPrice, 
        setSelectedToken0, 
        setSelectedToken1,
        setFee, 
        setInitialPrice, 
        setInitialPriceInput,
        setMinPrice, 
        setMaxPrice, 
        setMinPriceInput, 
        setMaxPriceInput,
        setToken0Amount, 
        setToken1Amount,
        updateTokenSelection
    )

    const updateTokenSelection = (shouldSet = true) => 
    {
        if (!selectedToken0 || !selectedToken1 || !fee) return

        if (shouldSet) 
        {
            const { token0, token1 } = getCanonicalOrder(selectedToken0, selectedToken1)
            setTokenSelection
            ({
                displayToken0Name: token0.Label,
                displayToken1Name: token1.Label,
                displayFee: fee
            })
        } 
        else 
        {
            setTokenSelection
            ({
                displayToken0Name: '',
                displayToken1Name: '',
                displayFee: 0
            })
        }
    }

    //Toggle visibility of set fee component
    const [isVisible, setIsVisible] = useState(true)

    const toggleVisibility = () => 
    {
        setIsVisible((prev) => !prev)
    }
    
    const validatePriceInput = (input: string, maxDecimalsForOneOrMore = 18): number | null => 
    {
        input = input.trim()

        if (input === "") return null

        const numericPattern = /^(\d+)?(\.\d*)?$/
        if (!numericPattern.test(input)) return null

        if (input.endsWith(".")) return null

        const parsed = parseFloat(input)
        if (isNaN(parsed) || parsed < 0) return null

        const decimals = input.includes(".") ? input.split(".")[1].length : 0

        if (parsed >= 1 && decimals > maxDecimalsForOneOrMore) return null

        return parsed
    }

    const validateMinPrice = async () => 
    {

        let currentPrice = await getCurrentPoolPrice() ?? 0
        const clampedMin = await handleMinPrice(currentPrice, maxPrice, setMinPrice)

        if (clampedMin != null)
        {
            setMinPriceInput(clampedMin.toString())
        }
    }

    const validateMaxPrice = async () => 
    {
        if(isFirstStepValid) 
        {
            let currentPrice = await getCurrentPoolPrice() ?? 0
            const clampedMax = await handleMaxPrice(currentPrice, minPrice, setMaxPrice)

            if (clampedMax != null)
            {
                setMaxPriceInput(clampedMax.toString())
            }
        }
    }

    const getCurrentPoolPrice = async () => 
    {
        if(uniswapV3FactoryContract && selectedToken0 && selectedToken1 && fee)
        {
            const poolExist = await doesPoolExist(selectedToken0.Address, selectedToken1.Address, fee)
            if (poolExist) 
            {
                try 
                {
                    const poolAddress = await uniswapV3FactoryContract.getPoolAddress(selectedToken0.Address, selectedToken1.Address, fee)
                    const poolCallContract = getPoolContract(poolAddress)
                    const slot0 = await poolCallContract?.slot0()
                    const sqrtPriceX96 = slot0.sqrtPriceX96
                    const price = sqrtPToPriceNumber(sqrtPriceX96)
                    return price
                } 
                catch (error) 
                {
                    console.log(error)
                    return null
                }
            }
            else
            {
                const price = initialPrice
                return price
            }
        }
    }

    const doesPoolExist = async (token0Address: string | null, token1Address: string | null, fee: number | null): Promise<boolean> => 
    {
        if (uniswapV3FactoryContract && token0Address && token1Address && fee) 
        {
            try 
            {
                const poolAddress = await uniswapV3FactoryContract.getPoolAddress(token0Address, token1Address, fee)
                return poolAddress !== '0x0000000000000000000000000000000000000000'
            } 
            catch (error) 
            {
                console.error("Error checking pool existence:", error)
                return false
            }
        }

        return false
    }

    const approveTokenTransaction = async (tokenAddress: string | null, spenderAddress: string, amount: string, signer: ethers.Signer) => 
    {
        const approveTokenContract = new ethers.Contract(tokenAddress ?? (() => { throw new Error("Token address is required in approveTokenTransaction")})(), ERC20Mintable.abi, signer)
        const parsedAmount = ethers.parseEther(amount)
        await approveTokenContract.approve(spenderAddress, parsedAmount)
    }

    const fetchBalances = async (token0Address: string | null, token1Address: string | null) => 
    {
        if (!signer) return

        try 
        {
            const signerAddress = await signer.getAddress() 

            let balance0 = "0"
            let displayBalance0 = "0"

            if (token0Address) 
            {
                const token0Contract = new ethers.Contract(token0Address, ERC20Mintable.abi, signer)
                const rawBalance0 = await token0Contract.balanceOf(signerAddress) 
                const symbol0 = await token0Contract.symbol()
                balance0 = ethers.formatEther(rawBalance0)
                displayBalance0 = `${balance0} ${symbol0}`
            }
            setToken0Balance(displayBalance0)

            let balance1 = "0"
            let displayBalance1 = "0"
            if (token1Address) 
            {
                const token1Contract = new ethers.Contract(token1Address, ERC20Mintable.abi, signer)
                const rawBalance1 = await token1Contract.balanceOf(signerAddress) 
                const symbol1 = await token1Contract.symbol()
                balance1 = ethers.formatEther(rawBalance1)
                displayBalance1 = `${balance1} ${symbol1}`
            }
            setToken1Balance(displayBalance1)
        } 
        catch (err) 
        {
            console.log("Failed to fetch token balances:")
        }
    }

    const findMatchingPosition = async (token0Address: string, token1Address: string, fee: number, lowerTick: number, upperTick: number, loadPositions: () => Promise<PositionData[]>): Promise<{ tokenId: bigint; position: PositionData } | null> => 
    {

        const token0Lower = token0Address.toLowerCase()
        const token1Lower = token1Address.toLowerCase()

        const positions = await loadPositions()
        console.log(positions)

        for (const position of positions) 
        {
            const positionToken0 = position.token0Address.toLowerCase()
            const positionToken1 = position.token1Address.toLowerCase()
            
            console.log({token0Lower, token1Lower, fee, lowerTick, upperTick})

            console.log("Checking position:", 
            {
                tokenId: position.tokenId.toString(),
                positionToken0,
                positionToken1,
                fee: position.fee,
                tickLower: position.tickLower,
                tickUpper: position.tickUpper
            })

            if 
            (
                positionToken0 === token0Lower &&
                positionToken1 === token1Lower &&
                position.fee === fee &&
                position.tickLower === lowerTick &&
                position.tickUpper === upperTick
            ) 

            {
                return { tokenId: position.tokenId, position }
            }
        }

        return null
    }
    
    const addLiquidity = async () => 
    {

        let currentPrice = await getCurrentPoolPrice() ?? 0

        if (isConnected && signer && deploymentAddresses && contracts && selectedToken0 && selectedToken1 && fee && minPrice && maxPrice && token0Amount && token1Amount) 
        {
            setLoading(true)
            const { token0, token1} = getCanonicalOrder(selectedToken0, selectedToken1)
            console.log(token0, token1, fee, currentPrice, token0Amount, token1Amount)

            try
            {
                const poolExist = await doesPoolExist(selectedToken0.Address, selectedToken1.Address, fee)
                if (!poolExist) 
                {
                    const factoryCreatePoolTx = await uniswapV3FactoryContract?.createPool(selectedToken0.Address, selectedToken1.Address, fee)
                    const factoryCreatePoolReceipt = await factoryCreatePoolTx.wait()
                    const poolAddress = await uniswapV3FactoryContract?.getPoolAddress(selectedToken0.Address, selectedToken1.Address, fee)
                    const poolCallContract = getPoolContract(poolAddress) 
                    const sqrtPriceX96 = priceToSqrtPBigNumber(currentPrice)
                    const poolInitializeTx = await poolCallContract?.initialize(sqrtPriceX96)
                    const poolInitializeTxReceipt = await poolInitializeTx.wait()
                    console.log(poolInitializeTxReceipt)
                }

                const amount0Desired = ethers.parseEther(token0Amount)
                const amount1Desired = ethers.parseEther(token1Amount)

                if (parseFloat(token0Amount) > 0) 
                {
                    await approveTokenTransaction(token0.Address, nftManagerContractAddress, token0Amount, signer)
                }
                if (parseFloat(token1Amount) > 0) 
                {
                    await approveTokenTransaction(token1.Address, nftManagerContractAddress, token1Amount, signer)
                }

                const lowerTick = rangeType === "full_range" ? -887272 : nearestUsableTick(priceToTick(minPrice), 60)
                const upperTick = rangeType === "full_range" ? 887272 : nearestUsableTick(priceToTick(maxPrice), 60)

                const matching = await findMatchingPosition
                (
                    token0.Address,
                    token1.Address,
                    fee,
                    lowerTick,
                    upperTick,
                    loadPositions 
                )

                if (matching) 
                {
                    console.log("Position exists")
                    const addLiquidityParams = 
                    {
                         tokenId: matching.tokenId,
                         amount0Desired,
                         amount1Desired,
                         amount0Min: 0,
                         amount1Min: 0
                     }

                    const nftManagerAddLiquidity = await uniswapV3NFTManagerContract?.addLiquidity(addLiquidityParams)
                    const nftManagerAddLiquidityTx = await nftManagerAddLiquidity.wait()
                    console.log(nftManagerAddLiquidityTx)
                }
                else
                {
                    console.log("Position does not exists")
                    const mintParams = 
                    {
                        recipient: await signer.getAddress(),
                        tokenA: token0.Address,
                        tokenB: token1.Address,
                        fee: fee,
                        lowerTick: nearestUsableTick(priceToTick(minPrice), 60),
                        upperTick: nearestUsableTick(priceToTick(maxPrice), 60),
                        amount0Desired,
                        amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0
                    }

                    const nftManagerMintLiquidity = await uniswapV3NFTManagerContract?.mint(mintParams)
                    const nftManagerMintLiquidityTx = await nftManagerMintLiquidity.wait()
                    console.log(nftManagerMintLiquidityTx)
                }

                handleBack()
                setLoading(false)
            }
            catch(error)
            {
                console.log(error)
                handleBack()
                setLoading(false)
            }
        }
    }

    const getTwapPrice = async () => 
    {
        const poolAddress = await uniswapV3FactoryContract?.getPoolAddress(selectedToken0?.Address, selectedToken1?.Address, fee)
        const poolContract = getPoolContract(poolAddress)
        
        const secondsAgos = [65, 0]
        const tickCumulatives = await poolContract?.observe(secondsAgos)
        console.log(tickCumulatives)
        const tickDifference = tickCumulatives[1] - tickCumulatives[0]
        const averageTick = BigInt(tickDifference) / BigInt(secondsAgos[0])
        console.log(tickToPrice(Number(averageTick)))
    }
    
    const quotePool = async () => 
    {   

        if (signer && deploymentAddresses && contracts) 
        {
            try
            {       
                const quoteParams =
                {
                    tokenIn: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                    tokenOut: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
                    fee: 3000,
                    amountIn: ethers.parseEther("0.1337"),
                    sqrtPriceLimitX96: priceToSqrtPBigNumber(4993)
                }

                const [amountOut, sqrtPriceX96After, tickAfter] = await uniswapV3QuoterContract?.quoteSingle.staticCall(quoteParams)
                console.log("amountOut:", ethers.formatUnits(amountOut, 18)) 
                console.log("sqrtPriceX96After:", sqrtPriceX96After.toString())
                console.log("tickAfter:", tickAfter.toString())
            }
            catch(error)
            {
                console.log(error)
            }
        }

    }

    const swapToken = async () => 
    {
        try
        {
            await ethereumContract?.approve(managerContractAddress,ethers.parseEther("1"))

            const swapParams = 
            {
                tokenIn: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                tokenOut: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
                fee: 3000,
                amountIn: ethers.parseEther("0.1337"),
                sqrtPriceLimitX96: priceToSqrtPBigNumber(4993)
            }

            const managerContractSwap = await uniswapV3ManagerContract?.swapSingle(swapParams)
            const managerContractSwapTx = await managerContractSwap.wait()
            console.log(managerContractSwapTx)
        }
        catch(error) 
        {
            console.log(error)
        }

    }

    return (
        <Box pos="relative">
            <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ fixed: true, radius: "sm", blur: 2 }} />
            {/* Test function for quotePool and swapToken */}
            <Button
            fullWidth
            radius="md"
            className="mt-[5%]"
            onClick={() => getTwapPrice()}
            >
            Test Twap
            </Button>

            <Button
            fullWidth
            radius="md"
            className="mt-[5%]"
            >
            Validate Sufficient Token
            </Button>

            <Grid ml={200} mt={50}>
                <Grid.Col span={12}>
                    <Box className="flex flex-wrap p-4">
                        <Breadcrumbs separator="→" separatorMargin="sm" mt="xs">
                            {links}
                        </Breadcrumbs>
                    </Box>
                </Grid.Col>

                <Grid.Col span={12}>
                    <Text className='!text-[30px]' fw={750} c="#4f0099" mt={10}>
                        New position
                    </Text>
                </Grid.Col>

                <Grid.Col span={{ base: 10, md: 10, lg: 4 }} mt={7}>
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Stepper active={stepActive} onStepClick={handleStepClick} orientation='vertical'>
                            <Stepper.Step
                                label="Step 1"
                                description="Select token pair and fees"
                                allowStepSelect={shouldAllowSelectStep(1)}
                            />
                            <Stepper.Step
                                label="Step 2"
                                description="Set price range and deposit amount"
                            />
                            <Stepper.Completed>
                                You are all set to add a new position!
                            </Stepper.Completed>
                        </Stepper>
                    </Card>
                </Grid.Col>

                {stepActive === 1 && 
                (
                    <Grid.Col span={{ base: 10, md: 10, lg: 5 }}>

                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Text size="lg" fw={600} c="#4f0099">Select Pair</Text>
                            <Text mt={10} size="sm" c="gray"> Choose the tokens you want to provide liquidity for.</Text>

                            <Flex
                            mt="md"
                            gap="md"
                            direction={{ base: "column", sm: "row" }}
                            wrap="wrap"
                            >
                            <div
                            className="cursor-pointer select-none"
                            onClick={() => open1()}
                            >
                            <Input
                                placeholder="Select token"
                                value={selectedToken0?.Label ?? ''}
                                readOnly
                                tabIndex={-1}
                                className="pointer-events-none"
                                rightSection={
                                <div className="flex flex-col gap-0.5 pointer-events-auto">
                                    <IconChevronUp size={12} stroke={1.5} />
                                    <IconChevronDown size={12} stroke={1.5} />
                                </div>
                                }
                                rightSectionWidth={30}
                            />
                            </div>

                            <div
                            className="cursor-pointer select-none"
                            onClick={() => open2()}
                            >
                            <Input
                                placeholder="Select token"
                                value={selectedToken1?.Label ?? ''}
                                readOnly
                                tabIndex={-1}
                                className="pointer-events-none"
                                rightSection={
                                <div className="flex flex-col gap-0.5 pointer-events-auto">
                                    <IconChevronUp size={12} stroke={1.5} />
                                    <IconChevronDown size={12} stroke={1.5} />
                                </div>
                                }
                                rightSectionWidth={30}
                            />
                            </div>
                            </Flex>

                            <Text size="lg" fw={600} c="#4f0099" mt={30}>Fee tier</Text>
                            <Text mt={10} size="sm" c="gray">The amount earned providing liquidity</Text>

                            <Card shadow="sm" radius="md" withBorder mt={20}>
                                <Stack>
                                    <Group wrap="wrap" justify='space-between'>
                                        <Box>
                                            <Text size="md" fw={600} c="#4f0099">
                                            Select fee tier
                                            </Text>
                                            <Text size="sm" c="gray">
                                            The % you earn in fees
                                            </Text>
                                        </Box>
                                        <Button rightSection={<IconChevronDown size={16} />} onClick={toggleVisibility}>
                                            More
                                        </Button>
                                    </Group>
                                    
                                </Stack>
                                
                            </Card>

                            {isVisible && (
                                
                                // <Input
                                // placeholder="Fee"
                                // rightSection={<IconPercentage size={20} />} 
                                // mt={20}
                                // value={fee}
                                // onChange={(event) => setFee(event.currentTarget.value)}
                                // />

                                <Flex justify="center" align="center" gap="xs" mt="md" className="mt-4 gap-2">
                                {feeStructure.map(({ label, value, description }) => 
                                {   
                                    const isSelected = fee === value
                                    return (
                                    <Card
                                    key={value}
                                    shadow="xs"
                                    padding="xs"
                                    onClick={() => setFee(value)}
                                    className={`flex-1 text-center cursor-pointer transition-all ${
                                    isSelected ? 'border-[#e0bfff]' : undefined}`}
                                    style={{backgroundColor: isSelected ? '#e0bfff' : undefined,}}
                                    >
                                    <Text size="sm" c="#4f0099" fw={700}>
                                        {label}%
                                    </Text>
                                    <Text size="xs" c="black" fw={400} mt={4}>
                                        {description}
                                    </Text>
                                    </Card>
                                    )

                                })}
                                </Flex>


                            )}

                            {requireInitialPrice && (
                                <>
                                <Text size="lg" fw={600} c="#4f0099" mt={30}>Starting Price</Text>
                                <Text mt={10} size="sm" c="gray">Set the initial price for this new pool. This will anchor all future trades, so choose accurately.</Text>
                                <Input
                                    mt={20}
                                    size="xl"
                                    placeholder=""
                                    value={initialPriceInput}
                                    onChange={(event) => 
                                    {
                                        const priceInputRegex = /^\d*\.?\d{0,4}$/
                                        const input = event.target.value

                                        if (input === '') 
                                        {
                                            setInitialPriceInput('')
                                            setInitialPrice(0)
                                            return
                                        }

                                        if (priceInputRegex.test(input)) 
                                        {
                                            setInitialPriceInput(input)

                                            const parsedInput = validatePriceInput(input, 18)
                                            if (parsedInput !== null) 
                                            {
                                                setInitialPrice(parsedInput)
                                            }
                                        }
                                    }}
                                    rightSection={
                                        <ActionIcon radius="xl">
                                            <IconTagPlus size={40} />
                                        </ActionIcon>
                                    }
                                    rightSectionWidth={100}
                                />
                                </>
                            )}

                            {isConnected ? (
                            <Button
                                fullWidth
                                radius="md"
                                className="mt-[5%]"
                                onClick={handleNext}
                                disabled={!isFirstStepValid}
                            >
                                Continue
                            </Button>
                            ) : (
                            <Button
                                fullWidth
                                radius="md"
                                className="mt-[5%]"
                                onClick={connectWallet}
                            >
                                Connect Wallet
                            </Button>
                            )}

                        </Card>
                    </Grid.Col>
                )}

                {stepActive === 2 && 
                (
                    <Grid.Col span={{ base: 10, md: 10, lg: 5 }}>
                        <Box>
                            <Card shadow="sm" padding="lg" radius="md" mt={10} withBorder>
                                <Group align="center">
                                    <ActionIcon radius="xl">
                                    <IconCoinFilled size={40} />
                                    </ActionIcon>
                                    <Text>
                                    {tokenSelection.displayToken0Name} / {tokenSelection.displayToken1Name}
                                    </Text>

                                    <Badge color="purple">
                                        <Text>{tokenSelection.displayFee}</Text>
                                    </Badge>
                                </Group>
                            </Card>

                            <Card shadow="sm" padding="lg" radius="md" mt={10} withBorder>
                            <Text size="lg" fw={600} c="#4f0099" mb={20}>Set price range</Text>
                                <Tabs
                                color="grape"
                                variant="pills"
                                radius="xl"
                                defaultValue="full_range"
                                c="#4f0099"
                                onChange={(value) => {
                                    const rangeType = value as "full_range" | "custom_range";
                                    setRangeType(rangeType);
                                }}
                                >
                                <Tabs.List justify="center" grow>
                                    <Tabs.Tab value="full_range">Full range</Tabs.Tab>
                                    <Tabs.Tab value="custom_range">Custom range</Tabs.Tab>
                                </Tabs.List>

                                <Tabs.Panel value="full_range">
                                    <div className="relative select-none" ref={chartRef}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis domain={[graphMinPrice, graphMaxPrice]} />
                                        <Tooltip />
                                        <ReferenceArea
                                            y1={graphMinPrice}
                                            y2={graphMaxPrice}
                                            fill="purple"
                                            fillOpacity={0.1}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="Price"
                                            stroke="purple"
                                            strokeWidth={3}
                                        />
                                        </LineChart>
                                    </ResponsiveContainer>
                                    </div>

                                    <Grid gutter="md" mt={15}>
                                    <Grid.Col span={{ base: 12, md: 12, lg: 6 }}>
                                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                                        <Flex justify="space-between" align="center">
                                            <Box>
                                            <Text c="#4f0099" size="sm" fw={700}>
                                                Min price
                                            </Text>
                                            <Input
                                                c="#4f0099"
                                                variant="unstyled"
                                                size="xl"
                                                value="0"
                                                readOnly
                                            />
                                            <Text c="#4f0099" size="sm">
                                                NEAR per ETH
                                            </Text>
                                            </Box>
                                        </Flex>
                                        </Card>
                                    </Grid.Col>

                                    <Grid.Col span={{ base: 12, md: 12, lg: 6 }}>
                                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                                        <Flex justify="space-between" align="center">
                                            <Box>
                                            <Text c="#4f0099" size="sm" fw={700}>
                                                Max price
                                            </Text>
                                            <Input
                                                c="#4f0099"
                                                variant="unstyled"
                                                size="xl"
                                                value="∞"
                                                readOnly
                                            />
                                            <Text c="#4f0099" size="sm">
                                                NEAR per ETH
                                            </Text>
                                            </Box>
                                        </Flex>
                                        </Card>
                                    </Grid.Col>
                                    </Grid>

                                    <Text size="lg" fw={600} c="#4f0099" mt={30}>
                                    Deposit tokens
                                    </Text>
                                    <Text mt={10} size="sm" c="gray">
                                    Specify the token amounts for your liquidity contribution.
                                    </Text>

                                    {!hideToken0DuringChange && (
                                    <Input
                                        mt={20}
                                        size="xl"
                                        placeholder="0"
                                        value={token0Amount}
                                        onChange={async (event) => {
                                        const input = event.currentTarget.value;
                                        if (/^\d*\.?\d*$/.test(input)) {
                                            setToken0Amount(input);
                                            setLastEditedField("token0");
                                        }
                                        }}
                                        rightSection={
                                        <Stack gap={0} align="start">
                                            <Group align="center">
                                            <Text>{tokenSelection.displayToken0Name}</Text>
                                            <ActionIcon radius="xl">
                                                <IconCoinFilled size={40} />
                                            </ActionIcon>
                                            </Group>
                                            <Text size="sm" c="dimmed" mt={5}>
                                            {token0Balance}
                                            </Text>
                                        </Stack>
                                        }
                                        rightSectionWidth={200}
                                        classNames={{
                                        input: "h-[90px] w-full text-2xl px-4 rounded-2xl",
                                        }}
                                    />
                                    )}

                                    {!hideToken1DuringChange && (
                                    <Input
                                        mt={20}
                                        size="xl"
                                        placeholder="0"
                                        value={token1Amount}
                                        onChange={async (event) => {
                                        const input = event.currentTarget.value;
                                        if (/^\d*\.?\d*$/.test(input)) {
                                            setToken1Amount(input);
                                            setLastEditedField("token1");
                                        }
                                        }}
                                        rightSection={
                                        <Stack gap={0} align="start">
                                            <Group align="center">
                                            <Text>{tokenSelection.displayToken1Name}</Text>
                                            <ActionIcon radius="xl">
                                                <IconCoinFilled size={40} />
                                            </ActionIcon>
                                            </Group>
                                            <Text size="sm" c="dimmed" mt={5}>
                                            {token1Balance}
                                            </Text>
                                        </Stack>
                                        }
                                        rightSectionWidth={200}
                                        classNames={{
                                        input: "h-[90px] w-full text-2xl px-4 rounded-2xl",
                                        }}
                                    />
                                    )}

                                    {isConnected ? (
                                    <Button
                                        fullWidth
                                        radius="md"
                                        className="mt-[5%]"
                                        disabled={!isSecondStepValid}
                                        onClick={addLiquidity}
                                    >
                                        {isSecondStepValid
                                        ? "Continue"
                                        : secondStepError === "insufficient_tokens"
                                        ? "Insufficient tokens"
                                        : "Incomplete fields"}
                                    </Button>
                                    ) : (
                                    <Button
                                        fullWidth
                                        radius="md"
                                        className="mt-[5%]"
                                        onClick={connectWallet}
                                    >
                                        Connect Wallet
                                    </Button>
                                    )}
                                </Tabs.Panel>

                                <Tabs.Panel value="custom_range">
                                    <div className="relative select-none" ref={chartRef}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis domain={[graphMinPrice, graphMaxPrice]} />
                                        <Tooltip />
                                        <ReferenceArea
                                            y1={Math.min(minPrice, maxPrice)}
                                            y2={Math.max(minPrice, maxPrice)}
                                            fill="purple"
                                            fillOpacity={0.1}
                                        />
                                        <ReferenceLine
                                            y={minPrice}
                                            stroke="red"
                                            strokeWidth={5}
                                            label={({ viewBox }) => (
                                            <g>
                                                <rect
                                                x={viewBox.width / 2 - 20}
                                                y={viewBox.y - 5}
                                                width="40"
                                                height="10"
                                                fill="purple"
                                                onMouseDown={() => setDraggingType("min")}
                                                cursor="ns-resize"
                                                />
                                                <text
                                                x={viewBox.width / 2 - 15}
                                                y={viewBox.y - 10}
                                                fill="purple"
                                                fontSize="11px"
                                                fontWeight="bold"
                                                >
                                                {`Min: ${minPrice.toPrecision(8)}`}
                                                </text>
                                            </g>
                                            )}
                                        />
                                        <ReferenceLine
                                            y={maxPrice}
                                            stroke="green"
                                            strokeWidth={5}
                                            label={({ viewBox }) => (
                                            <g>
                                                <rect
                                                x={viewBox.width / 2 - 20}
                                                y={viewBox.y - 5}
                                                width="40"
                                                height="10"
                                                fill="purple"
                                                onMouseDown={() => setDraggingType("max")}
                                                cursor="ns-resize"
                                                />
                                                <text
                                                x={viewBox.width / 2 - 15}
                                                y={viewBox.y - 15}
                                                fontSize="11px"
                                                fill="purple"
                                                fontWeight="bold"
                                                >
                                                {`Max: ${maxPrice.toPrecision(8)}`}
                                                </text>
                                            </g>
                                            )}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="Price"
                                            stroke="purple"
                                            strokeWidth={3}
                                        />
                                        </LineChart>
                                    </ResponsiveContainer>
                                    </div>

                                    <Grid gutter="md" mt={15}>
                                    <Grid.Col span={{ base: 12, md: 12, lg: 6 }}>
                                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                                        <Flex justify="space-between" align="center">
                                            <Box>
                                            <Text c="#4f0099" size="sm" fw={700}>
                                                Min price
                                            </Text>
                                            <Input
                                                c="#4f0099"
                                                variant="unstyled"
                                                size="xl"
                                                value={minPriceInput}
                                                onChange={(event) => {
                                                const priceInputRegex = /^\d*\.?\d{0,4}$/;
                                                const input = event.target.value;
                                                if (input === "") {
                                                    setMinPriceInput("");
                                                    setMinPrice(0);
                                                    return;
                                                }
                                                if (priceInputRegex.test(input)) {
                                                    setMinPriceInput(input);
                                                    const parsedInput = validatePriceInput(input, 18);
                                                    if (parsedInput !== null) {
                                                    setMinPrice(parsedInput);
                                                    }
                                                }
                                                }}
                                            />
                                            <Text c="#4f0099" size="sm">
                                                NEAR per ETH
                                            </Text>
                                            </Box>

                                            <Stack>
                                            <ActionIcon radius="xl" onClick={() => handleMinPriceClick("increase")}>
                                                <IconPlus size={20} />
                                            </ActionIcon>
                                            <ActionIcon radius="xl" onClick={() => handleMinPriceClick("decrease")}>
                                                <IconMinus size={20} />
                                            </ActionIcon>
                                            </Stack>
                                        </Flex>
                                        </Card>
                                    </Grid.Col>

                                    <Grid.Col span={{ base: 12, md: 12, lg: 6 }}>
                                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                                        <Flex justify="space-between" align="center">
                                            <Box>
                                            <Text c="#4f0099" size="sm" fw={700}>
                                                Max price
                                            </Text>
                                            <Input
                                                c="#4f0099"
                                                variant="unstyled"
                                                size="xl"
                                                value={maxPriceInput}
                                                onChange={(event) => {
                                                const priceInputRegex = /^\d*\.?\d{0,4}$/;
                                                const input = event.target.value;
                                                if (input === "") {
                                                    setMaxPriceInput("");
                                                    setMaxPrice(0);
                                                    return;
                                                }
                                                if (priceInputRegex.test(input)) {
                                                    setMaxPriceInput(input);
                                                    const parsedInput = validatePriceInput(input, 18);
                                                    if (parsedInput !== null) {
                                                    setMaxPrice(parsedInput);
                                                    }
                                                }
                                                }}
                                            />
                                            <Text c="#4f0099" size="sm">
                                                NEAR per ETH
                                            </Text>
                                            </Box>

                                            <Stack>
                                            <ActionIcon radius="xl" onClick={() => handleMaxPriceClick("increase")}>
                                                <IconPlus size={20} />
                                            </ActionIcon>
                                            <ActionIcon radius="xl" onClick={() => handleMaxPriceClick("decrease")}>
                                                <IconMinus size={20} />
                                            </ActionIcon>
                                            </Stack>
                                        </Flex>
                                        </Card>
                                    </Grid.Col>
                                    </Grid>

                                    <Text size="lg" fw={600} c="#4f0099" mt={30}>
                                    Deposit tokens
                                    </Text>
                                    <Text mt={10} size="sm" c="gray">
                                    Specify the token amounts for your liquidity contribution.
                                    </Text>

                                    {!hideToken0DuringChange && (
                                    <Input
                                        mt={20}
                                        size="xl"
                                        placeholder="0"
                                        value={token0Amount}
                                        onChange={async (event) => {
                                        const input = event.currentTarget.value;
                                        if (/^\d*\.?\d*$/.test(input)) {
                                            setToken0Amount(input);
                                            setLastEditedField("token0");
                                        }
                                        }}
                                        rightSection={
                                        <Stack gap={0} align="start">
                                            <Group align="center">
                                            <Text>{tokenSelection.displayToken0Name}</Text>
                                            <ActionIcon radius="xl">
                                                <IconCoinFilled size={40} />
                                            </ActionIcon>
                                            </Group>
                                            <Text size="sm" c="dimmed" mt={5}>
                                            {token0Balance}
                                            </Text>
                                        </Stack>
                                        }
                                        rightSectionWidth={200}
                                        classNames={{
                                        input: "h-[90px] w-full text-2xl px-4 rounded-2xl",
                                        }}
                                    />
                                    )}

                                    {!hideToken1DuringChange && (
                                    <Input
                                        mt={20}
                                        size="xl"
                                        placeholder="0"
                                        value={token1Amount}
                                        onChange={async (event) => {
                                        const input = event.currentTarget.value;
                                        if (/^\d*\.?\d*$/.test(input)) {
                                            setToken1Amount(input);
                                            setLastEditedField("token1");
                                        }
                                        }}
                                        rightSection={
                                        <Stack gap={0} align="start">
                                            <Group align="center">
                                            <Text>{tokenSelection.displayToken1Name}</Text>
                                            <ActionIcon radius="xl">
                                                <IconCoinFilled size={40} />
                                            </ActionIcon>
                                            </Group>
                                            <Text size="sm" c="dimmed" mt={5}>
                                            {token1Balance}
                                            </Text>
                                        </Stack>
                                        }
                                        rightSectionWidth={200}
                                        classNames={{
                                        input: "h-[90px] w-full text-2xl px-4 rounded-2xl",
                                        }}
                                    />
                                    )}

                                    {isConnected ? (
                                    <Button
                                        fullWidth
                                        radius="md"
                                        className="mt-[5%]"
                                        disabled={!isSecondStepValid}
                                        onClick={addLiquidity}
                                    >
                                        {isSecondStepValid
                                        ? "Continue"
                                        : secondStepError === "insufficient_tokens"
                                        ? "Insufficient tokens"
                                        : "Incomplete fields"}
                                    </Button>
                                    ) : (
                                    <Button
                                        fullWidth
                                        radius="md"
                                        className="mt-[5%]"
                                        onClick={connectWallet}
                                    >
                                        Connect Wallet
                                    </Button>
                                    )}
                                </Tabs.Panel>
                                </Tabs>

                            </Card>

                        </Box>
                    </Grid.Col>
                )}

            </Grid>

            <Modal
            opened={opened1}
            onClose={close1}
            title={<Text fw={750} c="#4f0099">Select a token</Text>}
            closeOnClickOutside={false}
            closeOnEscape={false}
            size="md"
            centered
            >
                <Input
                placeholder="Search token"
                leftSection={<IconSearch size={16} />}
                value={query}
                onChange={(event) => 
                {
                  setQuery(event.currentTarget.value)
                  setHovered(-1)
                }}
                />
                <ScrollArea h={150} type="always" mt="md" viewportRef={viewportRef}>
                {filtered.map((item) => (
                    <UnstyledButton
                    key={item.Address}
                    data-list-item
                    display="block"
                    onClick={() => 
                    {
                        handleTokenSelect(item, selectedToken0, selectedToken1, setSelectedToken0, setSelectedToken1, close1)
                    }}
                    >
                    {item.Label}
                    </UnstyledButton>
                ))}
                </ScrollArea>
            </Modal>

            <Modal
            opened={opened2}
            onClose={close2}
            title={<Text fw={750} c="#4f0099">Select a token</Text>}
            closeOnClickOutside={false}
            closeOnEscape={false}
            size="md"
            centered
            >
                <Input
                placeholder="Search token"
                leftSection={<IconSearch size={16} />}
                onChange={(event) => 
                {
                    setQuery(event.currentTarget.value)
                    setHovered(-1)
                }}
                />
                <ScrollArea h={150} type="always" mt="md" viewportRef={viewportRef}>
                {filtered.map((item) => (
                    <UnstyledButton
                    key={item.Address}
                    data-list-item
                    display="block"
                    onClick={() => 
                    {
                        handleTokenSelect(item, selectedToken1, selectedToken0, setSelectedToken1, setSelectedToken0, close2)
                    }}
                    >
                    {item.Label}
                    </UnstyledButton>
                ))}
                </ScrollArea>
            </Modal>

        </Box>

    )
}