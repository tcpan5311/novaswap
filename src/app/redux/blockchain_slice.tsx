"use client"
import type { AppDispatch } from "./store"
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { PositionData } from "./types"
import { MetaMaskSDK } from "@metamask/sdk"
import { ethers, Contract } from "ethers"
import { Pool, Position } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'
import { sqrtPToPriceNumber, tickToPrice} from '../utils/compute_token_utils'
import { current } from "immer"

import ERC20Mintable from "../../../contracts/ERC20Mintable.json"
import UniswapV3Factory from "../../../contracts/UniswapV3Factory.json"
import UniswapV3Pool from "../../../contracts/UniswapV3Pool.json"
import UniswapV3Manager from "../../../contracts/UniswapV3Manager.json"
import UniswapV3NFTManager from "../../../contracts/UniswapV3NFTManager.json"
import UniswapV3Quoter from "../../../contracts/UniswapV3Quoter.json"

export type UniswapV3FactoryContract = Contract & 
{
    getPoolAddress(token0: string, token1: string, fee: number): Promise<string>
}

export interface DeploymentAddresses 
{
    EthereumAddress: string
    USDCAddress: string
    UniswapAddress: string
    UniswapV3FactoryAddress: string
    UniswapV3ManagerAddress: string
    UniswapV3NFTManagerAddress: string
    UniswapV3QuoterAddress: string
}

export interface ContractReferences 
{
    EthereumContract: ethers.Contract | undefined
    USDCContract: ethers.Contract | undefined
    UniswapContract: ethers.Contract | undefined
    UniswapV3FactoryContract: UniswapV3FactoryContract | undefined
    UniswapV3ManagerContract: ethers.Contract | undefined
    UniswapV3NFTManagerContract: ethers.Contract | undefined
    UniswapV3QuoterContract: ethers.Contract | undefined
}

export interface BlockchainState 
{
    sdk: MetaMaskSDK | undefined
    account: string
    isConnected: boolean
    signer: ethers.JsonRpcSigner | undefined
    deploymentAddresses: DeploymentAddresses | undefined
    contracts: ContractReferences
    status: "idle" | "loading" | "failed"
    error: string | undefined
    cryptocurrencies: { Label: string; Address: string }[]
    positions: PositionData[]
    token0Balance: string
    token1Balance: string
    poolExists: boolean,
    currentPrice: number | undefined
    pricesData: { date: string; price: number; secondsAgo: number }[]
    priceDataMessage: string | undefined
}

const initialState: BlockchainState = 
{
    sdk: undefined,
    account: "",
    isConnected: false,
    signer: undefined,
    deploymentAddresses: undefined,
    contracts: 
    {
        EthereumContract: undefined,
        USDCContract: undefined,
        UniswapContract: undefined,
        UniswapV3FactoryContract: undefined,
        UniswapV3ManagerContract: undefined,
        UniswapV3NFTManagerContract: undefined,
        UniswapV3QuoterContract: undefined,
    },
    status: "idle",
    error: undefined,
    cryptocurrencies: [],
    positions: [],
    token0Balance: "",
    token1Balance: "",
    poolExists: false,
    currentPrice: undefined,
    pricesData: [],
    priceDataMessage: undefined
}

export const initializeMetaMaskSDK = createAsyncThunk("blockchain/initSDK", async () => 
{
    const sdk = new MetaMaskSDK({ dappMetadata: { name: "Novaswap" } })
    return sdk
})

export const connectWallet = createAsyncThunk<{ account: string; provider: ethers.BrowserProvider; signer: ethers.JsonRpcSigner }, void, { state: { blockchain: BlockchainState }; dispatch: AppDispatch }>("blockchain/connectWallet", async (_, { getState, rejectWithValue }) => 
{
    try 
    {
        const sdk = getState().blockchain.sdk
        if (!sdk) throw new Error("SDK not initialized")

        const accounts = await sdk.connect()
        if (!accounts || accounts.length === 0) throw new Error("No accounts found")

        const formatted = accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4)
        const ethProvider = new ethers.BrowserProvider(window.ethereum)
        const ethSigner = await ethProvider.getSigner()

        return { account: formatted, provider: ethProvider, signer: ethSigner }
    } 
    catch (error) 
    {
        if (error instanceof Error) 
        {
            return rejectWithValue(error.message)
        }
        return rejectWithValue(String(error))
    }
})

