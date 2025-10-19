import { parseEther } from "ethers"

export interface CryptocurrencyDetail 
{
    Label: string
    Address: string
}

export type TokenSetter = React.Dispatch<React.SetStateAction<CryptocurrencyDetail | null>>

const isValidAddress = (address?: string) => !!address && typeof address === "string" && address.trim() !== ""
const isValidNumber = (number?: any) => number !== null && !isNaN(Number(number))
const isPositiveNumber = (number?: any) => isValidNumber(number) && Number(number) > 0
const error = (msg: string = "incomplete_fields") => ({ isValid: false, errorMessage: msg })

export const validateFirstStep = (token0Address: string, token1Address: string, fee: number): boolean => 
{
    const isSame = token0Address && token1Address && token0Address === token1Address
    return isValidAddress(token0Address) && isValidAddress(token1Address) && isValidNumber(fee) && !isSame
}

export const validateFullFirstStep = async (
    token0Address: string,
    token1Address: string,
    fee: number,
    initialPrice: number,
    doesPoolExist: (token0Address: string, token1Address: string, fee: number) => Promise<boolean>
): Promise<{ isValid: boolean; poolExists: boolean }> => 
{
    if (!validateFirstStep(token0Address, token1Address, fee)) return { isValid: false, poolExists: false }
    const poolExists = await doesPoolExist(token0Address, token1Address, fee)
    return { isValid: poolExists || initialPrice > 0, poolExists }
}

export const validateSecondStep = async (
    signer: any,
    token0Address: string,
    token1Address: string,
    fee: number,
    minPrice: number,
    maxPrice: number,
    token0Amount: string,
    token1Amount: string,
    currentPrice: number,
    computeTokenAmount: Function,
    uniswapV3FactoryContract: any,
    getPoolContract: (address: string) => any,
    erc20Contract: (address: string, signerOrProvider: any) => any
): Promise<{ isValid: boolean, errorMessage?: string }> => 
{
    if (!validateFirstStep(token0Address, token1Address, fee)) return error()
    if (!isPositiveNumber(minPrice) || !isPositiveNumber(maxPrice) || maxPrice < minPrice || currentPrice <= 0) return error()

    const threshold = 1e-12
    const isAmountValid = (v: string) => !!v && !isNaN(Number(v)) && Number(v) > 0

    try 
    {
        const checkAmounts = async (isAToB: boolean) => 
        {
            const result = await computeTokenAmount(
                isAToB,
                "0.0001",
                currentPrice,
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
            const amountA = parseFloat(result?.amountA ?? "0")
            const amountB = parseFloat(result?.amountB ?? "0")
            if (amountA >= threshold && amountB < threshold && !isAmountValid(token0Amount)) return false
            if (amountB >= threshold && amountA < threshold && !isAmountValid(token1Amount)) return false
            if (amountA >= threshold && amountB >= threshold && !isAmountValid(token0Amount) && !isAmountValid(token1Amount)) return false
            return true
        }

        if (!await checkAmounts(true) || !await checkAmounts(false)) return error()

        if (!signer) return error()

        const userAddress = await signer.getAddress()
        if (!userAddress) return error()

        const token0Contract = erc20Contract(token0Address, signer)
        const token1Contract = erc20Contract(token1Address, signer)
        const [balance0, balance1] = await Promise.all([token0Contract.balanceOf(userAddress), token1Contract.balanceOf(userAddress)])

        const required0 = parseEther(token0Amount || "0")
        const required1 = parseEther(token1Amount || "0")

        if (balance0 < required0 || balance1 < required1) return error("insufficient_tokens")

        return { isValid: true }
    } 
    catch (err) 
    {
        console.log(err)
        return error()
    }
}

export const validateAmounts = (token0Amount: string, token1Amount: string): boolean => 
{
    const isValid = (value: string) => isPositiveNumber(value)
    return isValid(token0Amount) && isValid(token1Amount)
}

export const validatePercent = (percent: string): boolean => 
{
    if (!isPositiveNumber(percent)) return false
    const num = parseFloat(percent)
    return num >= 1 && num <= 100
}

export const validateSwapStep = async (
    signer: any,
    token0Address: string,
    token1Address: string,
    token0Amount: string,
    token1Amount: string,
    erc20Contract: (address: string, signerOrProvider: any) => any
): Promise<{ isValid: boolean; error?: "incomplete_fields" | "insufficient_tokens" }> => 
{
    if (!token0Address || !token1Address) return { isValid: false, error: "incomplete_fields" }
    if (!isPositiveNumber(token0Amount) || !signer) return { isValid: false, error: "incomplete_fields" }

    try 
    {
        const userAddress = await signer.getAddress()
        if (!userAddress) return { isValid: false, error: "incomplete_fields" }

        const token0Contract = erc20Contract(token0Address, signer)
        const balance0 = await token0Contract.balanceOf(userAddress)
        const required0 = parseEther(token0Amount || "0")

        if (balance0 < required0) return { isValid: false, error: "insufficient_tokens" }

        return { isValid: true }
    } 
    catch (err) 
    {
        console.error(err)
        return { isValid: false, error: "incomplete_fields" }
    }
}
