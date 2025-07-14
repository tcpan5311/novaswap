"use client"
import { useState, useRef, useEffect, useMemo } from 'react'
import { Button, Group, Box, Text, Flex, Card, Table, Breadcrumbs, Grid, Stepper, MultiSelect, Modal, Input, NumberInput, Stack, ActionIcon, Textarea, ScrollArea, UnstyledButton, Tabs, Select} from '@mantine/core'
// import { LineChart } from '@mantine/charts'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts"
import { IconPlus, IconMinus, IconCoinFilled, IconChevronDown, IconSearch, IconPercentage, IconChevronUp, IconTagPlus } from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import JSBI from 'jsbi'
import { ethers } from 'ethers'
import { useRouter } from 'next/navigation';
import { UseBlockchain } from '../context/blockchain_context'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import { TickMath, encodeSqrtRatioX96,  Pool, Position, nearestUsableTick, FeeAmount } from '@uniswap/v3-sdk'
import { Token, CurrencyAmount} from '@uniswap/sdk-core'
import {handleMinPriceMove, handleMaxPriceMove, handleMouseUp, handleMinPrice, handleMaxPrice} from '../utils/position_create/price_range_utils'
import {shouldAllowStep, processStepClick, processStepChange } from '../utils/position_create/stepper_utils'
import {CryptocurrencyDetail, TokenSetter, validateFirstStep, validateFullFirstStep, validateSecondStep} from '../utils/position_create/validator_utils'

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
    const [selectedToken1, setSelectedToken1] = useState<CryptocurrencyDetail | null>(null)
    const [selectedToken2, setSelectedToken2] = useState<CryptocurrencyDetail | null>(null)
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

    const [initialPrice, setInitialPrice] = useState(0)
    const [initialPriceInput, setInitialPriceInput] = useState<string>(initialPrice.toString())

    const [minPrice, setMinPrice] = useState(0)
    const [maxPrice, setMaxPrice] = useState(0)

    const [minPriceInput, setMinPriceInput] = useState<string>(minPrice.toString())
    const [maxPriceInput, setMaxPriceInput] = useState<string>(maxPrice.toString())

    const [token1Amount, setToken1Amount] = useState<string>('')
    const [token2Amount, setToken2Amount] = useState<string>('')

    const [token1Only, setToken1Only] = useState<boolean>(false)
    const [token2Only, setToken2Only] = useState<boolean>(false)

    const [draggingType, setDraggingType] = useState<"min" | "max" | null>(null)
    const chartRef = useRef<HTMLDivElement>(null)

    const [isFirstStepValid, setIsFirstStepValid] = useState(false)
    const [isSecondStepValid, setIsSecondStepValid] = useState(false)

    const [requireInitialPrice, setRequireInitialPrice] = useState<boolean | null>(null)

    const [hideToken1DuringChange, setHideToken1DuringChange] = useState(false)
    const [hideToken2DuringChange, setHideToken2DuringChange] = useState(false)

    const [lastEditedField, setLastEditedField] = useState<"token1" | "token2" | null>(null)

    useDebounceEffect(() => 
    {
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
        loadData()
    }, [signer, contracts, deploymentAddresses], 500)

    useEffect(() => {
    const attachListeners = async () => 
    {
        if (!isFirstStepValid) return
        
        const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)

        let currentPrice: number
        if (poolExist) 
        {
            currentPrice = await getCurrentPoolPrice() ?? 0
        } 
        else 
        {
            currentPrice = initialPrice
        }

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

    useDebounceEffect(() => 
    {
        const runAllUpdates = async () => 
        {
            if (!validateFirstStep(selectedToken1, selectedToken2, fee)) 
            {
                setIsFirstStepValid(false)
                setRequireInitialPrice(false)
                return
            }
            
            const { isValid: firstStepValid, poolExists } = await validateFullFirstStep(selectedToken1, selectedToken2, fee, initialPrice, doesPoolExist)
            setIsFirstStepValid(firstStepValid)
            setRequireInitialPrice(!poolExists)

            if (!firstStepValid || !signer || !contracts || !deploymentAddresses) return

            await validateMinPrice()
            await validateMaxPrice()

            await handleTokenInputDisplay()

            if (lastEditedField === "token1") 
            {
                await updateTokenAmounts(true, token1Amount) // convert A → B
            }
            if (lastEditedField === "token2") 
            {
                await updateTokenAmounts(false, token2Amount) // convert B → A
            }

            const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)

            let currentPrice: number
            if (poolExist) 
            {
                currentPrice = await getCurrentPoolPrice() ?? 0
            } 
            else 
            {
                currentPrice = initialPrice
            }

            const secondStepValid = await validateSecondStep(selectedToken1, selectedToken2, fee, minPrice, maxPrice, token1Amount, token2Amount, currentPrice, computeTokenAmount)
            setIsSecondStepValid(secondStepValid)
        }

        runAllUpdates()

    }, [signer, contracts, deploymentAddresses, selectedToken1, selectedToken2, fee, initialPrice, minPrice, maxPrice, token1Amount, token2Amount, lastEditedField], 500)

    //This needs to be check, there is an issue when third token is selected
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
        processStepClick(step, highestStepVisited, stepActive, selectedToken1, selectedToken2, fee, validateFirstStep, setSelectedToken1, setSelectedToken2, setFee, setStepActive)
    }

    const shouldAllowSelectStep = (step: number) => 
    {
        return shouldAllowStep(step, highestStepVisited)
    }

    const handleStepChange = (nextStep: number) => 
    {
        processStepChange(nextStep, stepActive, selectedToken1, selectedToken2, fee, setSelectedToken1, setSelectedToken2, setFee, setStepActive, setHighestStepVisited, doesPoolExist, initialPrice, getCurrentPoolPrice, setMinPrice, setMaxPrice, setMinPriceInput, setMaxPriceInput)
    }

    //Toggle visibility of set fee component
    const [isVisible, setIsVisible] = useState(true)

    const toggleVisibility = () => 
    {
        setIsVisible((prev) => !prev)
    }
        function validatePriceInput(input: string, maxDecimalsForOneOrMore = 4): number | null 
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

        const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)

        let currentPrice: number
        if (poolExist) 
        {
            currentPrice = await getCurrentPoolPrice() ?? 0
        } 
        else 
        {
            currentPrice = initialPrice
        }

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
            const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)

            let currentPrice: number
            if (poolExist) 
            {
                currentPrice = await getCurrentPoolPrice() ?? 0
            } 
            else 
            {
                currentPrice = initialPrice
            }
            const clampedMax = await handleMaxPrice(currentPrice, minPrice, setMaxPrice)

            if (clampedMax != null)
            {
                setMaxPriceInput(clampedMax.toString())
            }
        }
    }

    //Helper functions
    const priceToSqrtPBigNumber = (price: number): bigint => 
    {
        const jsbi = encodeSqrtRatioX96(JSBI.BigInt(price), JSBI.BigInt(1))
        return BigInt(jsbi.toString()) 
    }

    const sqrtPToPriceNumber = (sqrtPriceX96: bigint): number => 
    {
        const jsbiSqrt = JSBI.BigInt(sqrtPriceX96.toString())
        const shift = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))
        const ratio = JSBI.toNumber(JSBI.divide(jsbiSqrt, shift))
        return ratio ** 2
    }

    // const priceToSqrtP = (price: number) => encodeSqrtRatioX96(price, 1)

    const priceToSqrtP = (price: number) => 
    {
        const DECIMALS = 18
        const SCALE = 10 ** DECIMALS

        const numerator = JSBI.BigInt(Math.round(price * SCALE))
        const denominator = JSBI.BigInt(SCALE)

        return encodeSqrtRatioX96(numerator, denominator)
    }

    const priceToTick = (price: number) => TickMath.getTickAtSqrtRatio(priceToSqrtP(price))

    const getCurrentPoolPrice = async () => 
    {
        
        if (signer && deploymentAddresses && contracts) 
        {
            const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)
            if (!poolExist) 
            {
                return
            }

            try 
            {
                const poolAddress = await uniswapV3FactoryContract?.getPoolAddress(selectedToken1?.Address, selectedToken2?.Address, fee)
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
    }

    const doesPoolExist = async (token1Address: string | null, token2Address: string | null, fee: number | null): Promise<boolean> => 
    {
        if (!uniswapV3FactoryContract || !token1Address || !token2Address || fee === null) return false

        try 
        {
            const poolAddress = await uniswapV3FactoryContract.getPoolAddress(token1Address, token2Address, fee)
            return poolAddress !== '0x0000000000000000000000000000000000000000'
        } 
        catch (error) 
        {
            console.error("Error checking pool existence:", error)
            return false
        }
    }

    const computeTokenAmount = async (isAToB: boolean, overrideAmount?: string, initialPrice?: number) => 
    {
        const network = await provider?.getNetwork()
        const chainId = Number(network?.chainId)

        const [token1Address, token2Address] = [selectedToken1?.Address ?? "", selectedToken2?.Address ?? ""]

        const [contract1, contract2] = [token1Address, token2Address].map(addr => new ethers.Contract(addr, ERC20Mintable.abi, signer))

        const [decimalA, decimalB, symA, symB] = await Promise.all
        ([
            contract1.decimals(), contract2.decimals(),
            contract1.symbol(), contract2.symbol()
        ])

        const [tokenA, tokenB] = 
        [
            new Token(chainId, token1Address, Number(decimalA), symA),
            new Token(chainId, token2Address, Number(decimalB), symB)
        ]

        const poolAddress = await uniswapV3FactoryContract?.getPoolAddress(token1Address, token2Address, fee)
        const poolCallContract = getPoolContract(poolAddress)

        let pool
        try 
        {
            const [slot0, liquidity] = await Promise.all([poolCallContract?.slot0(), poolCallContract?.liquidity()])
            
            const sqrtPriceX96 = slot0.sqrtPriceX96.toString()
            const currentTick = slot0.tick

            pool = new Pool
            (
                tokenA,
                tokenB,
                3000,
                sqrtPriceX96,
                liquidity.toString(),
                Number(currentTick)
            )
        } 
        catch 
        {
            const sqrtPriceX96 = encodeSqrtRatioX96(ethers.parseUnits((initialPrice ?? 0).toString(), decimalA).toString(), ethers.parseUnits("1", decimalB).toString()).toString()
            pool = new Pool(tokenA, tokenB, fee ?? 0, sqrtPriceX96, "0", priceToTick(initialPrice ?? 0))
        }

        const buffer = 0.0001
        const tickLower = nearestUsableTick(priceToTick(minPrice - buffer), 60)
        const tickUpper = nearestUsableTick(priceToTick(maxPrice + buffer), 60)

        const getAmount = (amountStr: string, token: Token, decimals: number) => CurrencyAmount.fromRawAmount(token, ethers.parseUnits(amountStr, decimals).toString())

        let amountTokenA: CurrencyAmount<Token>, amountTokenB: CurrencyAmount<Token>

        if (isAToB) 
        {
            const amountStr = overrideAmount ?? token1Amount
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
            const amountStr = overrideAmount ?? token2Amount
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

        return {
            amountA: amountTokenA.toSignificant(4),
            amountB: amountTokenB.toSignificant(4)
        }
    }

    const updateTokenAmounts = async (isAToB: boolean, inputValue: string) => 
    {
        const trimmed = inputValue.trim()
        if (trimmed === "") 
        {
            setToken1Amount("")
            setToken2Amount("")
            return
        }

        if (!isFirstStepValid || !signer || !deploymentAddresses || !contracts) return

        const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)

        let currentPrice: number
        if (poolExist) 
        {
            currentPrice = await getCurrentPoolPrice() ?? 0
        } 
        else 
        {
            currentPrice = initialPrice
        }

        const isOutOfRange = currentPrice < minPrice || currentPrice > maxPrice

        const resetAmounts = () => 
        {
            if (isAToB && lastEditedField !== "token2") setToken2Amount("0")
            else if (!isAToB && lastEditedField !== "token1") setToken1Amount("0")
        }

        if (isOutOfRange) 
        {
            resetAmounts()
            return
        }

        const { amountA, amountB } = await computeTokenAmount(isAToB, trimmed, currentPrice)

        if (isAToB && lastEditedField !== "token2") 
        {
            setToken2Amount(amountB.toString())
        } 
        else if (!isAToB && lastEditedField !== "token1") 
        {
            setToken1Amount(amountA.toString())
        }

        // console.log(`Token 1 Amount: ${amountA}, Price: ${currentPrice}, Token 2 Amount: ${amountB}`)
    }


    const handleTokenInputDisplay = async() =>
    {
        const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)

        let currentPrice: number
        if (poolExist) 
        {
            currentPrice = await getCurrentPoolPrice() ?? 0
        } 
        else 
        {
            currentPrice = initialPrice
        }

        const isBelowRange = currentPrice < minPrice
        const isAboveRange = currentPrice > maxPrice
        const isWithinRange = currentPrice >= minPrice && currentPrice <= maxPrice

        if(isAboveRange)
        {
            console.log("isAboveRange")
            setHideToken1DuringChange(true)
            setHideToken2DuringChange(false)
        }

        if(isBelowRange)
        {
            console.log("isBelowRange")
            setHideToken1DuringChange(false)
            setHideToken2DuringChange(true)
        }

        if (isWithinRange)
        {
            const resultAtoB = await computeTokenAmount(true, "0.0001", currentPrice)
            const resultBtoA = await computeTokenAmount(false, "0.0001", currentPrice)

            const amountB_from_A = Number(resultAtoB.amountB)
            const amountA_from_B = Number(resultBtoA.amountA)

            const token1Disabled = amountA_from_B === 0
            const token2Disabled = amountB_from_A === 0

            setHideToken1DuringChange(token1Disabled)
            setHideToken2DuringChange(token2Disabled)
        }
    }

    const approveTokenTransaction = async (tokenAddress: string | null, spenderAddress: string, amount: string, signer: ethers.Signer) => 
    {
        if (!tokenAddress) 
        {
            return
        }

        const approveTokenContract = new ethers.Contract(tokenAddress, ERC20Mintable.abi, signer)
        const parsedAmount = ethers.parseEther(amount)
        await approveTokenContract.approve(spenderAddress, parsedAmount)
    }
    
    const addLiquidity = async () => 
    {
        if (!signer || !isConnected) return
        
        if (signer && deploymentAddresses && contracts) 
        {
            try
            {
                const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)
                if (!poolExist) 
                {
                    const factoryCreatePoolTx = await uniswapV3FactoryContract?.createPool(selectedToken1?.Address, selectedToken2?.Address, fee)
                    const factoryCreatePoolReceipt = await factoryCreatePoolTx.wait()
                    const poolAddress = await uniswapV3FactoryContract?.getPoolAddress(selectedToken1?.Address, selectedToken2?.Address, fee)
                    const poolCallContract = getPoolContract(poolAddress) 
                    const sqrtPriceX96 = priceToSqrtPBigNumber(initialPrice)
                    const poolInitializeTx = await poolCallContract?.initialize(sqrtPriceX96)
                    const poolInitializeTxReceipt = await poolInitializeTx.wait()
                    console.log(poolInitializeTxReceipt)
                }

                await approveTokenTransaction(selectedToken1?.Address ?? null, nftManagerContractAddress,token1Amount, signer)
                await approveTokenTransaction(selectedToken2?.Address ?? null, nftManagerContractAddress,token2Amount, signer)

                const mintParams = 
                {
                    recipient: await signer.getAddress(),
                    tokenA: selectedToken1?.Address,
                    tokenB: selectedToken2?.Address,
                    fee: fee,
                    lowerTick: nearestUsableTick(priceToTick(minPrice), 60), //4545
                    upperTick: nearestUsableTick(priceToTick(maxPrice), 60), //5500
                    amount0Desired: ethers.parseEther(token1Amount), //1
                    amount1Desired: ethers.parseEther(token2Amount), //5000
                    amount0Min: 0,
                    amount1Min: 0,
                }

                const nftManagerMintLiquidity = await uniswapV3NFTManagerContract?.mint(mintParams)
                const nftManagerMintLiquidityTx = await nftManagerMintLiquidity.wait()
                console.log(nftManagerMintLiquidityTx)
            }
            catch(error)
            {
                console.log(error)
            }

        }
    }

    const getPosition = async() =>
    {
        if (signer && deploymentAddresses && contracts) 
        {
            const poolExist = await doesPoolExist(selectedToken1?.Address ?? null, selectedToken2?.Address ?? null, fee ?? null)
            if (poolExist) 
            {
                const poolAddressTest = await uniswapV3FactoryContract?.getPoolAddress(selectedToken1?.Address, selectedToken2?.Address, fee)
                console.log(poolAddressTest)

                const tokenPosition = await uniswapV3NFTManagerContract?.positions(0)
                const {pool, lowerTick, upperTick } = tokenPosition
                const positionKey = ethers.keccak256(ethers.solidityPacked(["address", "int24", "int24"], [nftManagerContractAddress, lowerTick, upperTick]))
                console.log(positionKey)
                const poolCallContract = getPoolContract(pool) 
                const position = await poolCallContract?.positions(positionKey)
                console.log("Position:", position)
            }
        }
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
        <>
            {/* Test function for quotePool and swapToken */}
            <Button
            fullWidth
            radius="md"
            className="mt-[5%]"
            onClick={getPosition}
            >
            Test initial
            </Button>

            <Button
            fullWidth
            radius="md"
            className="mt-[5%]"
            onClick={swapToken}
            >
            Test swap
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

                            <div
                            className="cursor-pointer select-none"
                            onClick={() => open2()}
                            >
                            <Input
                                placeholder="Select token"
                                value={selectedToken2?.Label ?? ''}
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

                                            const parsedInput = validatePriceInput(input, 4)
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
                                onClick={() => handleStepChange(stepActive)}
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
                            <Text size="lg" fw={600} c="#4f0099" mb={20}>Set price range</Text>
                            <Tabs color="grape" variant="pills" radius="xl" defaultValue="custom_range" c="#4f0099">
                                <Tabs.List justify='center' grow>
                                    <Tabs.Tab value="full_range">
                                    Full range
                                    </Tabs.Tab>
                                    <Tabs.Tab value="custom_range">
                                    Custom range
                                    </Tabs.Tab>
                                </Tabs.List>

                                <Tabs.Panel value="full_range" mt={20}>
                                    Full Range
                                </Tabs.Panel>

                                <Tabs.Panel value="custom_range" mt={20}>
                                <>
                                        <div className="relative select-none" ref={chartRef}>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <LineChart data={data}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="date" />
                                                        <YAxis domain={[graphMinPrice, graphMaxPrice]} />
                                                        <Tooltip />

                                                        <ReferenceArea
                                                        y1={minPrice}
                                                        y2={maxPrice}
                                                        fill="purple"
                                                        fillOpacity={0.1}
                                                        />

                                                        <ReferenceLine
                                                        y={minPrice}
                                                        stroke="red"
                                                        strokeWidth={5}
                                                        label={({ viewBox }) => 
                                                        (   
                                                            <g>
                                                                <rect
                                                                x={viewBox.x + viewBox.x * 3.1}
                                                                y={viewBox.y - 6}
                                                                width="40"
                                                                height="10"
                                                                fill="purple"
                                                                onMouseDown={() => setDraggingType("min")}
                                                                cursor="ns-resize"
                                                                >
                                                                </rect>

                                                                <text
                                                                x={viewBox.x + viewBox.x * 2.9}
                                                                y={viewBox.y + 20}
                                                                fill='purple'
                                                                fontSize='11px'
                                                                fontWeight="bold"
                                                                >
                                                                {`Min: ${minPrice.toFixed(2)}`}
                                                                </text>
                                                            </g>
                                                        )}
                                                        />
                                                        <ReferenceLine
                                                        y={maxPrice}
                                                        stroke="green"
                                                        strokeWidth={5}
                                                        label={({ viewBox }) => 
                                                        (
                                                            <g>
                                                                <rect
                                                                x={viewBox.x + viewBox.x * 3.1}
                                                                y={viewBox.y - 6}
                                                                width="40"
                                                                height="10"
                                                                fill="purple"
                                                                onMouseDown={() => setDraggingType("max")}
                                                                cursor="ns-resize"
                                                                >
                                                                </rect>

                                                                <text
                                                                x={viewBox.x + viewBox.x * 2.9}
                                                                y={viewBox.y - 20}
                                                                fontSize='11px'
                                                                fill='purple'
                                                                fontWeight="bold"
                                                                >
                                                                {`Max: ${maxPrice.toFixed(2)}`}
                                                                </text>
                                                            </g>
                                                        )}
                                                        />

                                                        <Line type="monotone" dataKey="Price" stroke="purple" strokeWidth={3} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                        </div>

                                        <Grid gutter="md" mt={15}>
                                            <Grid.Col span={{ base: 12, md: 12, lg: 6 }}>
                                                <Card shadow="sm" padding="lg" radius="md" withBorder>
                                                    <Flex justify="space-between" align="center">
                                                        <Box>
                                                            <Text c="#4f0099" size="sm" fw={700}>Min price</Text>
                                                            <Input
                                                            c="#4f0099"
                                                            variant="unstyled"
                                                            size="xl"
                                                            value={minPriceInput}
                                                            onChange={(event) => 
                                                            {
                                                                const priceInputRegex = /^\d*\.?\d{0,4}$/
                                                                const input = event.target.value

                                                                if (input === '') 
                                                                {
                                                                    setMinPriceInput('')
                                                                    setMinPrice(0)
                                                                    return
                                                                }

                                                                if (priceInputRegex.test(input)) 
                                                                {
                                                                    setMinPriceInput(input)

                                                                    const parsedInput = validatePriceInput(input, 4)
                                                                    if (parsedInput !== null) 
                                                                    {
                                                                        setMinPrice(parsedInput)
                                                                    }
                                                                }
                                                            }}
                                                            />
                                                            <Text c="#4f0099" size="sm">NEAR per ETH</Text>
                                                        </Box>

                                                        <Stack>
                                                            <ActionIcon radius="xl">
                                                                <IconPlus size={20} />
                                                            </ActionIcon>
                                                            <ActionIcon radius="xl">
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
                                                            <Text c="#4f0099" size="sm" fw={700}>Max price</Text>
                                                            <Input
                                                            c="#4f0099"
                                                            variant="unstyled"
                                                            size="xl"
                                                            value={maxPriceInput}
                                                            onChange={(event) => 
                                                            {
                                                                const priceInputRegex = /^\d*\.?\d{0,4}$/
                                                                const input = event.target.value

                                                                if (input === '') 
                                                                {
                                                                    setMaxPriceInput('')
                                                                    setMaxPrice(0)
                                                                    return
                                                                }

                                                                if (priceInputRegex.test(input)) 
                                                                {
                                                                    setMaxPriceInput(input)

                                                                    const parsedInput = validatePriceInput(input, 4)
                                                                    if (parsedInput !== null) 
                                                                    {
                                                                        setMaxPrice(parsedInput)
                                                                    }
                                                                }
                                                            }}
                                                            />
                                                            <Text c="#4f0099" size="sm">NEAR per ETH</Text>
                                                        </Box>

                                                        <Stack>
                                                            <ActionIcon radius="xl">
                                                                <IconPlus size={20} />
                                                            </ActionIcon>
                                                            <ActionIcon radius="xl">
                                                                <IconMinus size={20} />
                                                            </ActionIcon>
                                                        </Stack>
                                                    </Flex>
                                                </Card>
                                            </Grid.Col>
                                        </Grid>

                                        <Text size="lg" fw={600} c="#4f0099" mt={30}>Deposit tokens</Text>
                                        <Text mt={10} size="sm" c="gray">Specify the token amounts for your liquidity contribution.</Text>
                                        
                                        {!hideToken1DuringChange && (
                                            <>
                                                <h4>Token 1</h4>
                                                <Input
                                                mt={20}
                                                size="xl"
                                                placeholder="0"
                                                value={token1Amount}
                                                onChange={async (event) => 
                                                {
                                                    const input = event.currentTarget.value
                                                    if (/^\d*\.?\d*$/.test(input)) 
                                                    {
                                                        setToken1Amount(input)
                                                        setLastEditedField("token1")
                                                    }
                                                }}
                                                rightSection={
                                                    <ActionIcon radius="xl">
                                                    <IconCoinFilled size={40} />
                                                    </ActionIcon>
                                                }
                                                rightSectionWidth={100}
                                                />
                                            </>

                                        )}

                                        {!hideToken2DuringChange && (
                                            <>
                                                <h4>Token 2</h4>
                                                <Input
                                                mt={20}
                                                size="xl"
                                                placeholder="0"
                                                value={token2Amount}
                                                onChange={async (event) => 
                                                {
                                                    const input = event.currentTarget.value;
                                                    if (/^\d*\.?\d*$/.test(input)) 
                                                    {
                                                        setToken2Amount(input)
                                                        setLastEditedField("token2")
                                                    }
                                                }}
                                                rightSection={
                                                    <ActionIcon radius="xl">
                                                    <IconCoinFilled size={40} />
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
                                            disabled={!isSecondStepValid}
                                            onClick={addLiquidity}
                                        >
                                            {
                                                isSecondStepValid
                                                ? 'Continue'
                                                : 'Incomplete fields'
                                            }
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

                                </>
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
                        handleTokenSelect(item, selectedToken1, selectedToken2, setSelectedToken1, setSelectedToken2, close1)
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
                        handleTokenSelect(item, selectedToken2, selectedToken1, setSelectedToken2, setSelectedToken1, close2)
                    }}
                    >
                    {item.Label}
                    </UnstyledButton>
                ))}
                </ScrollArea>
            </Modal>

        </>

    )
}