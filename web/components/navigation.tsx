"use client"

import { Home, ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"

interface BreadcrumbItem {
  label: string
  href: string
}

const pathToBreadcrumbs: Record<string, BreadcrumbItem[]> = {
  "/": [{ label: "Home", href: "/" }],
  "/users": [
    { label: "Home", href: "/" },
    { label: "Manage Users", href: "/users" }
  ],
  "/alert-channels": [
    { label: "Home", href: "/" },
    { label: "Alert Channels", href: "/alert-channels" }
  ],
  "/reminders": [
    { label: "Home", href: "/" },
    { label: "View Reminders", href: "/reminders" }
  ],
  "/new": [
    { label: "Home", href: "/" },
    { label: "Create Reminder", href: "/new" }
  ]
}

export default function Navigation() {
  const pathname = usePathname()
  const breadcrumbs = pathToBreadcrumbs[pathname] || [{ label: "Home", href: "/" }]
  const isHomePage = pathname === "/"

  if (isHomePage) {
    return null // Don't show navigation on home page
  }

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 text-sm">
            {breadcrumbs.map((item, index) => (
              <div key={item.href} className="flex items-center">
                {index > 0 && <ChevronRight className="h-4 w-4 text-slate-400 mx-2" />}
                {index === 0 ? (
                  <Link 
                    href={item.href}
                    className="flex items-center text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <Home className="h-4 w-4 mr-1" />
                    {item.label}
                  </Link>
                ) : index === breadcrumbs.length - 1 ? (
                  <span className="text-slate-900 font-medium">{item.label}</span>
                ) : (
                  <Link 
                    href={item.href}
                    className="text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-3">
            <Link 
              href="/"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              href="/new"
              className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              New Reminder
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}