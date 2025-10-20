"use client"
import type { AppDispatch, RootState } from "./store"
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { PositionData } from "./types"
import { MetaMaskSDK } from "@metamask/sdk"
import { ethers } from "ethers"
import { Pool, Position } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'
import { sqrtPToPriceNumber, tickToPrice} from '../utils/compute_token_utils'


import ERC20Mintable from "../../../contracts/ERC20Mintable.json"
import UniswapV3Factory from "../../../contracts/UniswapV3Factory.json"
import UniswapV3Pool from "../../../contracts/UniswapV3Pool.json"
import UniswapV3Manager from "../../../contracts/UniswapV3Manager.json"
import UniswapV3NFTManager from "../../../contracts/UniswapV3NFTManager.json"
import UniswapV3Quoter from "../../../contracts/UniswapV3Quoter.json"

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
    EthereumContract?: ethers.Contract
    USDCContract?: ethers.Contract
    UniswapContract?: ethers.Contract
    UniswapV3FactoryContract?: ethers.Contract
    UniswapV3ManagerContract?: ethers.Contract
    UniswapV3NFTManagerContract?: ethers.Contract
    UniswapV3QuoterContract?: ethers.Contract
}

export interface BlockchainState 
{
    sdk: MetaMaskSDK | null
    account: string
    isConnected: boolean
    signer: ethers.JsonRpcSigner | null
    deploymentAddresses: DeploymentAddresses | null
    contracts: ContractReferences | null
    status: "idle" | "loading" | "failed"
    error?: string | null
    cryptocurrencies?: { Label: string; Address: string }[]
    positions?: PositionData[]
    token0Balance?: string
    token1Balance?: string
}

const initialState: BlockchainState = 
{
    sdk: null,
    account: "",
    isConnected: false,
    signer: null,
    deploymentAddresses: null,
    contracts: null,
    status: "idle",
    error: null,
    cryptocurrencies: [],
    positions: [],
    token0Balance: "0",
    token1Balance: "0",
}

export const initializeMetaMaskSDK = createAsyncThunk("blockchain/initSDK", async () => 
{
    const sdk = new MetaMaskSDK({ dappMetadata: { name: "Novaswap" } })
    return sdk
})

export const connectWallet = createAsyncThunk<{ account: string; provider: ethers.BrowserProvider; signer: ethers.JsonRpcSigner }, void, { state: { blockchain: BlockchainState }; dispatch: AppDispatch }>("blockchain/connectWallet", async (_, { getState, dispatch, rejectWithValue }) => 
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
    catch (err: any) 
    {
        return rejectWithValue(err.message)
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
    catch (err: any) 
    {
        return rejectWithValue(err.message)
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
            UniswapV3FactoryContract: new ethers.Contract(data.UniswapV3FactoryAddress, UniswapV3Factory.abi, signer),
            UniswapV3ManagerContract: new ethers.Contract(data.UniswapV3ManagerAddress, UniswapV3Manager.abi, signer),
            UniswapV3NFTManagerContract: new ethers.Contract(data.UniswapV3NFTManagerAddress, UniswapV3NFTManager.abi, signer),
            UniswapV3QuoterContract: new ethers.Contract(data.UniswapV3QuoterAddress, UniswapV3Quoter.abi, signer),
        }

        return { deploymentAddresses: data, contracts }
    } 
    catch (err: any) 
    {
        return rejectWithValue(err.message)
    }
})

export const loadBlockchainData = createAsyncThunk<{ cryptocurrencies: { Label: string; Address: string }[] }, void, { state: { blockchain: BlockchainState } }>("blockchain/loadBlockchainData", async (_, { getState, rejectWithValue }) => 
{
    try {
        const { signer, deploymentAddresses, contracts } = getState().blockchain

        if (!signer || !deploymentAddresses || !contracts)
        throw new Error("Missing blockchain connection or contracts")

        const 
        [
            ethereumName,
            ethereumSymbol,
            usdcName,
            usdcSymbol,
            uniswapName,
            uniswapSymbol,
        ] 
        = await Promise.all
        ([
            contracts.EthereumContract?.name(),
            contracts.EthereumContract?.symbol(),
            contracts.USDCContract?.name(),
            contracts.USDCContract?.symbol(),
            contracts.UniswapContract?.name(),
            contracts.UniswapContract?.symbol(),
        ])

        const cryptocurrencies = 
        [
            {
                Label: `${ethereumName} (${ethereumSymbol})`,
                Address: deploymentAddresses.EthereumAddress,
            },
            {
                Label: `${usdcName} (${usdcSymbol})`,
                Address: deploymentAddresses.USDCAddress,
            },
            {
                Label: `${uniswapName} (${uniswapSymbol})`,
                Address: deploymentAddresses.UniswapAddress,
            },
        ]

        return { cryptocurrencies }
    } 
    catch (err: any) 
    {
        return rejectWithValue(err.message)
    }
})

