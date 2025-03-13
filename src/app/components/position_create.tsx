"use client"
import { useState, useRef, useEffect } from 'react'
import { Button, Group, Box, Text, Flex, Card, Table, Breadcrumbs, Grid, Stepper, MultiSelect, Modal, Input, NumberInput, Stack, ActionIcon, Textarea, ScrollArea, UnstyledButton} from '@mantine/core'
// import { LineChart } from '@mantine/charts'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts"
import { IconPlus, IconMinus, IconCoinFilled, IconChevronDown, IconSearch, IconPercentage } from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'

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

    const data = 
    [
        { date: "Mar 22", Price: 2500 },
        { date: "Mar 23", Price: 2650 },
        { date: "Mar 24", Price: 3500 },
        { date: "Mar 24", Price: 3100 },
        { date: "Mar 27", Price: 2950 },
        { date: "Mar 28", Price: 2800 },
    ]

    type data = {date: string; Price: number}

    const getPriceRange = (data: data[]): {highestPrice: number; lowestPrice: number, graphMaxPrice: number; graphMinPrice: number} => 
    {
        const prices = data.map((item: data) => item.Price)
        const highestPrice = Math.max(...prices)
        const lowestPrice = Math.min(...prices)
        
        const graphMaxPrice = highestPrice * 1.2
        const graphMinPrice = lowestPrice * 0.8
    
        return {
            highestPrice,
            lowestPrice,
            graphMaxPrice,
            graphMinPrice
        }
    }
    

    //Breadcrumbs handling
    const links = 
    [
        { title: 'Your positions'},
        { title: 'New position'}
    ]
    .map((link, index) => 
    (
        <Text size="md" fw={750} c="#4f0099">
            {link.title}
        </Text>
    ))

