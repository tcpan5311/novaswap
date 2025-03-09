"use client"
import { useState, useRef, useEffect } from 'react'
import { Button, Group, Box, Text, Flex, Card, Table, Breadcrumbs, Grid, Stepper, MultiSelect, Modal, } from '@mantine/core'
// import { LineChart } from '@mantine/charts'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts"

    const data = 
    [
        { date: "Mar 22", Price: 2500 },
        { date: "Mar 23", Price: 2650 },
        { date: "Mar 24", Price: 3100 },
        { date: "Mar 25", Price: 2950 },
        { date: "Mar 26", Price: 2800 },
    ]

    type data = {date: string; Price: number}

    const getPriceRange = (data: data[]): {graphMaxPrice: number; graphMinPrice: number} => 
    {
        const prices = data.map((item: data) => item.Price)
        const highestPrice = Math.max(...prices)
        const lowestPrice = Math.min(...prices)
    
        const graphMaxPrice = highestPrice * 1.2
        const graphMinPrice = lowestPrice * 0.8
    
        return {
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

    let {graphMaxPrice, graphMinPrice } = getPriceRange(data);

    const [minPrice, setMinPrice] = useState(2700)
    const [maxPrice, setMaxPrice] = useState(2900)
    
    
    const [draggingType, setDraggingType] = useState<"min" | "max" | null>(null)
    const chartRef = useRef<HTMLDivElement>(null)
    
    
    useEffect(() => 
    {
        const handleMaxPriceMove = (event: MouseEvent) => 
        {
            if (!chartRef.current) return
            
            const rect = chartRef.current.getBoundingClientRect()
            const offsetY = event.clientY - rect.top
            const chartHeight = rect.height
            
            let newMaxPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))
            
            newMaxPrice = Math.max(newMaxPrice, minPrice + 10)
            newMaxPrice = Math.min(newMaxPrice, 3100)
            setMaxPrice(newMaxPrice)
        }
        
    
        const handleMinPriceMove = (event: MouseEvent) => 
        {
            if (!chartRef.current) return
            
    
            const rect = chartRef.current.getBoundingClientRect()
            const offsetY = event.clientY - rect.top
            const chartHeight = rect.height
            
            let newMinPrice = graphMaxPrice - ((offsetY / chartHeight) * (graphMaxPrice - graphMinPrice))
            
            newMinPrice = Math.min(newMinPrice, maxPrice - 10)
            newMinPrice = Math.max(newMinPrice, 2500)
            
            setMinPrice(newMinPrice)
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
    
    const [stepActive, setStepActive] = useState(1)
    const [highestStepVisited, setHighestStepVisited] = useState(stepActive)

    const HandleStepChange = (nextStep: number) => 
    {
        const isOutOfBounds = nextStep > 3 || nextStep <= 0

        if (isOutOfBounds) 
        {
            return
        }

        setStepActive(nextStep)
        setHighestStepVisited((hSC) => Math.max(hSC, nextStep))
    }
    const shouldAllowSelectStep = (step: number) => highestStepVisited >= step && stepActive !== step


    return (
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

            <Grid.Col span={{ base: 10, md: 10, lg: 4 }}>
                <Card shadow="md" p="lg" radius="md" className="bg-gray-100">
                    <Stepper active={stepActive} onStepClick={setStepActive} orientation='vertical'>
                        <Stepper.Step
                        label="Step 1"
                        description="Select token pair and fees"
                        allowStepSelect={shouldAllowSelectStep(0)}
                        >
                        </Stepper.Step>

                        <Stepper.Step
                        label="Step 2"
                        description="Set price range and deposit amount"
                        allowStepSelect={shouldAllowSelectStep(1)}
                        >
                        </Stepper.Step>

                        <Stepper.Completed>
                            Completed, click back button to get to previous step
                        </Stepper.Completed>
                    </Stepper>

                        <Group justify="center" mt="xl">
                        <Button variant="default" onClick={() => HandleStepChange(stepActive - 1)}>
                            Back
                        </Button>
                        <Button onClick={() => HandleStepChange(stepActive + 1)}>Next step</Button>
                        </Group>
                </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 10, md: 10, lg: 5 }}>
                <Card shadow="md" p="lg" radius="md" className="bg-gray-200">
                    <Text size="lg" fw={600} c="#4f0099">Select Pair</Text>
                    <Text mt={10} size="sm" c="gray"> Choose the tokens you want to provide liquidity for.</Text>

                    <Flex
                    mt="md"
                    gap="md"
                    direction={{ base: "column", sm: "row" }} // Stacked on mobile, row on larger screens
                    wrap="wrap"
                    >
                        <MultiSelect
                        data={[]}
                        placeholder="Select token"
                        onDropdownOpen={() => console.log("Hello, World!")}
                        />

                        <MultiSelect
                        data={[]}
                        placeholder="Select token"
                        onDropdownOpen={() => console.log("Hello, World!")}
                        />
                    </Flex>

                    <Text size="lg" fw={600} c="#4f0099" mt={30}>Fee tier</Text>
                    <Text mt={10} size="sm" c="gray">The amount earned providing liquidity</Text>

                </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 10, md: 10, lg: 5 }}>
                <Box>
                    <Card mt={10}>
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
                                        y={viewBox.y - 7}
                                        width="40"
                                        height="15"
                                        fill="purple"
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
                                onMouseDown={() => setDraggingType("min")}
                                cursor="ns-resize"
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
                                        y={viewBox.y - 7}
                                        width="40"
                                        height="15"
                                        fill="purple"
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
                                onMouseDown={() => setDraggingType("max")}
                                cursor="ns-resize"
                                />

                                <Line type="monotone" dataKey="Price" stroke="purple" strokeWidth={3} />
                            </LineChart>
                        </ResponsiveContainer>
                        </div>
                    </Card>
                </Box>
            </Grid.Col>

        </Grid>
    )
}