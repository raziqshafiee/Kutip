import { prisma } from '../prisma'

export type TemplateVars = {
  client_name: string
  amount: string
  service_name: string
  payment_link: string
}

/**
 * Replaces `{{key}}` placeholders in a template with values from `vars`.
 * Unmatched placeholders are left intact so missing values are visible
 * instead of silently dropped.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return vars[key] ?? match
  })
}

export function formatMYR(amount: number): string {
  return `RM ${amount.toFixed(2)}`
}

/**
 * Assembles the WhatsApp template variable set for a reminder tied to an
 * invoice. Loads the invoice, its client, and the owning business.
 *
 * The payment link is a placeholder until the Payments plan supplies real
 * checkout URLs.
 */
export async function buildReminderPayload(
  invoiceId: string,
  _stage: string
): Promise<{ text: string; vars: TemplateVars }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      client: {
        include: { business: true },
      },
    },
  })

  const vars: TemplateVars = {
    client_name: invoice.client.name,
    amount: formatMYR(invoice.amount.toNumber()),
    service_name: invoice.client.serviceTier ?? invoice.client.business.name,
    payment_link: '#placeholder-payment-link',
  }

  const text =
    `Dear {{client_name}}, your bill of {{amount}} ({{service_name}}) is due. ` +
    `Pay here: {{payment_link}}`

  return { text, vars }
}