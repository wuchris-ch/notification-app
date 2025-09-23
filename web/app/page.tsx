export default function Home() {
  return (
    <main className="p-8 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Family Reminders</h1>
      <p>Quick links:</p>
      <ul className="list-disc list-inside space-y-1">
        <li><a className="underline" href="/users">Manage users</a></li>
        <li><a className="underline" href="/alert-channels">Manage alert channels</a></li>
        <li><a className="underline" href="/new">Create a reminder</a></li>
        <li><a className="underline" href="/reminders">View & manage reminders</a></li>
      </ul>
      <p className="text-sm opacity-70">API base: {process.env.NEXT_PUBLIC_API_BASE}</p>
    </main>
  )
}
