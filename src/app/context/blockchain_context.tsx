"use client"
import React, { createContext, useContext, useState, useEffect, useRef } from "react"
import { MetaMaskSDK } from "@metamask/sdk"

interface BlockchainContextType 
{
    account: string
    isConnected: boolean
    connectWallet: () => Promise<void>
    disconnectWallet: () => Promise<void>
}

const BlockchainContext = createContext<BlockchainContextType | undefined>(undefined)

export const BlockchainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => 
{
    const [sdk, setSdk] = useState<MetaMaskSDK | null>(null)
    const [account, setAccount] = useState("")
    const [isConnected, setIsConnected] = useState(false)
    const connectRef = useRef(false)

    useEffect(() => 
    {
        const initSDK = new MetaMaskSDK({dappMetadata: { name: "Novaswap" },})
        setSdk(initSDK)
    }, [])

    const connectWallet = async () => 
    {
        try 
        {
            if (sdk) 
            {
                const accounts = await sdk.connect()
                if (accounts && accounts.length > 0) {
                    const formatted = accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4)
                    setAccount(formatted)
                    connectRef.current = true
                    setIsConnected(true)
                }
            }
        } catch (err) 
        {
            console.error("Wallet connection failed:", err)
            connectRef.current = false
            setIsConnected(false)
        }
    }

    const disconnectWallet = async () => 
    {
        try 
        {
            if (sdk) {
            await sdk.terminate()
            connectRef.current = false
            setAccount("")
            setIsConnected(false)
            }
        } 
        catch (err) 
        {
            console.error("Wallet disconnection failed:", err)
        }
    }

    return (
    <BlockchainContext.Provider value={{ account, isConnected, connectWallet, disconnectWallet }}>
        {children}
    </BlockchainContext.Provider>
    )
}

export const UseBlockchain = (): BlockchainContextType => 
{
    const context = useContext(BlockchainContext)
    if (!context) throw new Error("Blockchain Context must be used within a Blockchain Context")
    return context
}
