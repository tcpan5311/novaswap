"use client"
import { useState, useRef, useEffect, useMemo } from 'react'
import { Button, Group, Box, Text, Flex, Card, Table, Breadcrumbs, Grid, Stepper, MultiSelect, Modal, Input, NumberInput, Stack, ActionIcon, Textarea, ScrollArea, UnstyledButton, Tabs, Select} from '@mantine/core'
// import { LineChart } from '@mantine/charts'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts"
import { IconPlus, IconMinus, IconCoinFilled, IconChevronDown, IconSearch, IconPercentage, IconChevronUp } from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import JSBI from 'jsbi'
import { ethers } from 'ethers'
import { useRouter } from 'next/navigation';
import { UseBlockchain } from '../context/blockchain_context'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import UniswapV3Factory from '../../../contracts/UniswapV3Factory.json'
import UniswapV3Pool from '../../../contracts/UniswapV3Pool.json'
import UniswapV3Manager from '../../../contracts/UniswapV3Manager.json'
import UniswapV3NFTManager from '../../../contracts/UniswapV3NFTManager.json'
import UniswapV3Quoter from '../../../contracts/UniswapV3Quoter.json'
import { TickMath, encodeSqrtRatioX96, nearestUsableTick } from '@uniswap/v3-sdk'

    type CryptocurrencyDetail = 
    {
        Label: string 
        Address: string 
    }
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
        { date: "Mar 22", Price: 2500 },
        { date: "Mar 23", Price: 2650 },
        { date: "Mar 24", Price: 3500 },
        { date: "Mar 24", Price: 3100 },
        { date: "Mar 27", Price: 2950 },
        { date: "Mar 28", Price: 2800 },
    ]
    type data = {date: string; Price: number}

    const validateFirstStep = (token1: CryptocurrencyDetail | null, token2: CryptocurrencyDetail | null, fee: number | null): boolean => 
    {
        const isTokenValid = (token: CryptocurrencyDetail | null): boolean =>
        token !== null &&
        typeof token.Label === 'string' &&
        token.Label.trim() !== '' &&
        typeof token.Address === 'string' &&
        token.Address.trim() !== ''

        const isFeeValid = (fee: number | null): boolean =>
        fee !== null && !isNaN(fee) && fee >= 0

        return isTokenValid(token1) && isTokenValid(token2) && isFeeValid(fee)
    }

    const validateSecondStep = (token1: CryptocurrencyDetail | null, token2: CryptocurrencyDetail | null, fee: number | null, minPrice: number, maxPrice: number, token1Amount: number | null, token2Amount: number | null): boolean => 
    {
        if (!validateFirstStep(token1, token2, fee)) 
        {
            return false
        }

        const isPriceValid = (min: number, max: number): boolean => !isNaN(min) && !isNaN(max) && min >= 0 && max >= min
        const isAmountValid = (amount: number | null): boolean => amount !== null && !isNaN(amount) && amount > 0

        return (isPriceValid(minPrice, maxPrice) && isAmountValid(token1Amount) && isAmountValid(token2Amount))
    }


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
    const {account, provider, signer, isConnected, connectWallet} = UseBlockchain()
    const [factoryContractAddress, setFactoryContractAddress] = useState('')
    const [managerContractAddress, setManagerContractAddress] = useState('')
    const [nftManagerContractAddress, setNftManagerContractAddress] = useState('')
    const [quoterContractAddress, setQuoterContractAddress] = useState('')
    

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

    const [minPrice, setMinPrice] = useState(2700)
    const [maxPrice, setMaxPrice] = useState(3100)

    const [token1Amount, setToken1Amount] = useState<number | null>(null)
    const [token2Amount, setToken2Amount] = useState<number | null>(null)

    const [ethereumContractAddress, setEthereumContractAddress] = useState("")
    const [usdcContractAddress, setUsdcContractAddress] = useState("")
    const [uniswapContractAddress, setUniswapContractAddress] = useState("")

    const [draggingType, setDraggingType] = useState<"min" | "max" | null>(null)
    const chartRef = useRef<HTMLDivElement>(null)
    
    useEffect(() => 
    {

        async function fetchDeployment() 
        {
            try 
            {
                const res = await fetch('/api/position_create')
                if (!res.ok) 
                {
                    throw new Error(`HTTP error! status: ${res.status}`)
                }
                const json = await res.json()
                if (json.success) 
                {
                    const provider = new ethers.JsonRpcProvider('http://localhost:8545')
                    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
                    const wallet = new ethers.Wallet(privateKey, provider)
                    
                    const ethereumContract = new ethers.Contract(json.data.EthereumAddress, ERC20Mintable.abi, wallet)
                    const usdcContract = new ethers.Contract(json.data.USDCAddress, ERC20Mintable.abi, wallet)
                    const uniswapContract = new ethers.Contract(json.data.UniswapAddress, ERC20Mintable.abi, wallet)

                    setEthereumContractAddress(json.data.EthereumAddress)
                    setUsdcContractAddress(json.data.USDCAddress)
                    setUniswapContractAddress(json.data.UniswapAddress)

                    const ethereumName = await ethereumContract.name()
                    const ethereumSymbol = await ethereumContract.symbol()

                    const usdcName = await usdcContract.name()
                    const usdcSymbol = await usdcContract.symbol()

                    const uniswapName = await uniswapContract.name()
                    const uniswapSymbol = await uniswapContract.symbol()

                    setFactoryContractAddress(json.data.UniswapV3FactoryAddress)
                    setManagerContractAddress(json.data.UniswapV3ManagerAddress)
                    setNftManagerContractAddress(json.data.UniswapV3NFTManagerAddress)
                    setQuoterContractAddress(json.data.UniswapV3QuoterAddress)

                    cryptocurrencies = 
                    [
                        { Label: `${ethereumName} (${ethereumSymbol})`, Address: json.data.EthereumAddress },
                        { Label: `${usdcName} (${usdcSymbol})`, Address: json.data.USDCAddress },
                        { Label: `${uniswapName} (${uniswapSymbol})`, Address: json.data.UniswapAddress },
                    ]
                } 
                else 
                {
                    console.log(json.error || 'Unknown error')
                }
            } 
            catch (err: any) 
            {
                console.log(err.message)
            } 
        }
        fetchDeployment()
    
        const handleMinPriceMove = (event: MouseEvent) => 
        {
            if (!chartRef.current) return
            
    
            const rect = chartRef.current.getBoundingClientRect()
            const offsetY = event.clientY - rect.top
            const chartHeight = rect.height
            
            let newMinPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))
            
            if (newMinPrice > maxPrice - 10) 
            {
                newMinPrice = maxPrice - 10
            } 
            else if (newMinPrice < lowestPrice) 
            {
                newMinPrice = lowestPrice
            }
            
            setMinPrice(newMinPrice)
        }

        const handleMaxPriceMove = (event: MouseEvent) => 
        {
            if (!chartRef.current) return
            
            const rect = chartRef.current.getBoundingClientRect()
            const offsetY = event.clientY - rect.top
            const chartHeight = rect.height
            
            let newMaxPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))
            
            if (newMaxPrice < minPrice + 10) 
            {
                newMaxPrice = minPrice + 10
            } 
            else if (newMaxPrice > highestPrice) 
            {
                newMaxPrice = highestPrice
            }
            
            setMaxPrice(newMaxPrice)
        }
        
    
        const handleMouseUp = () => 
        {
            setDraggingType(null)
            document.removeEventListener("mousemove", handleMaxPriceMove)
            document.removeEventListener("mousemove", handleMinPriceMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
        
        if (draggingType === "max") 
        {
            document.addEventListener("mousemove", handleMaxPriceMove)    
        } 
        else if (draggingType === "min") 
        {
            document.addEventListener("mousemove", handleMinPriceMove)
            
        }
    
        document.addEventListener("mouseup", handleMouseUp)
        
        return () => 
        {
            document.removeEventListener("mousemove", handleMaxPriceMove)
            document.removeEventListener("mousemove", handleMinPriceMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
    
    }, [draggingType])

    //Contract initialization
    const ethereumContract = useMemo(() => 
    {
        if (!ethereumContractAddress || !signer) return null
        return new ethers.Contract(ethereumContractAddress, ERC20Mintable.abi, signer)
    }, [ethereumContractAddress, signer])

    const usdcContract = useMemo(() => 
    {
        if (!usdcContractAddress || !signer) return null
        return new ethers.Contract(usdcContractAddress, ERC20Mintable.abi, signer)
    }, [usdcContractAddress, signer])

    const uniswapContract = useMemo(() => 
    {
        if (!uniswapContractAddress || !signer) return null
        return new ethers.Contract(uniswapContractAddress, ERC20Mintable.abi, signer)
    }, [uniswapContractAddress, signer])
    
    //Stepper logic implementation
    const [stepActive, setStepActive] = useState(1)
    const [highestStepVisited, setHighestStepVisited] = useState(stepActive)

    const shouldAllowSelectStep = (step: number): boolean => 
    {
        return highestStepVisited >= step
    }

    const handleStepChange = (nextStep: number) => 
    {
        const isOutOfBounds = nextStep < 0 || nextStep > 2
        if (isOutOfBounds) return

        if (nextStep < stepActive)
        {
            setSelectedToken1(null)
            setSelectedToken2(null)
            setFee(null)
        }

        setStepActive(nextStep + 1)
        setHighestStepVisited(prev => Math.max(prev, nextStep))

    }

    const handleStepClick = (step: number) => 
    {
    if (!shouldAllowSelectStep(step)) return

        if (step === 1) 
        {
            if(validateFirstStep(selectedToken1, selectedToken2, fee)) 
            {
                setStepActive(step + 1)
            }
        } 
        else 
        {
            if (step === 0) 
            {
                setSelectedToken1(null);
                setSelectedToken2(null);
                setFee(null);
            }
            setStepActive(step + 1)
        }
    }

    //Toggle visibility of set fee component
    const [isVisible, setIsVisible] = useState(true)

    const toggleVisibility = () => 
    {
      setIsVisible((prev) => !prev)
    }

    //Helper functions
    const priceToSqrtPBigNumber = (price: number): bigint => 
    {
        const jsbi = encodeSqrtRatioX96(JSBI.BigInt(price), JSBI.BigInt(1))
        return BigInt(jsbi.toString()) 
    }
    const priceToSqrtP = (price: number) => encodeSqrtRatioX96(price, 1)
    const priceToTick = (price: number) => TickMath.getTickAtSqrtRatio(priceToSqrtP(price))

    const addLiquidity = async () => 
    {
        if (!signer || !isConnected) return
        
        const factoryContract = new ethers.Contract(factoryContractAddress, UniswapV3Factory.abi, signer)
        const factoryCreatePoolTx = await factoryContract.createPool(selectedToken1?.Address, selectedToken2?.Address, fee)
        const factoryCreatePoolReceipt = await factoryCreatePoolTx.wait()

        const poolAddress = await factoryContract.getPoolAddress(selectedToken1?.Address, selectedToken2?.Address, fee)

        if (!poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") 
        {
            throw new Error("Failed to retrieve pool address from getPoolAddress()")
        }

        console.log("Pool deployed at:", poolAddress)
        const poolCallContract = new ethers.Contract(poolAddress, UniswapV3Pool.abi, signer)

        const sqrtPriceX96 = priceToSqrtPBigNumber(5000)
        const poolInitializeTx = await poolCallContract.initialize(sqrtPriceX96)
        const poolInitializeTxReceipt = await poolInitializeTx.wait()

        const nftManagerContract = new ethers.Contract(nftManagerContractAddress, UniswapV3NFTManager.abi, signer)

        await ethereumContract?.approve(nftManagerContractAddress,ethers.parseEther("2"))
        await usdcContract?.approve(nftManagerContractAddress,ethers.parseEther("10000"))

        const mintParams = 
        {
            recipient: await signer.getAddress(),
            tokenA: selectedToken1?.Address,
            tokenB: selectedToken2?.Address,
            fee: fee,
            lowerTick: nearestUsableTick(priceToTick(4545), 60),
            upperTick: nearestUsableTick(priceToTick(5500), 60),
            amount0Desired: ethers.parseEther("1"),
            amount1Desired: ethers.parseEther("5000"),
            amount0Min: 0,
            amount1Min: 0,
        }

        const nftManagerMintLiquidity = await nftManagerContract.mint(mintParams)
        const nftManagerMintLiquidityTx = await nftManagerMintLiquidity.wait()
        console.log(nftManagerMintLiquidityTx)
    }

    const quotePool = async () => 
    {
        try
        {
            console.log(quoterContractAddress)
            const quoterContract = new ethers.Contract(quoterContractAddress, UniswapV3Quoter.abi, signer)

            const quoteParams =
            {
                tokenIn: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                tokenOut: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
                fee: 3000,
                amountIn: ethers.parseEther("0.1337"),
                sqrtPriceLimitX96: priceToSqrtPBigNumber(4993)
            }

            const [amountOut, sqrtPriceX96After, tickAfter] = await quoterContract.quoteSingle.staticCall(quoteParams)
            console.log("amountOut:", ethers.formatUnits(amountOut, 18)) 
            console.log("sqrtPriceX96After:", sqrtPriceX96After.toString())
            console.log("tickAfter:", tickAfter.toString())
        }
        catch(error)
        {
            console.log(error)
        }


    }

    const swapToken = async () => 
    {
        try
        {
            const managerContract = new ethers.Contract(managerContractAddress, UniswapV3Manager.abi, signer)
            
            await ethereumContract?.approve(managerContractAddress,ethers.parseEther("1"))

            const swapParams = 
            {
                tokenIn: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                tokenOut: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
                fee: 3000,
                amountIn: ethers.parseEther("0.1337"),
                sqrtPriceLimitX96: priceToSqrtPBigNumber(4993)
            }

            const managerContractSwap = await managerContract.swapSingle(swapParams)
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
<Button
fullWidth
radius="md"
className="mt-[5%]"
onClick={quotePool}
>
Test quote
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

                            {isConnected ? (
                            <Button
                                fullWidth
                                radius="md"
                                className="mt-[5%]"
                                onClick={() => handleStepChange(stepActive)}
                                disabled={!validateFirstStep(selectedToken1, selectedToken2, fee)}
                            >
                                Continue
                            </Button>
                            ) : (
                            <Button
                                fullWidth
                                radius="md"
                                className="mt-[5%]"
                                onClick={connectWallet} // replace with your wallet connection function
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

                                        <Grid gutter="md" mt={10}>
                                            <Grid.Col span={{ base: 12, md: 12, lg: 6 }}>
                                                <Card shadow="sm" padding="lg" radius="md" withBorder>
                                                    <Flex justify="space-between" align="center">
                                                        <Box>
                                                            <Text c="#4f0099" size="sm" fw={700}>Min price</Text>
                                                            <Input
                                                            c="#4f0099"
                                                            variant="unstyled"
                                                            size="xl"
                                                            value={parseFloat(minPrice.toFixed(2))}
                                                            onChange={(event) => setMinPrice(Number(event.target.value))}
                                                            onBlur={() => 
                                                            {
                                                                setMinPrice((prev1) => 
                                                                {
                                                                    let newMinPrice = prev1

                                                                    if (newMinPrice > maxPrice - 10) 
                                                                    {
                                                                        newMinPrice = maxPrice - 10
                                                                    } 
                                                                    else if (newMinPrice < lowestPrice) 
                                                                    {
                                                                        newMinPrice = lowestPrice
                                                                    }

                                                                    return newMinPrice
                                                                })
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
                                                            value={parseFloat(maxPrice.toFixed(2))}
                                                            onChange={(event) => setMaxPrice(Number(event.target.value))}
                                                            onBlur={() => 
                                                            {
                                                                setMaxPrice((prev2) => 
                                                                {
                                                                    let newMaxPrice = prev2

                                                                    if (newMaxPrice < minPrice + 10) 
                                                                    {
                                                                        newMaxPrice = minPrice + 10
                                                                    } 
                                                                    else if (newMaxPrice > highestPrice) 
                                                                    {
                                                                        newMaxPrice = highestPrice
                                                                    }
                                                                    
                                                                    return newMaxPrice
                                                                })
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

                                        <Input
                                        mt={20}
                                        size="xl"
                                        placeholder="0"
                                        value={token1Amount !== null ? token1Amount.toString() : ''}
                                        onChange={(event) => {
                                            const input = event.currentTarget.value;
                                            const parsed = parseFloat(input);
                                            setToken1Amount(input === '' || isNaN(parsed) ? null : parsed);
                                        }}
                                        rightSection={
                                            <ActionIcon radius="xl">
                                            <IconCoinFilled size={40} />
                                            </ActionIcon>
                                        }
                                        rightSectionWidth={100}
                                        />

                                        <Input
                                        mt={20}
                                        size="xl"
                                        placeholder="0"
                                        value={token2Amount !== null ? token2Amount.toString() : ''}
                                        onChange={(event) => {
                                            const input = event.currentTarget.value;
                                            const parsed = parseFloat(input);
                                            setToken2Amount(input === '' || isNaN(parsed) ? null : parsed);
                                        }}
                                        rightSection={
                                            <ActionIcon radius="xl">
                                            <IconCoinFilled size={40} />
                                            </ActionIcon>
                                        }
                                        rightSectionWidth={100}
                                        />

                                        {isConnected ? (
                                        <Button
                                            fullWidth
                                            radius="md"
                                            className="mt-[5%]"
                                            disabled={!validateSecondStep(selectedToken1, selectedToken2, fee, minPrice, maxPrice, token1Amount, token2Amount)}
                                            onClick={addLiquidity}
                                        >
                                            {
                                                validateSecondStep(selectedToken1, selectedToken2, fee, minPrice, maxPrice, token1Amount, token2Amount)
                                                ? 'Continue'
                                                : 'Incomplete fields'
                                            }
                                        </Button>
                                        ) : (
                                        <Button
                                            fullWidth
                                            radius="md"
                                            className="mt-[5%]"
                                            onClick={connectWallet} // replace with your wallet connection function
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
                        setSelectedToken1(item)
                        close1()
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
                        setSelectedToken2(item)
                        close2()
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