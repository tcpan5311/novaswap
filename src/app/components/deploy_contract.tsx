"use client"
import { Button } from '@mantine/core'
import { ethers } from 'ethers'
import ERC20Mintable from '../../../contracts/ERC20Mintable.json'

export default function DeployContract()  
{

    const deployContract = async() => 
    {
        const res = await fetch('/api/deploy_contract', { method: 'POST' })
        const data = await res.json()

        if (data.success) 
        {
            alert("Action successful")
        } 
        else 
        {
            alert('Deployment failed: ' + data.error)
        }

    }

    // const revealContract = async() => 
    // {
    //     const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    //     const provider = new ethers.JsonRpcProvider('http://localhost:8545')
    //     const contract = new ethers.Contract(address, ERC20Mintable.abi, provider)

    //     const name = await contract.name()
    //     const symbol = await contract.symbol()
        
    //     console.log(name)
    //     console.log(symbol)
    // }

    return (
    <>
        <div className="flex items-center justify-center h-screen">
            <Button size="md" variant="filled" onClick={deployContract}>Deploy Contract</Button>
        </div>
    </>
    )
}