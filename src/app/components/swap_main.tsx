"use client"
import { useEffect } from 'react'
import { MantineProvider} from '@mantine/core'
import { Card, Text, Grid, NumberInput, TextInput, Textarea, Button, ActionIcon, Group, Popover, UnstyledButton, Modal, Input, ScrollArea, Stack } from '@mantine/core'
// import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import classes from "../../../css_modules/swapmain.module.css"
import React from 'react'
import { useState, useRef } from 'react'
import { IconTransfer, IconSettings, IconSearch } from '@tabler/icons-react'
import { useMediaQuery } from '@mantine/hooks'
import { UseBlockchain } from '../context/blockchain_context'
import { CryptocurrencyDetail, TokenSetter } from '../utils/validator_utils'
import { ethers, isAddress } from 'ethers'
import { IconCoinFilled } from '@tabler/icons-react'
import { TickMath, encodeSqrtRatioX96,  Pool, Position, nearestUsableTick, FeeAmount, TickListDataProvider } from '@uniswap/v3-sdk'
import { Token, CurrencyAmount} from '@uniswap/sdk-core'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import { sqrtPToPriceNumber } from '../utils/compute_token_utils'
import { validateSwapStep } from '../utils/validator_utils'

let cryptocurrencies: CryptocurrencyDetail[] = []

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

const handleSwitchToken = 
(
    selectedToken0: CryptocurrencyDetail | null, 
    selectedToken1: CryptocurrencyDetail | null,  
    setSelectedToken0: React.Dispatch<React.SetStateAction<CryptocurrencyDetail | null>>, 
    setSelectedToken1: React.Dispatch<React.SetStateAction<CryptocurrencyDetail | null>>,
    swapValue1: string,
    swapValue2: string,
    setSwapValue1: React.Dispatch<React.SetStateAction<string>>,
    setSwapValue2: React.Dispatch<React.SetStateAction<string>>
) => 
{
    if (selectedToken0 && selectedToken1) 
    {
        setSelectedToken0(selectedToken1)
        setSelectedToken1(selectedToken0)

        setSwapValue1(() => swapValue2 || '')
        setSwapValue2(() => swapValue1 || '')
    } 
    else 
    {
        console.log("⚠️ Please select both tokens before swapping.")
    }
}

