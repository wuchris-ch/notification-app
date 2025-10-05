import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Plus, Calendar, ArrowRight } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Family Reminders
            </h1>
            <p className="mx-auto max-w-[700px] text-lg text-muted-foreground">
              Keep your family organized with smart reminders and notifications. 
              Never miss important events, appointments, or tasks again.
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto mb-16">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Manage Channels</CardTitle>
                  <CardDescription>
                    Configure notification destinations
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Create and manage notification channels for individuals or groups.
                Each channel represents a destination for reminders.
              </p>
              <Button asChild className="w-full">
                <Link href="/channels">
                  Manage Channels
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Create Reminder</CardTitle>
                  <CardDescription>
                    Set up new reminders
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Create new reminders for appointments, tasks, or important events. 
                Set schedules and assign to family members.
              </p>
              <Button asChild className="w-full">
                <Link href="/dashboard">
                  Create New
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>View Reminders</CardTitle>
                  <CardDescription>
                    Browse and manage reminders
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Browse, edit, and manage all your existing reminders and schedules. 
                View upcoming events and completed tasks.
              </p>
              <Button asChild className="w-full">
                <Link href="/reminders">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
