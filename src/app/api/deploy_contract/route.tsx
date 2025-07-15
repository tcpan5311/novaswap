import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { ethers } from 'ethers'
import ERC20Mintable from '../../../../contracts/ERC20Mintable.json'
import UniswapV3Factory from '../../../../contracts/UniswapV3Factory.json'
import UniswapV3Manager from '../../../../contracts/UniswapV3Manager.json'
import UniswapV3NFTManager from '../../../../contracts/UniswapV3NFTManager.json'
import UniswapV3Pool from '../../../../contracts/UniswapV3Pool.json'
import UniswapV3Quoter from '../../../../contracts/UniswapV3Quoter.json'

export async function POST() {

  interface DeploymentAddresses  
  {
    EthereumAddress?: string
    USDCAddress?: string
    UniswapAddress?: string
    UniswapV3FactoryAddress?: string
    UniswapV3ManagerAddress?: string
    UniswapV3NFTManagerAddress?: string
    UniswapV3QuoterAddress?: string
  }

  try {
    const provider = new ethers.JsonRpcProvider("http://localhost:8545")

    //Setup
    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    const wallet = new ethers.Wallet(privateKey, provider)
    const erc20MintableDeployer = new ethers.ContractFactory(ERC20Mintable.abi, ERC20Mintable.bytecode.object, wallet)
    const uniswapV3FactoryDeployer = new ethers.ContractFactory(UniswapV3Factory.abi, UniswapV3Factory.bytecode.object, wallet)
    const UniswapV3ManagerDeployer = new ethers.ContractFactory(UniswapV3Manager.abi, UniswapV3Manager.bytecode.object, wallet)
    const UniswapV3NFTManagerDeployer = new ethers.ContractFactory(UniswapV3NFTManager.abi, UniswapV3NFTManager.bytecode.object, wallet)
    const UniswapV3QuoterDeployer = new ethers.ContractFactory(UniswapV3Quoter.abi, UniswapV3Quoter.bytecode.object, wallet)

    //Ethereum contract deploying and minting
    const ethereumContract = await erc20MintableDeployer.deploy('Ether', 'ETH', 18)
    await ethereumContract.waitForDeployment()
    const ethereumContractAddress = await ethereumContract.getAddress()
    const ethereumCallContract = new ethers.Contract(ethereumContractAddress, ERC20Mintable.abi, wallet)
    const ethereumMintAmount = ethers.parseUnits("1000000", 18)
    const ethereumMintTx = await ethereumCallContract.mint(wallet.address, ethereumMintAmount)
    await ethereumMintTx.wait()

    //USDC contract deploying and minting
    const usdcContract = await erc20MintableDeployer.deploy('USDC', 'USDC', 18)
    await usdcContract.waitForDeployment()
    const usdcContractAddress = await usdcContract.getAddress()
    const usdcCallContract = new ethers.Contract(usdcContractAddress, ERC20Mintable.abi, wallet)
    const usdcMintAmount = ethers.parseUnits("1000000", 18)
    const usdcMintTx = await usdcCallContract.mint(wallet.address, usdcMintAmount)
    await usdcMintTx.wait()

    //Uniswap contract deploying and minting
    const uniswapContract = await erc20MintableDeployer.deploy('Uniswap', 'UNI', 18)
    await uniswapContract.waitForDeployment()
    const uniswapContractAddress = await uniswapContract.getAddress()
    const uniswapCallContract = new ethers.Contract(uniswapContractAddress, ERC20Mintable.abi, wallet)
    const uniswapMintAmount = ethers.parseUnits("1000000", 18)
    const uniswapMintTx = await uniswapCallContract.mint(wallet.address, uniswapMintAmount)
    await uniswapMintTx.wait()

    //Factory contract deploying and minting
    const uniswapV3FactoryContract = await uniswapV3FactoryDeployer.deploy()
    await uniswapV3FactoryContract.waitForDeployment()
    const uniswapV3FactoryContractAddress = await uniswapV3FactoryContract.getAddress()

    const uniswapManagerContract = await UniswapV3ManagerDeployer.deploy(uniswapV3FactoryContractAddress)
    await uniswapManagerContract.waitForDeployment()
    const uniswapManagerContractAddress = await uniswapManagerContract.getAddress()

    const uniswapNFTManagerContract = await UniswapV3NFTManagerDeployer.deploy(uniswapV3FactoryContractAddress)
    await uniswapNFTManagerContract.waitForDeployment()
    const uniswapNFTManagerContractAddress = await uniswapNFTManagerContract.getAddress()

    const uniswapV3QuoterContract = await UniswapV3QuoterDeployer.deploy(uniswapV3FactoryContractAddress)
    await uniswapV3QuoterContract.waitForDeployment()
    const uniswapV3QuoterContractAddress = await uniswapV3QuoterContract.getAddress()

    const filePath = path.join(process.cwd(), 'deployment-address.json')

    let data: DeploymentAddresses = {}

    if (fs.existsSync(filePath)) 
    {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      try 
      {
        data = JSON.parse(fileContent) as DeploymentAddresses
      } 
      catch 
      {
        data = {}
      }
    }

    data.EthereumAddress = ethereumContractAddress
    data.USDCAddress = usdcContractAddress
    data.UniswapAddress = uniswapContractAddress
    data.UniswapV3FactoryAddress = uniswapV3FactoryContractAddress
    data.UniswapV3ManagerAddress = uniswapManagerContractAddress
    data.UniswapV3NFTManagerAddress = uniswapNFTManagerContractAddress
    data.UniswapV3QuoterAddress = uniswapV3QuoterContractAddress
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')

    return NextResponse.json({success: true})

  } 
  catch (err: any) 
  {
    console.error('Deployment error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