export default function PositionCreate() 
{
    //For appending of token list
    const viewportRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState('');
    const [hovered, setHovered] = useState(-1);
    const filtered = cryptocurrencies.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
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

    //For setting liquidity price range
    let {highestPrice, lowestPrice, graphMaxPrice, graphMinPrice } = getPriceRange(data)

    const [minPrice, setMinPrice] = useState(2700)
    const [maxPrice, setMaxPrice] = useState(3100)
    
    
    const [draggingType, setDraggingType] = useState<"min" | "max" | null>(null)
    const chartRef = useRef<HTMLDivElement>(null)

    //For handling of modal opening and closing
    const [opened1, { open: open1, close: close1 }] = useDisclosure(false)
    const [opened2, { open: open2, close: close2 }] = useDisclosure(false)
    
    useEffect(() => 
    {
    
        const handleMinPriceMove = (event: MouseEvent) => 
        {
            if (!chartRef.current) return
            
    
            const rect = chartRef.current.getBoundingClientRect()
            const offsetY = event.clientY - rect.top
            const chartHeight = rect.height
            
            let newMinPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))
            
            if (newMinPrice > maxPrice - 10) 
            {
                newMinPrice = maxPrice - 10
            } 
            else if (newMinPrice < lowestPrice) 
            {
                newMinPrice = lowestPrice
            }
            
            setMinPrice(newMinPrice)
        }

        const handleMaxPriceMove = (event: MouseEvent) => 
        {
            if (!chartRef.current) return
            
            const rect = chartRef.current.getBoundingClientRect()
            const offsetY = event.clientY - rect.top
            const chartHeight = rect.height
            
            let newMaxPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))
            
            if (newMaxPrice < minPrice + 10) 
            {
                newMaxPrice = minPrice + 10
            } 
            else if (newMaxPrice > highestPrice) 
            {
                newMaxPrice = highestPrice
            }
            
            setMaxPrice(newMaxPrice)
        }
        
    
        const handleMouseUp = () => 
        {
            setDraggingType(null)
            document.removeEventListener("mousemove", handleMaxPriceMove)
            document.removeEventListener("mousemove", handleMinPriceMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
        
        if (draggingType === "max") 
        {
            document.addEventListener("mousemove", handleMaxPriceMove)    
        } 
        else if (draggingType === "min") 
        {
            document.addEventListener("mousemove", handleMinPriceMove)
            
        }
    
        document.addEventListener("mouseup", handleMouseUp)
        
        return () => 
        {
            document.removeEventListener("mousemove", handleMaxPriceMove)
            document.removeEventListener("mousemove", handleMinPriceMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
        
    }, [draggingType])
    
    //Stepper functions
    const [stepActive, setStepActive] = useState(1)
    const [highestStepVisited, setHighestStepVisited] = useState(stepActive)

    const HandleStepChange = (nextStep: number) => 
    {
        const isOutOfBounds = nextStep > 2 || nextStep < 0 // Allow step 0
        if (isOutOfBounds) return
    
        setStepActive(nextStep + 1)
        setHighestStepVisited((hSC) => Math.max(hSC, nextStep))
    }
    
    const shouldAllowSelectStep = (step: number) => highestStepVisited >= step
    
    const handleStepClick = (step: number) => 
    {
        if (shouldAllowSelectStep(step)) 
        {
            setStepActive(step + 1)
        }
    }

    //Toggle visibility of set fee component
    const [isVisible, setIsVisible] = useState(false)

    const toggleVisibility = () => 
    {
      setIsVisible((prev) => !prev)
    }

    return (
        <>

            <Grid ml={200} mt={50}>
                <Grid.Col span={12}>
                    <Box className="flex flex-wrap p-4">
                        <Breadcrumbs separator="→" separatorMargin="sm" mt="xs">
                            {links}
                        </Breadcrumbs>
                    </Box>
                </Grid.Col>

                <Grid.Col span={12}>
                    <Text className='!text-[30px]' fw={750} c="#4f0099" mt={10}>
                        New position
                    </Text>
                </Grid.Col>

                <Grid.Col span={{ base: 10, md: 10, lg: 4 }} mt={7}>
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Stepper active={stepActive} onStepClick={handleStepClick} orientation='vertical'>
                            <Stepper.Step
                                label="Step 1"
                                description="Select token pair and fees"
                                allowStepSelect={shouldAllowSelectStep(1)}
                            />
                            <Stepper.Step
                                label="Step 2"
                                description="Set price range and deposit amount"
                            />
                            <Stepper.Completed>
                                You are all set to add a new position!
                            </Stepper.Completed>
                        </Stepper>

                            {/* <Group justify="center" mt="xl">
                            <Button variant="default" onClick={() => HandleStepChange(stepActive - 1)}>
                                Back
                            </Button>
                            <Button onClick={() => HandleStepChange(stepActive + 1)}>Next step</Button>
                            </Group> */}
                    </Card>
                </Grid.Col>

                {stepActive === 1 && 
                (
                    <Grid.Col span={{ base: 5, md: 10, lg: 5 }}>
                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Text size="lg" fw={600} c="#4f0099">Select Pair</Text>
                            <Text mt={10} size="sm" c="gray"> Choose the tokens you want to provide liquidity for.</Text>

                            <Flex
                            mt="md"
                            gap="md"
                            direction={{ base: "column", sm: "row" }}
                            wrap="wrap"
                            >
                                <MultiSelect
                                data={[]}
                                placeholder="Select token"
                                onDropdownOpen={() => open1()}
                                />

                                <MultiSelect
                                data={[]}
                                placeholder="Select token"
                                onDropdownOpen={() => open2()}
                                />
                            </Flex>

                            <Text size="lg" fw={600} c="#4f0099" mt={30}>Fee tier</Text>
                            <Text mt={10} size="sm" c="gray">The amount earned providing liquidity</Text>

                            <Card shadow="sm" radius="md" withBorder mt={20}>
                                <Stack>
                                    <Group wrap="wrap" justify='space-between'>
                                        <Box>
                                            <Text size="md" fw={600} c="#4f0099">
                                            5% fee tier
                                            </Text>
                                            <Text size="sm" c="gray">
                                            The % you earn in fees
                                            </Text>
                                        </Box>
                                        <Button rightSection={<IconChevronDown size={16} />} onClick={toggleVisibility}>
                                            More
                                        </Button>
                                    </Group>
                                    
                                </Stack>
                                
                            </Card>

                            {isVisible && (
                                <Input
                                placeholder="Fee"
                                rightSection={<IconPercentage size={20} />} 
                                mt={20}
                                />
                            )}

                            <Button fullWidth radius="md" className= "mt-[5%]" onClick={() => HandleStepChange(stepActive)}>Continue</Button>

                        </Card>
                    </Grid.Col>
                )}

                {stepActive === 2 && 
                (
                    <Grid.Col span={{ base: 10, md: 5, lg: 5 }}>
                        <Box>
                            <Card shadow="sm" padding="lg" radius="md" mt={10} withBorder>
                            <Text size="lg" fw={600} c="#4f0099" mb={20}>Set price range</Text>
                                <div className="relative select-none" ref={chartRef}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={data}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis domain={[graphMinPrice, graphMaxPrice]} />
                                            <Tooltip />

                                            <ReferenceArea
                                            y1={minPrice}
                                            y2={maxPrice}
                                            fill="purple"
                                            fillOpacity={0.1}
                                            />

                                            <ReferenceLine
                                            y={minPrice}
                                            stroke="red"
                                            strokeWidth={5}
                                            label={({ viewBox }) => 
                                            (   
                                                <g>
                                                    <rect
                                                    x={viewBox.x + viewBox.x * 3.1}
                                                    y={viewBox.y - 6}
                                                    width="40"
                                                    height="10"
                                                    fill="purple"
                                                    onMouseDown={() => setDraggingType("min")}
                                                    cursor="ns-resize"
                                                    >
                                                    </rect>

                                                    <text
                                                    x={viewBox.x + viewBox.x * 2.9}
                                                    y={viewBox.y + 20}
                                                    fill='purple'
                                                    fontSize='11px'
                                                    fontWeight="bold"
                                                    >
                                                    {`Min: ${minPrice.toFixed(2)}`}
                                                    </text>
                                                </g>
                                            )}
                                            />
                                            <ReferenceLine
                                            y={maxPrice}
                                            stroke="green"
                                            strokeWidth={5}
                                            label={({ viewBox }) => 
                                            (
                                                <g>
                                                    <rect
                                                    x={viewBox.x + viewBox.x * 3.1}
                                                    y={viewBox.y - 6}
                                                    width="40"
                                                    height="10"
                                                    fill="purple"
                                                    onMouseDown={() => setDraggingType("max")}
                                                    cursor="ns-resize"
                                                    >
                                                    </rect>

                                                    <text
                                                    x={viewBox.x + viewBox.x * 2.9}
                                                    y={viewBox.y - 20}
                                                    fontSize='11px'
                                                    fill='purple'
                                                    fontWeight="bold"
                                                    >
                                                    {`Max: ${maxPrice.toFixed(2)}`}
                                                    </text>
                                                </g>
                                            )}
                                            />

                                            <Line type="monotone" dataKey="Price" stroke="purple" strokeWidth={3} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                    <Grid gutter="md" mt={10}>
                                    <Grid.Col span={{ base: 12, md: 12, lg: 6 }}>
                                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                                            <Flex justify="space-between" align="center">
                                                <Box>
                                                    <Text c="#4f0099" size="sm" fw={700}>Min price</Text>
                                                    <Input
                                                    c="#4f0099"
                                                    variant="unstyled"
                                                    size="xl"
                                                    value={parseFloat(minPrice.toFixed(2))}
                                                    onChange={(event) => setMinPrice(Number(event.target.value))}
                                                    onBlur={() => 
                                                    {
                                                        setMinPrice((prev1) => 
                                                        {
                                                            let newMinPrice = prev1

                                                            if (newMinPrice > maxPrice - 10) 
                                                            {
                                                                newMinPrice = maxPrice - 10
                                                            } 
                                                            else if (newMinPrice < lowestPrice) 
                                                            {
                                                                newMinPrice = lowestPrice
                                                            }

                                                            return newMinPrice
                                                        })
                                                    }}
                                                    />
                                                    <Text c="#4f0099" size="sm">NEAR per ETH</Text>
                                                </Box>

                                                <Stack>
                                                    <ActionIcon radius="xl">
                                                        <IconPlus size={20} />
                                                    </ActionIcon>
                                                    <ActionIcon radius="xl">
                                                        <IconMinus size={20} />
                                                    </ActionIcon>
                                                </Stack>
                                            </Flex>
                                        </Card>
                                    </Grid.Col>

                                    <Grid.Col span={{ base: 12, md: 12, lg: 6 }}>
                                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                                            <Flex justify="space-between" align="center">
                                                <Box>
                                                    <Text c="#4f0099" size="sm" fw={700}>Max price</Text>
                                                    <Input
                                                    c="#4f0099"
                                                    variant="unstyled"
                                                    size="xl"
                                                    value={parseFloat(maxPrice.toFixed(2))}
                                                    onChange={(event) => setMaxPrice(Number(event.target.value))}
                                                    onBlur={() => 
                                                    {
                                                        setMaxPrice((prev2) => 
                                                        {
                                                            let newMaxPrice = prev2

                                                            if (newMaxPrice < minPrice + 10) 
                                                            {
                                                                newMaxPrice = minPrice + 10
                                                            } 
                                                            else if (newMaxPrice > highestPrice) 
                                                            {
                                                                newMaxPrice = highestPrice
                                                            }
                                                            
                                                            return newMaxPrice
                                                        })
                                                    }}
                                                    />
                                                    <Text c="#4f0099" size="sm">NEAR per ETH</Text>
                                                </Box>

                                                <Stack>
                                                    <ActionIcon radius="xl">
                                                        <IconPlus size={20} />
                                                    </ActionIcon>
                                                    <ActionIcon radius="xl">
                                                        <IconMinus size={20} />
                                                    </ActionIcon>
                                                </Stack>
                                            </Flex>
                                        </Card>
                                    </Grid.Col>
                                </Grid>

                                <Text size="lg" fw={600} c="#4f0099" mt={30}>Deposit tokens</Text>
                                <Text mt={10} size="sm" c="gray">Specify the token amounts for your liquidity contribution.</Text>

                                <Textarea 
                                mt={20}
                                size='xl'
                                placeholder="0"
                                autosize={false}
                                minRows={3}
                                rightSection=
                                {
                                    <ActionIcon radius="xl">
                                        <IconCoinFilled size={40} />
                                    </ActionIcon>
                                }
                                rightSectionWidth={100}
                                />

                                <Textarea 
                                mt={20}
                                size='xl'
                                placeholder="0"
                                autosize={false} 
                                minRows={3} 
                                rightSection=
                                {
                                    <ActionIcon radius="xl">
                                        <IconCoinFilled size={40} />
                                    </ActionIcon>
                                }
                                rightSectionWidth={100}
                                />

                                <Button fullWidth radius="md" className= "mt-[10%]">Connect wallet</Button>

                            </Card>

                        </Box>
                    </Grid.Col>
                )}

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
                  setQuery(event.currentTarget.value);
                  setHovered(-1);
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
                    setQuery(event.currentTarget.value);
                    setHovered(-1);
                }}
                />
                <ScrollArea h={150} type="always" mt="md" viewportRef={viewportRef}>
                    {items}
                </ScrollArea>
            </Modal>

        </>

    )
}