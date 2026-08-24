export function WhatsAppMockup() {
  return (
    <div className="mx-auto w-[300px] rounded-[2.5rem] bg-[oklch(20%_0.02_60)] p-3 shadow-2xl sm:w-[340px]">
      <div className="flex h-[560px] flex-col overflow-hidden rounded-[1.75rem] bg-[oklch(94%_0.02_100)] sm:h-[600px]">
        <div className="flex items-center gap-3 bg-kgreen px-4 pt-4 pb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[oklch(98%_0.01_145)] text-sm font-bold text-[oklch(45%_0.08_145)]">
            A
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Ali Tuition Center</p>
            <p className="text-xs text-white/80">online</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-end gap-2.5 p-4">
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white p-3.5 shadow-sm">
            <p className="mb-1.5 text-xs text-ink-muted">Your invoice is ready</p>
            <p className="text-xl font-bold text-ink">RM 150.00</p>
            <p className="my-1 text-xs text-ink-muted">Due 1 March &middot; March tuition</p>
            <div className="mt-2.5 rounded-lg bg-kgreen py-2.5 text-center text-sm font-semibold text-white">
              Pay now
            </div>
          </div>
          <div className="self-end rounded-2xl rounded-br-sm bg-[oklch(88%_0.05_130)] px-3.5 py-2.5 text-sm text-ink">
            Paid! Thank you 🙏
          </div>
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 text-sm text-ink shadow-sm">
            Payment received &mdash; here&rsquo;s your receipt.
          </div>
        </div>
      </div>
    </div>
  )
}
