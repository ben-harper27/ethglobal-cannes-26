"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import {
  EyeOff,
  FileText,
  Shield,
  ArrowRight,
  Lock,
  Send,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const steps = [
  {
    icon: FileText,
    title: "Invoice",
    description: "Create a payment request",
  },
  {
    icon: Send,
    title: "Pay",
    description: "Client pays with any token",
  },
  {
    icon: Lock,
    title: "Privacy Pool",
    description: "ZK proof breaks the link",
  },
  {
    icon: Wallet,
    title: "Withdraw",
    description: "Receive to any wallet",
  },
]

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center px-4">
      <section className="flex max-w-3xl flex-col items-center gap-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary">
            <EyeOff className="h-10 w-10 text-primary-foreground" />
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Private invoicing
            <br />
            <span className="text-muted-foreground">for freelancers</span>
          </h1>

          <p className="max-w-md text-lg text-muted-foreground">
            Get paid on-chain without exposing your income, clients, or
            earnings. Zero-knowledge privacy by default.
          </p>

          <div className="flex gap-3 pt-2">
            <Link
              href="/create"
              className={cn(buttonVariants({ size: "lg" }), "gap-2 px-6")}
            >
              Create Invoice
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "gap-2 px-6"
              )}
            >
              <Shield className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="w-full max-w-3xl pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl border border-border bg-card p-8"
        >
          <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
            How it works
          </h2>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            {steps.map((step, i) => (
              <div key={step.title} className="contents">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/40 sm:block" />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6 grid gap-4 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Lock className="h-4 w-4" />
            </div>
            <h3 className="mb-1 font-semibold">No wallet addresses stored</h3>
            <p className="text-sm text-muted-foreground">
              Your privacy account is derived from your wallet. The server never
              sees or stores your address.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Send className="h-4 w-4" />
            </div>
            <h3 className="mb-1 font-semibold">Pay with any token</h3>
            <p className="text-sm text-muted-foreground">
              Clients can pay with USDC, WETH, or ETH. Cross-token swaps happen
              automatically via Uniswap.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <EyeOff className="h-4 w-4" />
            </div>
            <h3 className="mb-1 font-semibold">Unlinkable on-chain</h3>
            <p className="text-sm text-muted-foreground">
              Powered by Unlink&apos;s ZK privacy pool. No on-chain link between
              payer and payee. Ever.
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