export const loadBlockchainPositions = createAsyncThunk<{ positions: PositionData[] }, void, { state: { blockchain: BlockchainState } }>("blockchain/loadBlockchainPositions",async (_, { getState, rejectWithValue }) => 
{
    try 
    {
        const { signer, deploymentAddresses, contracts } = getState().blockchain
        if (!signer || !deploymentAddresses || !contracts?.UniswapV3NFTManagerContract)
        throw new Error("Missing signer or contracts")

        const manager = contracts.UniswapV3NFTManagerContract
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
                const [token0Address, token1Address, feeRaw] = await Promise.all
                ([
                    pool.token0(),
                    pool.token1(),
                    pool.fee(),
                ])
                const fee = Number(feeRaw)

                const token0Contract = new ethers.Contract(token0Address, ERC20Mintable.abi, signer)
                const token1Contract = new ethers.Contract(token1Address, ERC20Mintable.abi, signer)

                const [symbol0, symbol1, decimals0, decimals1] = await Promise.all
                ([
                    token0Contract.symbol(),
                    token1Contract.symbol(),
                    token0Contract.decimals(),
                    token1Contract.decimals(),
                ])

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
                const positionEntity = new Position
                ({
                    pool: poolSdk,
                    liquidity,
                    tickLower: Number(extracted.lowerTick),
                    tickUpper: Number(extracted.upperTick),
                })

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
    catch (err: any) 
    {
        return rejectWithValue(err.message)
    }
})

export const fetchBalances = createAsyncThunk<{ token0Balance: string; token1Balance: string }, { token0Address: string | null; token1Address: string | null }, { state: { blockchain: BlockchainState } }>("blockchain/fetchBalances", async ({ token0Address, token1Address }, { getState, rejectWithValue }) => 
{
    const { signer } = getState().blockchain
    if (!signer) return rejectWithValue("Signer not available")

    try 
    {
        const signerAddress = await signer.getAddress()

        let token0Balance = "0"
        let token1Balance = "0"

        if (token0Address) 
        {
            const token0Contract = new ethers.Contract(token0Address, ERC20Mintable.abi, signer)
            const rawBalance0 = await token0Contract.balanceOf(signerAddress)
            const symbol0 = await token0Contract.symbol()
            token0Balance = `${ethers.formatEther(rawBalance0)} ${symbol0}`
        }

        if (token1Address) 
        {
            const token1Contract = new ethers.Contract(token1Address, ERC20Mintable.abi, signer)
            const rawBalance1 = await token1Contract.balanceOf(signerAddress)
            const symbol1 = await token1Contract.symbol()
            token1Balance = `${ethers.formatEther(rawBalance1)} ${symbol1}`
        }
        
        return { token0Balance, token1Balance }
    } 
    catch (err: any) 
    {
        return rejectWithValue(err.message)
    }
})

export const blockchainSlice = createSlice
({
    name: "blockchain",
    initialState,
    reducers: 
    {
        resetError(state) 
        {
            state.error = null
        },
    },
    extraReducers: (builder) => 
    {
        builder.addCase(initializeMetaMaskSDK.fulfilled, (state, action) => 
        {
            state.sdk = action.payload as any
        }).addCase(connectWallet.pending, (state) => 
        {
            state.status = "loading"
        }).addCase(connectWallet.fulfilled, (state, action) => 
        {
            state.status = "idle"
            state.account = action.payload.account
            state.isConnected = true
            state.signer = action.payload.signer as any
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
            state.contracts = action.payload.contracts as any 
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
        })
    },
})

export const { resetError } = blockchainSlice.actions

export const getPoolContract = (signer: ethers.JsonRpcSigner | null, address: string) => 
{
    if (!signer || !ethers.isAddress(address)) return null
    return new ethers.Contract(address, UniswapV3Pool.abi, signer)
}

export default blockchainSlice.reducer
