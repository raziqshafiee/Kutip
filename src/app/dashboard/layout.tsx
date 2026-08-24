import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/clients', label: 'Clients' },
  { href: '/dashboard/billing-rules', label: 'Billing Rules' },
  { href: '/dashboard/settings', label: 'Settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Kutip
        </Link>
        <nav className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {link.label}
            </Link>
          ))}
          <UserButton />
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}
