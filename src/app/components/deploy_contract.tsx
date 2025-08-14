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

    return (
    <>
        <div className="flex items-center justify-center h-screen">
            <Button size="md" variant="filled" onClick={deployContract}>Deploy Contract</Button>
        </div>
    </>
    )
}