import Link from "next/link"
import { EyeOff } from "lucide-react"

export function Navbar() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <EyeOff className="h-5 w-5" />
          Cloak
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/create"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Create Invoice
          </Link>
          <Link
            href="/dashboard"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/withdraw"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Withdraw
          </Link>
        </nav>
      </div>
    </header>
  )
}
