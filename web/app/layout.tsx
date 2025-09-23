import type { Metadata } from "next"
import type { ReactNode } from "react"
import Navigation from "@/components/navigation"
import "./globals.css"

export const metadata: Metadata = {
  title: "Family Reminders",
  description: "Simple family reminder scheduler with ntfy alerts",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  )
}
