"use client"
import { MantineProvider} from '@mantine/core'
import { Card, Text, Grid, NumberInput, TextInput, Textarea, Button, ActionIcon, Group, Popover } from '@mantine/core'
// import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import classes from "../../../css_modules/swapmain.module.css"
import React from 'react'
import { useState } from 'react'
import { IconTransfer } from '@tabler/icons-react'
import { IconSettings } from '@tabler/icons-react'

export default function SwapMain() 
{
    const [swapValue1, setSwapValue1] = useState('')
    const [swapValue2, setSwapValue2] = useState('')
    const [selectedTab, setSelectedTab] = useState('Swap')

    return (
        <div className="bg-white mt-[5%] h-screen">
            <Grid justify="center" align="center">
            
                <Grid.Col span={4}>

                    <Group>
                    {['Swap', 'Limit', 'Send'].map((label) => (
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
                            <Textarea
                            size='xl'
                            classNames= {{description: classes.swap_text_area}}
                            value={swapValue1}
                            onChange={(event) => setSwapValue1(event.currentTarget.value)}
                            description="Sell"
                            placeholder="0"
                            rightSection=
                            {
                                <Button size="sm" radius="xl">
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
                                <Button size="sm" radius="xl">
                                    Select Token
                                </Button>
                            }
                            rightSectionWidth={135}
                            />

                        <Button fullWidth radius="md" className= "mt-[10%]">Connect wallet</Button>

                    </Card>
                </Grid.Col>
            </Grid>
        </div>
    )
}