export const disconnectWallet = createAsyncThunk<boolean, void, { state: { blockchain: BlockchainState } }>("blockchain/disconnectWallet", async (_, { getState, rejectWithValue }) => 
{
    try 
    {
        const sdk = getState().blockchain.sdk
        if (sdk) await sdk.terminate()
        return true
    } 
    catch (error) 
    {
        if (error instanceof Error) 
        {
            return rejectWithValue(error.message)
        }
        return rejectWithValue(String(error))
    }
})

export const fetchDeploymentData = createAsyncThunk<{ deploymentAddresses: DeploymentAddresses; contracts: ContractReferences }, void, { state: { blockchain: BlockchainState } }>("blockchain/fetchDeploymentData", async (_, { getState, rejectWithValue }) => 
{
    try 
    {
        const signer = getState().blockchain.signer
        if (!signer) throw new Error("Signer not available")

        const res = await fetch("/api/position_create")
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "Unknown error")

        const data: DeploymentAddresses = json.data

        if (!ethers.isAddress(data.EthereumAddress) || !ethers.isAddress(data.USDCAddress) || !ethers.isAddress(data.UniswapAddress)) 
        {
            throw new Error("Invalid deployment addresses returned from /api/position_create")
        }

        const contracts: ContractReferences = 
        {
            EthereumContract: new ethers.Contract(data.EthereumAddress, ERC20Mintable.abi, signer),
            USDCContract: new ethers.Contract(data.USDCAddress, ERC20Mintable.abi, signer),
            UniswapContract: new ethers.Contract(data.UniswapAddress, ERC20Mintable.abi, signer),
            UniswapV3FactoryContract: new ethers.Contract(data.UniswapV3FactoryAddress, UniswapV3Factory.abi, signer) as UniswapV3FactoryContract,
            UniswapV3ManagerContract: new ethers.Contract(data.UniswapV3ManagerAddress, UniswapV3Manager.abi, signer),
            UniswapV3NFTManagerContract: new ethers.Contract(data.UniswapV3NFTManagerAddress, UniswapV3NFTManager.abi, signer),
            UniswapV3QuoterContract: new ethers.Contract(data.UniswapV3QuoterAddress, UniswapV3Quoter.abi, signer),
        }

        return { deploymentAddresses: data, contracts }
    } 
    catch (error) 
    {
        if (error instanceof Error) 
        {
            return rejectWithValue(error.message)
        }
        return rejectWithValue(String(error))
    }
})

export const loadBlockchainData = createAsyncThunk<{ cryptocurrencies: { Label: string; Address: string }[] }, void, { state: { blockchain: BlockchainState } }>("blockchain/loadBlockchainData", async (_, { getState, rejectWithValue }) => 
{
    try {
        const { signer, deploymentAddresses, contracts } = getState().blockchain

        if (!signer || !deploymentAddresses) throw new Error("Missing blockchain connection or contracts")

        if (!contracts.EthereumContract || !contracts.USDCContract || !contracts.UniswapContract) throw new Error("Token contracts not initialized")

        const ethereumName = await contracts.EthereumContract.name()
        const ethereumSymbol = await contracts.EthereumContract.symbol()
        const usdcName = await contracts.USDCContract.name()
        const usdcSymbol = await contracts.USDCContract.symbol()
        const uniswapName = await contracts.UniswapContract.name()
        const uniswapSymbol = await contracts.UniswapContract.symbol()

        const cryptocurrencies = 
        [
            { Label: `${ethereumName} (${ethereumSymbol})`, Address: deploymentAddresses.EthereumAddress },
            { Label: `${usdcName} (${usdcSymbol})`, Address: deploymentAddresses.USDCAddress },
            { Label: `${uniswapName} (${uniswapSymbol})`, Address: deploymentAddresses.UniswapAddress },
        ]

        return { cryptocurrencies }
    } 
    catch (error) 
    {
        if (error instanceof Error) 
        {
            return rejectWithValue(error.message)
        }
        return rejectWithValue(String(error))
    }
})

