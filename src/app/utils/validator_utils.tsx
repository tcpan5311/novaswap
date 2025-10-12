import { parseEther } from "ethers"

export interface CryptocurrencyDetail 
{
    Label: string
    Address: string
}

export type TokenSetter = React.Dispatch<React.SetStateAction<CryptocurrencyDetail | null>>

export const validateFirstStep = (token0Address: string, token1Address: string, fee: number): boolean => 
{
    const isTokenValid = (address: string): boolean => address !== null && typeof address === 'string' && address.trim() !== ''
    const isFeeValid = (fee: number): boolean => fee !== null && !isNaN(fee) && fee >= 0
    const isSameToken = token0Address && token1Address && token0Address === token1Address
    return isTokenValid(token0Address) && isTokenValid(token1Address) && isFeeValid(fee) && !isSameToken
}

export const validateFullFirstStep = async (token0Address: string, token1Address: string, fee: number, initialPrice: number, doesPoolExist: (token0Address: string, token1Address: string, fee: number) => Promise<boolean>): Promise<{ isValid: boolean; poolExists: boolean }> => 
{
    if (!validateFirstStep(token0Address, token1Address, fee)) return { isValid: false, poolExists: false }

    const poolExists = await doesPoolExist(token0Address, token1Address, fee)
    const isValid = poolExists || initialPrice > 0

    return { isValid, poolExists }
}

export const validateSecondStep = async (
    provider: any,
    signer: any,
    token0Address: string,
    token1Address: string,
    fee: number,
    minPrice: number,
    maxPrice: number,
    token0Amount: string,
    token1Amount: string,
    currentPrice: number,
    computeTokenAmount: (
        isAToB: boolean,
        overrideAmount: string,
        currentPrice: number,
        provider: any,
        signer: any,
        token0Address: string,
        token1Address: string,
        fee: number,
        token0Amount: string,
        token1Amount: string,
        minPrice: number,
        maxPrice: number,
        uniswapV3FactoryContract: any,
        getPoolContract: (address: string) => any
    ) => Promise<{ amountA: string; amountB: string }>,
    uniswapV3FactoryContract: any,
    getPoolContract: (address: string) => any,
    erc20Contract: (address: string, signerOrProvider: any) => any
): Promise<{ isValid: boolean, errorMessage?: string }> => 
{
    if (!validateFirstStep(token0Address, token1Address, fee)) 
    {
        return { isValid: false, errorMessage: "incomplete_fields" }
    }

    const isPriceValid = (min: number, max: number): boolean => !isNaN(min) && !isNaN(max) && min > 0 && max >= min
    const isAmountValid = (amount: string): boolean => amount !== null && amount.trim() !== '' && !isNaN(Number(amount)) && Number(amount) > 0

    if (!isPriceValid(minPrice, maxPrice)) 
    {
        return { isValid: false, errorMessage: "incomplete_fields" }
    }

    if (!token0Address || !token1Address || fee === null || currentPrice === null || currentPrice <= 0) 
    {
        return { isValid: false, errorMessage: "incomplete_fields" }
    }

    const threshold = 1e-12
    
    try 
    {
        const resultAtoB = await computeTokenAmount
        (
            true,
            "0.0001",
            currentPrice,
            provider,
            signer,
            token0Address,
            token1Address,
            fee,
            "",
            "",
            minPrice,
            maxPrice,
            uniswapV3FactoryContract,
            getPoolContract
        )

        const amountA = parseFloat(resultAtoB?.amountA ?? "0")
        const amountB = parseFloat(resultAtoB?.amountB ?? "0")

        if (amountA >= threshold && amountB < threshold) 
        {
            if (!isAmountValid(token0Amount))
            {
                return { isValid: false, errorMessage: "incomplete_fields" }
            }
        }

        if (amountB >= threshold && amountA < threshold) 
        {
            if (!isAmountValid(token0Amount))
            {
                return { isValid: false, errorMessage: "incomplete_fields" }
            }
        }

        if (amountA >= threshold && amountB >= threshold) 
        {
            if (!isAmountValid(token0Amount) && !isAmountValid(token1Amount))
            {
                return { isValid: false, errorMessage: "incomplete_fields" }
            }
        }

        const resultBtoA = await computeTokenAmount
        (
            false,
            "0.0001",
            currentPrice,
            provider,
            signer,
            token0Address,
            token1Address,
            fee,
            "",
            "",
            minPrice,
            maxPrice,
            uniswapV3FactoryContract,
            getPoolContract
        )

        const reverseA = parseFloat(resultBtoA?.amountA ?? "0")
        const reverseB = parseFloat(resultBtoA?.amountB ?? "0")

        if (reverseA >= threshold && reverseB < threshold) 
        {
            if (!isAmountValid(token1Amount))
            {
                return { isValid: false, errorMessage: "incomplete_fields" }
            }
        }

        if (reverseB >= threshold && reverseA < threshold) 
        {
            if (!isAmountValid(token1Amount))
            {
                return { isValid: false, errorMessage: "incomplete_fields" }
            }
        }

        if (reverseA >= threshold && reverseB >= threshold) 
        {
            if (!isAmountValid(token0Amount) && !isAmountValid(token1Amount))
            {
                return { isValid: false, errorMessage: "incomplete_fields" }
            }
        }

        // --- validate sufficient tokens (added logic) ---
        if (!signer || !provider)
        {
            return { isValid: false, errorMessage: "incomplete_fields" }
        }

        const userAddress = await signer.getAddress()
        if (!userAddress)
        {
            return { isValid: false, errorMessage: "incomplete_fields" }
        }

        const token0Contract = erc20Contract(token0Address, signer)
        const token1Contract = erc20Contract(token1Address, signer)
        
        const [balance0, balance1] = await Promise.all
        ([
            token0Contract.balanceOf(userAddress),
            token1Contract.balanceOf(userAddress)
        ])

        const required0 = parseEther(token0Amount || "0")
        const required1 = parseEther(token1Amount || "0")

        const hasSufficientToken0 = balance0 >= required0
        const hasSufficientToken1 = balance1 >= required1

        if (!hasSufficientToken0 || !hasSufficientToken1)
        {
            return { isValid: false, errorMessage: "insufficient_tokens" }
        }

        return { isValid: true }
    } 
    catch (error) 
    {
        console.log(error)
        return { isValid: false, errorMessage: "incomplete_fields" }
    }
}

