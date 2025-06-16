"use client"
import React, {createContext, useContext, useState, useEffect, useRef} from "react"
import { MetaMaskSDK } from "@metamask/sdk"
import { ethers } from "ethers"
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'
import UniswapV3Factory from '../../../contracts/UniswapV3Factory.json'
import UniswapV3Pool from '../../../contracts/UniswapV3Pool.json'
import UniswapV3Manager from '../../../contracts/UniswapV3Manager.json'
import UniswapV3NFTManager from '../../../contracts/UniswapV3NFTManager.json'
import UniswapV3Quoter from '../../../contracts/UniswapV3Quoter.json'

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

interface BlockchainContextType 
{
    account: string
    isConnected: boolean
    connectWallet: () => Promise<void>
    disconnectWallet: () => Promise<void>
    provider: ethers.BrowserProvider | null
    signer: ethers.JsonRpcSigner | null
    deploymentAddresses: DeploymentAddresses | null
    contracts: ContractReferences | null
    getPoolContract: (address: string) => ethers.Contract | null
}


const BlockchainContext = createContext<BlockchainContextType | undefined>(undefined)

export const BlockchainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => 
{
    const [sdk, setSdk] = useState<MetaMaskSDK | null>(null)
    const [account, setAccount] = useState("")
    const [isConnected, setIsConnected] = useState(false)
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
    const connectRef = useRef(false)
    const [deploymentAddresses, setDeploymentAddresses] = useState<DeploymentAddresses | null>(null)
    const [contracts, setContracts] = useState<ContractReferences | null>(null)

    useEffect(() => 
    {
      const init = async () => 
      {
        initializeMetaMaskSDK()
      }

      init()

    }, [])

    useEffect(() => 
    {
      if (signer) 
      {
        fetchDeploymentEnvironmentVariables()
      }
    }, [signer])

    const initializeMetaMaskSDK = () => 
    {
      const initSDK = new MetaMaskSDK
      ({
          dappMetadata: 
          {
              name: "Novaswap"
          }
      })
      setSdk(initSDK)
  }
    
    const connectWallet = async () => 
    {
        try 
        {
            if (sdk) 
            {
            const accounts = await sdk.connect()
                if (accounts && accounts.length > 0) 
                {
                    const formatted = accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4)
                    setAccount(formatted)
                    connectRef.current = true
                    setIsConnected(true)

                    const ethProvider = new ethers.BrowserProvider(window.ethereum)
                    setProvider(ethProvider)

                    const ethSigner = await ethProvider.getSigner()
                    setSigner(ethSigner)
                }
            }
        } 
        catch (err) 
        {
            console.error("Wallet connection failed:", err)
            connectRef.current = false
            setIsConnected(false)
            setAccount("")
            setProvider(null)
            setSigner(null)
        }
    }

  const disconnectWallet = async () => {
    try {
      if (sdk) {
        await sdk.terminate()
        connectRef.current = false
        setAccount("")
        setIsConnected(false)
        setProvider(null)
        setSigner(null)
      }
    } catch (err) {
      console.error("Wallet disconnection failed:", err)
    }
  }

      const fetchDeploymentEnvironmentVariables = async () =>
    {
       if (!signer) return

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
              setDeploymentAddresses(json.data)

              setContracts
              ({
                EthereumContract: new ethers.Contract(json.data.EthereumAddress, ERC20Mintable.abi, signer),
                USDCContract: new ethers.Contract(json.data.USDCAddress, ERC20Mintable.abi, signer),
                UniswapContract: new ethers.Contract(json.data.UniswapAddress, ERC20Mintable.abi, signer),
                UniswapV3FactoryContract: new ethers.Contract(json.data.UniswapV3FactoryAddress, UniswapV3Factory.abi, signer),
                UniswapV3ManagerContract: new ethers.Contract(json.data.UniswapV3ManagerAddress, UniswapV3Manager.abi, signer),
                UniswapV3NFTManagerContract: new ethers.Contract(json.data.UniswapV3NFTManagerAddress, UniswapV3NFTManager.abi, signer),
                UniswapV3QuoterContract: new ethers.Contract(json.data.UniswapV3QuoterAddress, UniswapV3Quoter.abi, signer),
              })

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

    const getPoolContract = (address: string): ethers.Contract | null => 
    {
      if (!signer || !ethers.isAddress(address)) 
      {
        return null
      }
      return new ethers.Contract(address, UniswapV3Pool.abi, signer)
    }

  return (
    <BlockchainContext.Provider
    value=
    {{
      account,
      isConnected,
      connectWallet,
      disconnectWallet,
      provider,
      signer,
      deploymentAddresses,
      contracts,
      getPoolContract
    }}
    >
      {children}
    </BlockchainContext.Provider>
  )
}

export const UseBlockchain = (): BlockchainContextType => 
{
    const context = useContext(BlockchainContext)
    if (!context) 
    {
    throw new Error("Blockchain Context must be used within a BlockchainProvider")
    }
    return context
}
