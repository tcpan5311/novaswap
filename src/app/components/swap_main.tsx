"use client"
import { MantineProvider} from '@mantine/core'
import { Card, Text, Grid, NumberInput, TextInput, Textarea, Button, ActionIcon, Group, Popover, UnstyledButton, Modal, Input, ScrollArea } from '@mantine/core'
// import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import classes from "../../../css_modules/swapmain.module.css"
import React from 'react'
import { useState, useRef } from 'react'
import { IconTransfer, IconSettings, IconSearch } from '@tabler/icons-react'
import { useMediaQuery } from '@mantine/hooks'

const cryptocurrencies: string[] = 
[
    "Bitcoin (BTC)",
    "Solana (SOL)",
    "Ethereum (ETH)",
    "Ripple (XRP)",
    "Binance Coin (BNB)",
    "Uniswap (UNI)",
    "Monero (XMR)",
    "Dogecoin (DOGE)",
    "Tether (USDT)",
    "Cardano (ADA)",
]

export default function SwapMain() 
{
    const [swapValue1, setSwapValue1] = useState('')
    const [swapValue2, setSwapValue2] = useState('')
    const [selectedTab, setSelectedTab] = useState('Swap')
    const isSmallScreen = useMediaQuery('(max-width: 768px)')

    //For handling of modal opening and closing
    const [opened1, { open: open1, close: close1 }] = useDisclosure(false)
    const [opened2, { open: open2, close: close2 }] = useDisclosure(false)

    //For appending of token list
    const viewportRef = useRef<HTMLDivElement>(null)
    const [query, setQuery] = useState('')
    const [hovered, setHovered] = useState(-1)
    const filtered = cryptocurrencies.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
    const items = filtered.map((item, index) => 
    (
        <UnstyledButton
        data-list-item
        key={item}
        display="block"
        w="100%"
        p={5}
        >
        {item}
        </UnstyledButton>
    ))

    return (
        <div className="bg-white mt-[5%] h-screen">
            <Grid justify={isSmallScreen ? "flex-start ml-10" : "center"} align="center">
            
                <Grid.Col span="auto" className="w-[450px] min-w-[450px] max-w-[450px] md:ml-4">
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
                                classNames= {{description: classes.swap_text_area}}
                                value={swapValue1}
                                onChange={(event) => setSwapValue1(event.currentTarget.value)}
                                description="Sell"
                                placeholder="0"
                                rightSection=
                                {
                                    <Button size="sm" radius="xl" onClick={open1}>
                                        Select Token
                                    </Button>
                                }
                                rightSectionWidth={135}
                                />

                                <ActionIcon 
                                    size={42} 
                                    variant="default" 
                                    className= "self-center mt-[5%]" // Add this class
                                    >
                                    <IconTransfer size={24} />
                                </ActionIcon>

                                <Textarea
                                size='xl'
                                classNames= {{description: classes.swap_text_area}}
                                value={swapValue2}
                                onChange={(event) => setSwapValue2(event.currentTarget.value)}
                                description="Buy"
                                placeholder="0"
                                rightSection=
                                {
                                    <Button size="sm" radius="xl" onClick={open2}>
                                        Select Token
                                    </Button>
                                }
                                rightSectionWidth={135}
                                />

                                <Button fullWidth radius="md" className= "mt-[10%]">Connect wallet</Button>
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
                    {items}
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
                    {items}
                </ScrollArea>
            </Modal>
        </div>
    )
}