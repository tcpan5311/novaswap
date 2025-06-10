"use client"
import React, {createContext, useContext, useState, useEffect, useRef} from "react"
import { MetaMaskSDK } from "@metamask/sdk"
import { ethers } from "ethers"

interface BlockchainContextType 
{
    account: string
    isConnected: boolean
    connectWallet: () => Promise<void>
    disconnectWallet: () => Promise<void>
    provider: ethers.BrowserProvider | null
    signer: ethers.JsonRpcSigner | null
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

    useEffect(() => 
    {
        const initSDK = new MetaMaskSDK
        ({
            dappMetadata: 
            {
            name: "Novaswap"
            }
        })
        setSdk(initSDK)
    }, [])

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

  return (
    <BlockchainContext.Provider
    value=
    {{
    account,
    isConnected,
    connectWallet,
    disconnectWallet,
    provider,
    signer
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
