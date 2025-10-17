"use client"
import { useDispatch, useSelector } from "react-redux"
import {connectWallet, disconnectWallet, initializeMetaMaskSDK, fetchDeploymentData,} from "../redux/blockchain_slice"
import { blockchainSelector } from '../redux/blockchain_selectors'
import type { AppDispatch } from "../redux/store"
import { Group, Button, Text, Popover } from '@mantine/core'
import React from 'react'
import { useEffect } from 'react'
import { IconWallet, IconSettingsCheck, IconPlugConnectedX, IconBrandSupernova } from '@tabler/icons-react'
import { useRouter } from "next/navigation"

const links = 
[
    { link: '/', label: 'Trade' },
    { link: '/details', label: 'Details' },
    { link: '/position_main', label: 'Pool' },
]

export default function Header() 
{   
    const router = useRouter()
    const dispatch = useDispatch<AppDispatch>()
    const { account, isConnected } = useSelector(blockchainSelector)

    useEffect(() => 
    {
        dispatch(initializeMetaMaskSDK())
        if (isConnected) 
        {
        dispatch(fetchDeploymentData())
        }
    }, [isConnected, dispatch])

    const handleNavigation = (path: string) => router.push(path)

    const items = links.map((link) => 
    (
        <Text
        c = "white"
        size = "sm"
        key={link.label}
        component="span"
        className="cursor-pointer"
        onClick={() => handleNavigation(link.link)}
        >
        {link.label}
      </Text>
    ))

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
                        onClick={() => dispatch(connectWallet())}
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
                            onClick={() => dispatch(disconnectWallet())}
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
