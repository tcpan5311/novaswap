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
        const { action, tokenId, token } = await req.json()

        if (action === "sign") 
        {
            if (!tokenId) 
            {
                return NextResponse.json({ error: "Missing tokenId for signing" }, { status: 400 })
            }

            const signedToken = jwt.sign({ tokenId }, secret!, { expiresIn: "1h" })
            return NextResponse.json({ token: signedToken })
        }

        if (action === "verify") 
        {
            if (!token) 
            {
                return NextResponse.json({ error: "Missing token for verification" }, { status: 400 })
            }

            const decoded = jwt.verify(token, secret!) as { tokenId: string }
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
