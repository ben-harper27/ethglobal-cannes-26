import Link from "next/link"
import { EyeOff } from "lucide-react"
import { WalletButton } from "@/components/wallet-button"

export default function PayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <EyeOff className="h-5 w-5" />
            Cloak
          </Link>
          <WalletButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  )
}
