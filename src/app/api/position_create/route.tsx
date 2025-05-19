import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() 
{
  const filePath = path.join(process.cwd(), 'deployment-address.json')

  try 
  {
    if (!fs.existsSync(filePath)) 
    {
      return NextResponse.json({ success: false, error: 'Deployment file not found' }, { status: 404 })
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(fileContent)

    return NextResponse.json({ success: true, data })
  } 
  catch (err: any) 
  {
    console.error('Read error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}