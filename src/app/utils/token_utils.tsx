interface VerifyTokenResponse 
{
  tokenId?: string;
  error?: string;
}

export async function generateSignedToken(tokenId: string | number, token0Amount0: string, token1Amount1: string): Promise<string | null> 
{
    try 
    {
        const res = await fetch("/api/sign_tokens", 
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sign", tokenId: tokenId.toString(), token0Amount0, token1Amount1 }),
        })

        const data: { token?: string } = await res.json()

        if (data.token) 
        {
            return data.token
        } 
        else 
        {
            console.warn("Failed to generate token")
            return null
        }
    } 
    catch (err) 
    {
        console.error("Error generating signed token:", err)
        return null
    }
}

export async function fetchVerifyToken(tokenParam: string): Promise<VerifyTokenResponse> 
{
    const res = await fetch("/api/sign_tokens", 
    {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token: tokenParam }),
    })

        if (!res.ok) 
        {
            let errorData
            
            try 
            {
                errorData = await res.json() 
            } 
            catch 
            {
                errorData = { error: res.statusText }
            }
            throw new Error(errorData?.error || "Failed to verify token")
        }

    const data: VerifyTokenResponse = await res.json()
    return data
}