export const loadBlockchainPositions = createAsyncThunk<{ positions: PositionData[] }, void, { state: { blockchain: BlockchainState } }>("blockchain/loadBlockchainPositions",async (_, { getState, rejectWithValue }) => 
{
    try 
    {
        const { signer, deploymentAddresses, contracts } = getState().blockchain
        if (!signer || !deploymentAddresses) throw new Error("Missing signer or contracts")

        const manager = contracts.UniswapV3NFTManagerContract
        if (!manager) throw new Error("UniswapV3NFTManagerContract not initialized")

        const address = await signer.getAddress()
        const totalSupply: bigint = await manager.totalSupply()
        const allPositions: PositionData[] = []

        for (let tokenId = 0n; tokenId < totalSupply; tokenId++) 
        {
            try 
            {
                const owner = await manager.ownerOf(tokenId)
                if (owner.toLowerCase() !== address.toLowerCase()) continue

                const extracted = await manager.positions(tokenId)
                const poolAddress = extracted.pool

                const pool = new ethers.Contract(poolAddress, UniswapV3Pool.abi, signer)
                const [token0Address, token1Address, feeRaw] = await Promise.all([pool.token0(), pool.token1(), pool.fee()])
                const fee = Number(feeRaw)

                const token0Contract = new ethers.Contract(token0Address, ERC20Mintable.abi, signer)
                const token1Contract = new ethers.Contract(token1Address, ERC20Mintable.abi, signer)

                const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([token0Contract.symbol(), token1Contract.symbol(), token0Contract.decimals(), token1Contract.decimals()])

                const slot0 = await pool.slot0()
                const tick = Number(slot0.tick)
                const sqrtPriceX96 = slot0.sqrtPriceX96
                const price = sqrtPToPriceNumber(sqrtPriceX96)

                const positionKey = ethers.keccak256(ethers.solidityPacked(["address", "int24", "int24"], [manager.target, extracted.lowerTick, extracted.upperTick]))
                const positionOnPool = await pool.positions(positionKey)
                const liquidity = positionOnPool.liquidity.toString()

                const token0 = new Token(1, token0Address, Number(decimals0), symbol0)
                const token1 = new Token(1, token1Address, Number(decimals1), symbol1)

                const poolSdk = new Pool(token0, token1, fee, sqrtPriceX96.toString(), liquidity, tick)
                const positionEntity = new Position({ pool: poolSdk, liquidity, tickLower: Number(extracted.lowerTick), tickUpper: Number(extracted.upperTick) })

                allPositions.push
                ({
                    tokenId,
                    token0Address,
                    token1Address,
                    token0: symbol0,
                    token1: symbol1,
                    fee,
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
                    token1Amount1: BigInt(positionEntity.amount1.quotient.toString()),
                })
            } 
            catch (error) 
            {
                console.log(error)
            }
        }

        return { positions: allPositions }
    } 
    catch (error) 
    {
        if (error instanceof Error) 
        {
            return rejectWithValue(error.message)
        }
        return rejectWithValue(String(error))
    }
})

export const fetchBalances = createAsyncThunk< { token0Balance: string; token1Balance: string }, { token0Address?: string; token1Address?: string }, { state: { blockchain: BlockchainState } }>("blockchain/fetchBalances", async ({ token0Address, token1Address }, { getState, rejectWithValue }) => 
{
    const { signer } = getState().blockchain
    if (!signer) return rejectWithValue("Signer not available")

    try 
    {
        const signerAddress = await signer.getAddress()

        let token0Balance = ""
        let token1Balance = ""

        if (token0Address && ethers.isAddress(token0Address)) 
        {
            const token0Contract = new ethers.Contract(token0Address, ERC20Mintable.abi, signer)
            const [rawBalance0, symbol0] = await Promise.all
            ([
                token0Contract.balanceOf(signerAddress),
                token0Contract.symbol(),
            ])
            token0Balance = `${ethers.formatEther(rawBalance0)} ${symbol0}`
        }

        if (token1Address && ethers.isAddress(token1Address)) 
        {
            const token1Contract = new ethers.Contract(token1Address, ERC20Mintable.abi, signer)
            const [rawBalance1, symbol1] = await Promise.all
            ([
                token1Contract.balanceOf(signerAddress),
                token1Contract.symbol(),
            ])
            token1Balance = `${ethers.formatEther(rawBalance1)} ${symbol1}`
        }

        return { token0Balance, token1Balance }
    } 
    catch (error) 
    {
        if (error instanceof Error) 
        {
            return rejectWithValue(error.message)
        }
        return rejectWithValue(String(error))
    }
})

