import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import '@mantine/core/styles.css'
import '@mantine/charts/styles.css'
import {MantineProvider, createTheme, ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import Header from "./components/header"
import { ReduxProvider } from "./redux/redux_provider" 

const theme = createTheme
({
  colors: 
  {
    purple: 
    [
      '#f5e1ff', '#e0bfff', '#cb9dff', '#b77aff', '#a357ff',
      '#8f34ff', '#7c00f6', '#6600cc', '#4f0099', '#390066'
    ],
  },
  primaryColor: 'purple',
})

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Novaswap",
  description: "Created using Next.js",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider theme={theme}>
          <ReduxProvider>
              <Header/>
              {children}
          </ReduxProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
