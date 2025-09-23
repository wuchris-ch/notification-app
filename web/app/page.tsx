import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Bell, Plus, Calendar, ArrowRight, CheckCircle } from "lucide-react"

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
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto mb-16">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Manage Users</CardTitle>
                  <CardDescription>
                    Add and organize family members
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Add, edit, and organize family members who will receive reminders. 
                Set up profiles and preferences for each family member.
              </p>
              <Button asChild className="w-full">
                <Link href="/users">
                  Manage Users
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Alert Channels</CardTitle>
                  <CardDescription>
                    Configure notification methods
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Set up notification channels like email, SMS, or push notifications. 
                Customize how and when your family receives alerts.
              </p>
              <Button asChild className="w-full">
                <Link href="/alert-channels">
                  Setup Alerts
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
                <Link href="/new">
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

        {/* Status Section */}
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">System Status</CardTitle>
              <CardDescription>
                Current system configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">
                  API Base: 
                </span>
                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                  {process.env.NEXT_PUBLIC_API_BASE || '/api'}
                </code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