export const doesPoolExist = createAsyncThunk<boolean, { token0Address: string, token1Address: string, fee: number }, { state: { blockchain: BlockchainState } }>("blockchain/doesPoolExist", async ({ token0Address, token1Address, fee }, { getState, rejectWithValue }) => 
{
    try 
    {
        const { contracts } = getState().blockchain
        
        if (!contracts.UniswapV3FactoryContract) return rejectWithValue("Missing required contract")

        const poolAddress = await contracts.UniswapV3FactoryContract.getPoolAddress(token0Address, token1Address, fee)
        return poolAddress !== '0x0000000000000000000000000000000000000000'
    } 
    catch (error) 
    {
        console.error("Error checking pool existence:", error)
        return rejectWithValue(error instanceof Error ? error.message : "Unknown error")
    }
})

export const getCurrentPoolPrice = createAsyncThunk<number, { token0Address: string, token1Address: string, fee: number, initialPrice: number }, { state: { blockchain: BlockchainState } }>("blockchain/getCurrentPoolPrice", async ({ token0Address, token1Address, fee, initialPrice }, { getState, dispatch, rejectWithValue }) => 
{
    try 
    {
        const { contracts, signer } = getState().blockchain
        
        if (!contracts.UniswapV3FactoryContract || !signer) 
        {
            return rejectWithValue("Missing required contracts or signer")
        }
        
        const poolExist = await dispatch(doesPoolExist({ token0Address, token1Address, fee })).unwrap()
        
        if (poolExist) 
        {
            const poolAddress = await contracts.UniswapV3FactoryContract.getPoolAddress(token0Address, token1Address, fee)
            const poolContract = getPoolContract(signer, poolAddress)
            const slot0 = await poolContract?.slot0()
            const sqrtPriceX96 = slot0.sqrtPriceX96
            const price = sqrtPToPriceNumber(sqrtPriceX96)
            return price
        } 
        else 
        {
            return initialPrice
        }
    } 
    catch (error) 
    {
        console.error("Error getting current pool price:", error)
        return rejectWithValue(error instanceof Error ? error.message : "Unknown error")
    }
})

export const fetchTwapPriceHistory = createAsyncThunk<{ pricesData: { date: string; price: number; secondsAgo: number }[]; priceDataMessage: string | undefined }, { token0Address: string; token1Address: string; fee: number; initialPrice?: number }, { state: { blockchain: BlockchainState } }>("blockchain/fetchTwapPriceHistory", async ({ token0Address, token1Address, fee, initialPrice = 0 }, { getState, dispatch, rejectWithValue }) => 
{
    try 
    {
        const { signer, contracts } = getState().blockchain
        if (!signer || !contracts.UniswapV3FactoryContract) 
        {
            throw new Error("Missing required data: contracts or signer")
        }

        const poolAddress = await contracts.UniswapV3FactoryContract.getPoolAddress(token0Address, token1Address, fee)
        if (!poolAddress) 
        {
            throw new Error("Could not retrieve pool address")
        }

        const poolContract = getPoolContract(signer, poolAddress)
        const pricesData: { date: string; price: number; secondsAgo: number }[] = []

        const maxMinutes = 10
        const points = 10
        const intervalMinutes = Math.floor(maxMinutes / points)

        console.log(`🕐 Starting TWAP history loop (latest back to 1 hour ago, ${points} points)...`)

        for (let i = 1; i <= points; i++) 
        {
            const minutesAgo = i * intervalMinutes
            const secondsAgo = minutesAgo * 60
            
            try 
            {
                const tickCumulatives = await poolContract?.observe([secondsAgo, 0])
                
                if (!tickCumulatives || tickCumulatives.length < 2) 
                {
                    console.warn(`⚠️ ${minutesAgo}min (${secondsAgo}s ago): No data returned`)
                    continue
                }
                
                const tickDifference = tickCumulatives[1] - tickCumulatives[0]
                const averageTick = BigInt(tickDifference) / BigInt(secondsAgo)
                const price = tickToPrice(Number(averageTick))
                
                const now = new Date()
                const pastTime = new Date(now.getTime() - secondsAgo * 1000)
                
                pricesData.unshift({
                    date: pastTime.toLocaleTimeString(),
                    price: price,
                    secondsAgo: secondsAgo
                })
                
                console.log(`✅ ${minutesAgo}min ago: price = ${price.toFixed(6)}`)
            }
            catch (err) 
            {
                console.warn(`⚠️ ${minutesAgo}min (${secondsAgo}s ago): Query failed -`, (err as Error).message)
                continue 
            }
        }

        try 
        {
            const poolExists = await dispatch(doesPoolExist({ token0Address, token1Address, fee })).unwrap()

            if (poolExists) 
            {
                const currentPoolPrice = await dispatch(getCurrentPoolPrice({ token0Address, token1Address, fee, initialPrice })).unwrap()
                
                const now = new Date()
                pricesData.push
                ({
                    date: now.toLocaleTimeString(),
                    price: currentPoolPrice,
                    secondsAgo: 0
                })
                console.log(`✅ Current price: ${currentPoolPrice.toFixed(6)}`)
            }
        }
        catch (err)
        {
            console.warn(`⚠️ Failed to fetch current price:`, (err as Error).message)
        }

        let priceDataMessage: string | undefined = undefined
        if (pricesData.length === 0) 
        {
            priceDataMessage = "Oracle price is not available"
        }

        console.log("🧾 Final TWAP history:", pricesData)
        return { pricesData, priceDataMessage }
    } 
    catch (error) 
    {
        if (error instanceof Error) 
        {
            return rejectWithValue(error.message)
        }
        return rejectWithValue(String(error))
    }
})