export const validateAmounts = (token0Amount: string, token1Amount: string): boolean => 
{
    const isAmountValid = (amount: string): boolean => 
    {
        if (amount === null || typeof amount !== 'string') return false
        const num = parseFloat(amount)
        return !isNaN(num) && num > 0
    }

    return isAmountValid(token0Amount) && isAmountValid(token1Amount)
}

export const validatePercent = (percent: string): boolean => 
{
    if (percent === null || typeof percent !== 'string') return false
    const num = parseFloat(percent)
    return !isNaN(num) && num >= 1 && num <= 100
}

export const validateSwapStep = async (provider: any, signer: any, token0Address: string, token1Address: string, token0Amount: string, token1Amount: string, erc20Contract: (address: string, signerOrProvider: any) => any): Promise<{ isValid: boolean; error?: "incomplete_fields" | "insufficient_tokens" }> => 
{
    if (!token0Address || !token1Address) 
    { 
        return { isValid: false, error: "incomplete_fields" }
    }

    const isAmountValid = (amount: string) => amount !== null && amount.trim() !== "" && !isNaN(Number(amount)) && Number(amount) > 0

    if (!isAmountValid(token0Amount)) 
    {
        return { isValid: false, error: "incomplete_fields" }
    }

    if (!signer || !provider) return { isValid: false, error: "incomplete_fields" }

    try 
    {
        const userAddress = await signer.getAddress()
        if (!userAddress) return { isValid: false, error: "incomplete_fields" }

        const token0Contract = erc20Contract(token0Address, signer)
        const balance0 = await token0Contract.balanceOf(userAddress)

        const required0 = parseEther(token0Amount || "0")

        if (balance0 < required0) 
        {
            return { isValid: false, error: "insufficient_tokens" }
        }

        return { isValid: true }
    } 
    catch (err) 
    {
        console.error(err)
        return { isValid: false, error: "incomplete_fields" }
    }
}










