"use client"
// import { IconSearch } from '@tabler/icons-react'
import { MantineProvider, Autocomplete, Burger, Group, Button, Text, Popover } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconBrandSupernova } from '@tabler/icons-react'
import React from 'react'
import { MetaMaskSDK } from "@metamask/sdk"
import { ethers } from "ethers"
import { useState, useEffect, useRef } from 'react'
import { IconWallet, IconSettingsCheck, IconPlugConnectedX } from '@tabler/icons-react'
import { useRouter } from "next/navigation"
// import {classes} from "../../../css_modules/header.module.css"

const links = 
[
    { link: '/', label: 'Trade' },
    { link: '/details', label: 'Details' },
    { link: '/position_main', label: 'Pool' },
]

export default function Header() 
{
    const [MMSDK, setMMSDK] = useState<MetaMaskSDK | null>(null)
    const [account, setAccount] = useState("")
    const [balance, setBalance] = useState(null)
    const connectRef = useRef(false)
    const [isConnected, setIsConnected] = useState(false)
    const router = useRouter()
    const [opened, { toggle }] = useDisclosure(false)

    useEffect(() => 
    {
        const sdk = new MetaMaskSDK
        ({
            dappMetadata: { name: "Novaswap" },
        })
        setMMSDK(sdk)
        
    }, []);

    const HandleNavigation = (path: string) => 
    {
        router.push(path);
    }

    const items = links.map((link) => 
    (
        <Text
        c = "white"
        size = "sm"
        key={link.label}
        component="span"
        className="cursor-pointer"
        onClick={() => HandleNavigation(link.link)}
        >
        {link.label}
      </Text>
    ))

    const ConnectWallet = async () => 
    {
        try 
        {
            if(MMSDK)
            {
                const accounts = await MMSDK.connect()
            
                if (accounts && accounts.length > 0) 
                {
                    connectRef.current = true
                    setAccount(accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4))
                    setIsConnected(true)
                    console.log(isConnected)
                } 
                else 
                {
                    console.warn("No accounts returned")
                    connectRef.current = false
                    setIsConnected(false)
                }
            }

        } 
        catch (err) 
        {
            console.error("Failed to connect wallet:", err)
            connectRef.current = false
            setIsConnected(false)
        } 

    }

    const DisconnectWallet = async () => 
    {
        try 
        {
            if(MMSDK)
            {
                const accounts = await MMSDK.terminate()
                console.log(accounts)
                connectRef.current = false
                setAccount("")
                setIsConnected(false)
                console.log(isConnected)
            }

        } 
        catch (err) 
        {
            console.error("Error disconnecting wallet:", err)
        }
    }

    return (
            <header className="h-[60px] bg-[#390066] border-b border-gray-300 dark:border-gray-700 px-4 md:px-6">
                <div className="h-[60px] flex justify-between items-center">

                <Group>
                <IconBrandSupernova       
                stroke={1.5}
                size={45}
                color='white' />
                <Text 
                size="lg"
                fw={800}
                c='white'>
                NOVASWAP
                </Text>
                </Group>

                <Group>
                <Group ml={50} gap={20} visibleFrom="sm">
                {items}

                {!isConnected ? 
                (
                    <Button 
                    className="!bg-black !text-white hover:!bg-black hover:!text-white"
                    rightSection={<IconWallet size={24}/>} 
                    onClick={ConnectWallet}
                    >
                    Connect Wallet
                    </Button>
                ) 
                : 
                (
                    <Popover width={300} trapFocus position="bottom" withArrow shadow="md">
                    <Popover.Target>
                        <Button 
                        className="!bg-black !text-white hover:!bg-black hover:!text-white"
                        leftSection={<IconSettingsCheck size={24}/>} 
                        >
                        {account}
                        </Button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Button 
                        className="!bg-black !text-white hover:!bg-black hover:!text-white" 
                        rightSection={<IconPlugConnectedX size={24}/>} 
                        onClick={DisconnectWallet}
                        >
                        Disconnect
                        </Button>
                    </Popover.Dropdown>
                    </Popover>

                )}
                
                </Group>
                </Group>
                </div>
            </header>
    )
}
