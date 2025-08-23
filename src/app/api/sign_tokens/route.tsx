import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

const secret = process.env.JWT_SECRET

if (!secret) 
{
    throw new Error("JWT_SECRET is not set in environment variables")
}

export async function POST(req: NextRequest) {

    try 
    {
        const { action, tokenId, token, token0Amount0, token1Amount1 } = await req.json()

        if (action === "sign") 
        {
            if (!tokenId) 
            {
                return NextResponse.json({ error: "Missing tokenId for signing" }, { status: 400 })
            }

            const payload = 
            {
                tokenId,
                token0Amount0: token0Amount0 ?? "0",
                token1Amount1: token1Amount1 ?? "0",
            }

            const signedToken = jwt.sign(payload, secret!)
            return NextResponse.json({ token: signedToken })
        }

        if (action === "verify") 
        {
            if (!token) 
            {
                return NextResponse.json({ error: "Missing token for verification" }, { status: 400 })
            }

            const decoded = jwt.verify(token, secret!) as { tokenId: string, token0Amount0: string, token1Amount1: string }

            const amount0 = Number(decoded.token0Amount0)
            const amount1 = Number(decoded.token1Amount1)

            if (amount0 === 0 && amount1 === 0) 
            {
                return NextResponse.json({ message: "Invalid or expired token" }, { status: 200 })
            }

            return NextResponse.json({ tokenId: decoded.tokenId })
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    } 
    catch (err) 
    {
        console.error("Token handler error:", err)
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }
}