export default function SwapMain() 
{
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

    const [selectedToken0, setSelectedToken0] = useState<CryptocurrencyDetail | null>(null)
    const [selectedToken1, setSelectedToken1] = useState<CryptocurrencyDetail | null>(null)
    
    const [swapValue1, setSwapValue1] = useState('')
    const [swapValue2, setSwapValue2] = useState('')

    const [hasLiquidity, setHasLiquidity] = useState(false)

    const [isSwapValid, setIsSwapValid] = useState(false)
    const [swapValidError, setSwapValidError] = useState<"incomplete_fields" | "insufficient_tokens" | null>(null)

    const [token0Balance, setToken0Balance] = useState<string>("0")
    const [token1Balance, setToken1Balance] = useState<string>("0")

    const [selectedTab, setSelectedTab] = useState('Swap')
    const isSmallScreen = useMediaQuery('(max-width: 768px)')

    //For handling of modal opening and closing
    const [opened1, { open: open1, close: close1 }] = useDisclosure(false)
    const [opened2, { open: open2, close: close2 }] = useDisclosure(false)

    //For appending of token list
    const viewportRef = useRef<HTMLDivElement>(null)
    const [query, setQuery] = useState('')
    const [hovered, setHovered] = useState(-1)
    const filtered = cryptocurrencies.filter((item) => item.Label.toLowerCase().includes(query.toLowerCase()))

    const [activeInput, setActiveInput] = useState<"swap1" | "swap2" | null>(null)
    
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

    const handleSwap1Change = (value: string) => 
    {
        setActiveInput("swap1")
        setSwapValue1(value)
    }

    const handleSwap2Change = (value: string) => 
    {
        setActiveInput("swap2")
        setSwapValue2(value)
    }

    useDebounceEffect(() => 
    {
        loadData()
    }, [signer, contracts, deploymentAddresses], 500)

    useDebounceEffect(() => 
    {
        if (!uniswapV3QuoterContract || !selectedToken0 || !selectedToken1 || !provider) return

        if (activeInput === "swap1" && !swapValue1) 
        {
            setSwapValue2("")
            return
        }
        if (activeInput === "swap2" && !swapValue2) 
        {
            setSwapValue1("")
            return
        }

        const fetchQuote = async () => 
        {
            try 
            {
                setHasLiquidity(true)

                const path = ethers.solidityPacked(
                    ["address", "uint24", "address"],
                    [selectedToken0.Address, 3000, selectedToken1.Address]
                )

                if (activeInput === "swap1" && swapValue1) 
                {
                    const inputAmount = ethers.parseUnits(swapValue1, 18)
                    const [calculatedOutput] = await uniswapV3QuoterContract.quoteExactInput.staticCall(path, inputAmount)
                    setSwapValue1(swapValue1)
                    setSwapValue2(ethers.formatUnits(calculatedOutput, 18))
                } 
                else if (activeInput === "swap2" && swapValue2) 
                {
                    const desiredOutput = ethers.parseUnits(swapValue2, 18)
                    const [calculatedInput] = await uniswapV3QuoterContract.quoteExactOutput.staticCall(path, desiredOutput)
                    setSwapValue1(ethers.formatUnits(calculatedInput, 18))
                    setSwapValue2(swapValue2)
                }
            } 
            catch (err) 
            {
                console.log(err)
                setHasLiquidity(false) 
                if (activeInput === "swap1") setSwapValue2("")
                else if (activeInput === "swap2") setSwapValue1("")
            }
        }

        fetchQuote()
    }, [swapValue1, swapValue2, selectedToken0, selectedToken1, uniswapV3QuoterContract, activeInput], 500)
    
    useEffect(() => 
    {
        const updateTokenBalance = async() =>
        {
            if (!selectedToken0?.Address && !selectedToken1?.Address) return
            await fetchBalances(selectedToken0?.Address ?? null, selectedToken1?.Address ?? null)
        }

        const validateSwap = async () => 
        {
            if (!provider || !signer) return
            if (!selectedToken0?.Address || !selectedToken1?.Address) return

            const result = await validateSwapStep(provider, signer, selectedToken0.Address, selectedToken1.Address, swapValue1, swapValue2, (address: string, signerOrProvider: any) => new ethers.Contract(address, ERC20Mintable.abi, signerOrProvider))

            setIsSwapValid(result.isValid)
            setSwapValidError(result.error ?? null)
        }

        validateSwap()
        updateTokenBalance()
    }, [provider, signer, selectedToken0, selectedToken1, swapValue1, swapValue2])

    const approveTokenTransaction = async (tokenAddress: string | null, spenderAddress: string, amount: bigint, signer: ethers.Signer) => 
    {
        if (!tokenAddress) 
        {
            throw new Error("Token address is required in approveTokenTransaction")
        }

        const approveTokenContract = new ethers.Contract(tokenAddress, ERC20Mintable.abi, signer)
        await approveTokenContract.approve(spenderAddress, amount)
    }

    const fetchBalances = async (token0Address: string | null, token1Address: string | null) => 
    {
        if (!signer) return

        try 
        {
            const signerAddress = await signer.getAddress()

            if (token0Address) 
            {
                const token0Contract = new ethers.Contract(token0Address, ERC20Mintable.abi, signer)
                const [rawBalance0, symbol0, decimals0] = await Promise.all([
                    token0Contract.balanceOf(signerAddress),
                    token0Contract.symbol(),
                    token0Contract.decimals()
                ])
                const balance0 = ethers.formatUnits(rawBalance0, decimals0)
                setToken0Balance(`${balance0} ${symbol0}`)
            } 
            else 
            {
                setToken0Balance("0")
            }

            if (token1Address) 
            {
                const token1Contract = new ethers.Contract(token1Address, ERC20Mintable.abi, signer)
                const [rawBalance1, symbol1, decimals1] = await Promise.all([
                    token1Contract.balanceOf(signerAddress),
                    token1Contract.symbol(),
                    token1Contract.decimals()
                ])
                const balance1 = ethers.formatUnits(rawBalance1, decimals1)
                setToken1Balance(`${balance1} ${symbol1}`)
            } 
            else 
            {
                setToken1Balance("0")
            }
        } 
        catch (err) 
        {
            console.error("Failed to fetch token balances:", err)
        }
    }

    const swapExactInput = async () => 
    {
        if (!uniswapV3QuoterContract || !uniswapV3ManagerContract || !selectedToken0 || !selectedToken1 || !signer) return

        try 
        {
            const inputAmount = ethers.parseEther(swapValue1)
            const path = ethers.solidityPacked(["address", "uint24", "address"], [selectedToken0.Address, 3000, selectedToken1.Address])
            const [calculatedOutput] = await uniswapV3QuoterContract.quoteExactInput.staticCall(path, inputAmount)
            const slippageTolerance = 100n
            const minAmountOut = calculatedOutput - (calculatedOutput * slippageTolerance / 10000n)

            if (inputAmount > 0n) 
            {
                await approveTokenTransaction(selectedToken0.Address, managerContractAddress, inputAmount, signer)
            }

            const swapParams = {
                path,
                recipient: await signer.getAddress(),
                amountIn: inputAmount,
                minAmountOut: minAmountOut
            }

            const managerSwap = await uniswapV3ManagerContract.swapExactInput(swapParams)
            const managerSwapTx = await managerSwap.wait()

            setSwapValue1(ethers.formatUnits(inputAmount, 18))
            setSwapValue2(ethers.formatUnits(calculatedOutput, 18))
            console.log("Exact input swap successful", managerSwapTx)
        } 
        catch (err) 
        {
            console.log("Exact input swap failed", err)
        }
    }

    const swapExactOutput = async () => 
    {
        if (!uniswapV3QuoterContract || !uniswapV3ManagerContract || !selectedToken0 || !selectedToken1 || !signer) return

        try 
        {
            const amountOut = ethers.parseEther(swapValue2)

            const path = ethers.solidityPacked(
                ["address", "uint24", "address"],
                [selectedToken0.Address, 3000, selectedToken1.Address]
            )

            const [quotedInputAmount] = await uniswapV3QuoterContract.quoteExactOutput.staticCall(path, amountOut)
            const slippageTolerance = 100n
            const maxAmountIn = quotedInputAmount + (quotedInputAmount * slippageTolerance / 10000n)

            if (maxAmountIn > 0n) 
            {
                await approveTokenTransaction(selectedToken0.Address, managerContractAddress, maxAmountIn, signer)
            }

            const swapParams = 
            {
                path,
                recipient: await signer.getAddress(),
                amountOut,
                maxAmountIn
            }

            const managerSwap = await uniswapV3ManagerContract.swapExactOutput(swapParams)
            const managerSwapTx = await managerSwap.wait()

            console.log("Exact output swap successful", managerSwapTx)
        } 
        catch (err) 
        {
            console.log("Exact output swap failed", err)
        }
    }

    return (
        <div className="bg-white mt-[5%] h-screen">
            <Grid justify={isSmallScreen ? "flex-start ml-10" : "center"} align="center">
            
                <Grid.Col span="auto" className="w-[500px] min-w-[500px] max-w-[500px] md:ml-4">
                    <Group>
                    {['Swap', 'Limit', 'Send'].map((label) => 
                    (
                        <Button key={label} variant={selectedTab === label ? 'filled' : 'outline'} onClick={() => setSelectedTab(label)}>
                        {label}
                        </Button>
                    ))}
                    <div className= "ml-auto">

                        <Popover width={300} trapFocus position="bottom" withArrow shadow="md">
                        <Popover.Target>
                        <ActionIcon size={42} variant="subtle">
                        <IconSettings size={24} />
                        </ActionIcon>
                        </Popover.Target>
                        <Popover.Dropdown>
                        <TextInput label="Max slippage:" placeholder="0" size="sm" />
                        </Popover.Dropdown>
                        </Popover>
                    </div>
                    </Group>
                    
                    <Card shadow="xl" padding="xl" className="w-full h-full mt-[2%]">

                            {selectedTab === "Swap" && (
                            <>
                                <Textarea
                                size='xl'
                                classNames= 
                                {{
                                    description: classes.swap_text_area,
                                    input: "h-[110px] w-full text-2xl px-4 rounded-2xl"
                                }}
                                value={swapValue1}
                                onChange={(event) => handleSwap1Change(event.currentTarget.value)}
                                description="Sell"
                                placeholder="0"
                                rightSection=
                                {
                                    <Stack gap="xs" align="start">
                                        <Button size="sm" radius="xl" onClick={open1} leftSection={<IconCoinFilled size={17} />}>
                                            <Group align='center'>
                                                {selectedToken0 ? selectedToken0.Label : "Select Token"}
                                            </Group>
                                        </Button>

                                        {selectedToken0 && 
                                        (
                                            <Text size="sm" c="dimmed">
                                            {token0Balance}
                                            </Text>
                                        )}
                                    </Stack>
                                }
                                rightSectionWidth={200}
                                />

                                <ActionIcon 
                                    size={42} 
                                    variant="default" 
                                    className= "self-center mt-[5%]" 
                                    onClick={() => 
                                        handleSwitchToken
                                        (
                                            selectedToken0,
                                            selectedToken1,
                                            setSelectedToken0,
                                            setSelectedToken1,
                                            swapValue1,
                                            swapValue2,
                                            setSwapValue1,
                                            setSwapValue2
                                        )
                                    }
                                    >
                                    <IconTransfer size={24} />
                                </ActionIcon>

                                <Textarea
                                size='xl'
                                classNames= 
                                {{
                                    description: classes.swap_text_area,
                                    input: "h-[110px] w-full text-2xl px-4 rounded-2xl"
                                }}
                                value={swapValue2}
                                onChange={(event) => handleSwap2Change(event.currentTarget.value)}
                                description="Buy"
                                placeholder="0"
                                rightSection=
                                {
                                    <Stack gap="xs" align="start">
                                        <Button size="sm" radius="xl" onClick={open2} leftSection={<IconCoinFilled size={17} />}>
                                            <Group align='center'>
                                                {selectedToken1 ? selectedToken1.Label : "Select Token"}
                                            </Group>
                                        </Button>

                                        {selectedToken1 && 
                                        (
                                            <Text size="sm" c="dimmed">
                                            {token1Balance}
                                            </Text>
                                        )}
                                    </Stack>
                                }
                                rightSectionWidth={200}
                                />

                                {isConnected ? (
                                    <Button fullWidth radius="md" className= "mt-[10%]" 
                                    disabled={!isSwapValid || !hasLiquidity}
                                    onClick={() => 
                                    {
                                        if (activeInput === "swap1") 
                                        {
                                            swapExactInput()
                                        } 
                                        else if (activeInput === "swap2") 
                                        {
                                            swapExactOutput()
                                        } 
                                        else 
                                        {
                                            console.log("Please enter an amount first.")
                                        }
                                    }}
                                    >    
                                    {!isSwapValid
                                    ? swapValidError === "insufficient_tokens"
                                        ? "Insufficient tokens"
                                        : "Incomplete fields"
                                    : !hasLiquidity
                                        ? "Insufficient liquidity"
                                        : "Swap"
                                    }
                                    </Button>
                                ):
                                (
                                    <Button fullWidth radius="md" className= "mt-[10%]" onClick={connectWallet}>Connect Wallet</Button>
                                )}
                            </>
                            )}

                            {selectedTab === "Limit" && (
                                <h1>Hello limit</h1>
                            )}

                            
                            {selectedTab === "Send" && (
                                <h1>Hello send</h1>
                            )}


                    </Card>
                </Grid.Col>
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
        </div>
    )
}