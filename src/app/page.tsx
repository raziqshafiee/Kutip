import Link from 'next/link'
import { FadeInSection } from './fade-in-section'
import { WhatsAppMockup } from './whatsapp-mockup'

const AUDIENCES = [
  {
    name: 'Tuition Centers',
    blurb: 'Monthly fees, per-subject or per-student, billed automatically every cycle.',
  },
  {
    name: 'Personal Trainers',
    blurb: 'Package renewals delivered on schedule, no more chasing session fees.',
  },
  {
    name: 'Daycares & Childcare',
    blurb: 'Recurring care fees invoiced and reminded without a spreadsheet in sight.',
  },
  {
    name: 'Long-term Rentals',
    blurb: 'Monthly rent reminders and receipts, sent straight to your tenant’s WhatsApp.',
  },
]

const STEPS = [
  {
    title: 'Generate',
    body: 'Every billing cycle, Kutip automatically creates the invoice — no manual entry, no forgotten clients.',
  },
  {
    title: 'Deliver',
    body: 'It lands directly in your client’s WhatsApp chat with a one-tap payment link.',
  },
  {
    title: 'Collect',
    body: 'FPX, cards, and e-wallets via ToyyibPay. The moment they pay, it’s reconciled automatically.',
  },
  {
    title: 'Remind',
    body: 'If they forget, Kutip follows up on schedule — before, on, and after the due date — so you never have to nag.',
  },
]

export default function Home() {
  return (
    <main className="flex-1 bg-cream text-ink">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-7 sm:px-10">
        <span className="font-[family-name:var(--font-instrument-serif)] text-2xl italic">
          Kutip
        </span>
        <nav className="flex items-center gap-8">
          <Link href="/sign-in" className="text-sm text-ink-muted transition hover:text-ink">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-kgreen px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="grid gap-16 px-6 py-8 sm:px-10 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-12">
        <div className="max-w-xl">
          <span className="inline-flex items-center rounded-full bg-badge px-3.5 py-1.5 text-sm font-semibold text-[oklch(38%_0.08_130)]">
            For tuition centers, trainers &amp; daycares
          </span>

          <h1 className="mt-6 font-[family-name:var(--font-instrument-serif)] text-5xl italic leading-[1.05] sm:text-6xl lg:text-[68px]">
            Never chase a payment again.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted sm:text-xl">
            You focus on your clients. Kutip sends the bill, follows up, and gets you paid
            &mdash; right where they already are, on WhatsApp.
          </p>

          <div className="mt-9">
            <Link
              href="/sign-up"
              className="inline-block rounded-full bg-kgreen px-8 py-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Start free, no card needed
            </Link>
          </div>

          <div className="mt-12 flex items-center gap-7">
            <div>
              <p className="font-[family-name:var(--font-instrument-serif)] text-2xl italic">
                FPX &amp; e-wallet
              </p>
              <p className="text-sm text-ink-muted">via ToyyibPay</p>
            </div>
            <div className="h-8 w-px bg-warm-line" />
            <div>
              <p className="font-[family-name:var(--font-instrument-serif)] text-2xl italic">
                Auto-reminders
              </p>
              <p className="text-sm text-ink-muted">so you never have to nag</p>
            </div>
          </div>
        </div>

        <WhatsAppMockup />
      </section>

      {/* Trust strip */}
      <section className="mt-16 border-t border-warm-line px-6 py-7 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3">
          <span className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
            Built for Malaysian micro-businesses
          </span>
          {AUDIENCES.map((a) => (
            <span key={a.name} className="text-sm text-ink-muted">
              {a.name}
            </span>
          ))}
        </div>
      </section>

      {/* Value prop */}
      <section className="px-6 py-28 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold tracking-widest text-kgreen uppercase">Why Kutip</p>
          <h2 className="mt-4 text-2xl leading-snug font-medium sm:text-3xl">
            Stop spending your evenings on spreadsheets and copy-pasted WhatsApp reminders.
          </h2>
          <p className="mt-6 text-lg text-ink-muted">
            Kutip generates your recurring invoices automatically, delivers them straight into
            your client&rsquo;s WhatsApp chat, and reconciles payment the moment it lands — so
            you get paid on time, every time, without lifting a finger.
          </p>
        </div>
      </section>

      {/* Built for */}
      <section className="border-t border-warm-line px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold tracking-widest text-kgreen uppercase">Built for</p>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {AUDIENCES.map((a) => (
              <div key={a.name} className="rounded-2xl border border-warm-line bg-white p-6">
                <h3 className="text-lg font-semibold">{a.name}</h3>
                <p className="mt-2 text-ink-muted">{a.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-warm-line px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold tracking-widest text-kgreen uppercase">
            How it works
          </p>
          <div className="mt-8 divide-y divide-warm-line">
            {STEPS.map((s, i) => (
              <FadeInSection key={s.title} className="flex gap-6 py-8 sm:gap-10">
                <span className="font-[family-name:var(--font-instrument-serif)] text-2xl text-kgreen italic">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-ink-muted">{s.body}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Footer / CTA */}
      <section className="flex flex-col items-center justify-center gap-6 bg-kgreen-dark px-6 py-28 text-center text-white sm:px-10">
        <Link href="/sign-up">
          <h2 className="font-[family-name:var(--font-instrument-serif)] text-4xl italic transition hover:opacity-80 sm:text-6xl">
            Start collecting
          </h2>
        </Link>
        <p className="text-white/70">Free to start. No credit card required.</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="rounded-full bg-kgreen px-8 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Get Started
          </Link>
          <Link href="/sign-in" className="text-sm text-white/70 underline underline-offset-4">
            Already have an account? Sign in
          </Link>
        </div>
        <p className="mt-12 text-xs text-white/40">
          Kutip &mdash; bills that collect themselves, on WhatsApp.
        </p>
      </section>
    </main>
  )
}