export const approveTokenTransaction = async ( tokenAddress: string | undefined, spenderAddress: string | undefined, amount: string, signer: ethers.Signer) => 
{
    if (!tokenAddress) throw new Error("Token address is required in approveTokenTransaction")
    if (!spenderAddress) throw new Error("Spender address is required in approveTokenTransaction")

    const approveTokenContract = new ethers.Contract(tokenAddress, ERC20Mintable.abi, signer)
    const parsedAmount = ethers.parseEther(amount)

    const tx = await approveTokenContract.approve(spenderAddress, parsedAmount)
    await tx.wait()

    console.log(`Approved ${amount} tokens for spender: ${spenderAddress}`)
    return tx
}

export const blockchainSlice = createSlice
({
    name: "blockchain",
    initialState,
    reducers: 
    {
        resetError(state) 
        {
            state.error = undefined
        },
    },
    extraReducers: (builder) => 
    {
        builder.addCase(initializeMetaMaskSDK.fulfilled, (state, action) => 
        { 
            const plainState = current(state)
            return {
                    ...plainState,
                    sdk: action.payload,
                } as BlockchainState
        }).addCase(connectWallet.pending, (state) => 
        { 
            state.status = "loading" 
        }).addCase(connectWallet.fulfilled, (state, action) => 
        {
            state.status = "idle"
            state.account = action.payload.account
            state.isConnected = true
            state.signer = action.payload.signer
        }).addCase(connectWallet.rejected, (state, action) => 
        {
            state.status = "failed"
            state.error = action.payload as string
            state.isConnected = false
        }).addCase(disconnectWallet.fulfilled, (state) => 
        { 
            Object.assign(state, initialState) 
        }).addCase(fetchDeploymentData.fulfilled, (state, action) => 
        {
            state.deploymentAddresses = action.payload.deploymentAddresses
            Object.assign(state.contracts, action.payload.contracts)
        }).addCase(loadBlockchainData.fulfilled, (state, action) => 
        { 
            state.cryptocurrencies = action.payload.cryptocurrencies 
        }).addCase(loadBlockchainPositions.fulfilled, (state, action) => 
        { 
            state.positions = action.payload.positions 
        }).addCase(fetchBalances.fulfilled, (state, action) => 
        {
            state.token0Balance = action.payload.token0Balance
            state.token1Balance = action.payload.token1Balance
        }).addCase(doesPoolExist.fulfilled, (state, action) => 
        {
            state.poolExists = action.payload
        }).addCase(getCurrentPoolPrice.fulfilled, (state, action) => 
        {
            state.currentPrice = action.payload
        }). addCase(fetchTwapPriceHistory.fulfilled, (state, action) => 
        {
            state.pricesData = action.payload.pricesData
            state.priceDataMessage = action.payload.priceDataMessage
        })
    },
})

export const { resetError } = blockchainSlice.actions

export const getPoolContract = (signer: ethers.JsonRpcSigner | undefined, address: string) => 
{
    if (!signer || !ethers.isAddress(address)) return undefined
    return new ethers.Contract(address, UniswapV3Pool.abi, signer)
}

export default blockchainSlice.reducer
