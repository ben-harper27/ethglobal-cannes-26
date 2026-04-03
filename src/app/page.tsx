"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { EyeOff, FileText, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24">
      <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <EyeOff className="h-8 w-8 text-primary-foreground" />
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight">
            Private invoicing for freelancers
          </h1>
          <p className="text-lg text-muted-foreground">
            Get paid on-chain without exposing your income, clients, or
            earnings. Powered by zero-knowledge privacy.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/create"
            className={cn(buttonVariants({ size: "lg" }), "gap-2")}
          >
            <FileText className="h-4 w-4" />
            Create Invoice
          </Link>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "gap-2"
            )}
          >
            <Shield className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        <div className="mt-8 grid gap-6 text-left sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">Create an invoice</h3>
            <p className="text-sm text-muted-foreground">
              Set your ENS name and amount. Share the payment link with your
              client.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">Client pays privately</h3>
            <p className="text-sm text-muted-foreground">
              Payment goes through a ZK privacy pool. No on-chain link between
              payer and payee.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">Withdraw anywhere</h3>
            <p className="text-sm text-muted-foreground">
              Withdraw to any wallet. Optionally auto-swap to your preferred
              token.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
