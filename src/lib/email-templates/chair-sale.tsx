import {
  Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface ChairSaleProps {
  sku?: string
  brand?: string
  model?: string
  soldBy?: string
  soldAt?: string
  dateSold?: string
  buyerName?: string
  paymentMethod?: string
  soldPrice?: number
  landedCost?: number
  profit?: number
  daysHeld?: number
  saleNotes?: string
}

const cad = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  etransfer: 'e-Transfer',
  credit: 'Credit / Debit',
  paypal: 'PayPal',
  other: 'Other',
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <tr>
    <td style={tdLabel}>{label}</td>
    <td style={tdValue}>{value ?? '—'}</td>
  </tr>
)

const ChairSaleEmail = ({
  sku = '', brand = '', model = '',
  soldBy = 'Team', soldAt = '', dateSold = '',
  buyerName, paymentMethod = 'other',
  soldPrice = 0, landedCost = 0, profit = 0, daysHeld,
  saleNotes,
}: ChairSaleProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>SOLD {sku} — {cad(soldPrice)} profit {cad(profit)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>PROOF OF SALE — {sku}</Heading>
        <Text style={subtitle}>
          Sold by {soldBy} on {soldAt} · Ontario, Canada
        </Text>

        <Section style={hero}>
          <Text style={heroLabel}>Sold for</Text>
          <Text style={heroAmount}>{cad(soldPrice)}</Text>
          <Text style={heroProfit}>Profit: <strong style={profit >= 0 ? profitGood : profitBad}>{cad(profit)}</strong></Text>
        </Section>

        <Section style={section}>
          <Heading as="h2" style={h2}>Sale Details</Heading>
          <table style={table}><tbody>
            <Row label="SKU" value={sku} />
            <Row label="Item" value={`${brand}${model ? ' ' + model : ''}`} />
            <Row label="Date sold" value={dateSold} />
            <Row label="Buyer" value={buyerName || '—'} />
            <Row label="Payment method" value={PAYMENT_LABELS[paymentMethod] ?? paymentMethod} />
            <Row label="Days held" value={daysHeld != null ? `${daysHeld} days` : '—'} />
          </tbody></table>
        </Section>

        <Section style={section}>
          <Heading as="h2" style={h2}>Profit Summary</Heading>
          <table style={table}><tbody>
            <Row label="Sold price" value={cad(soldPrice)} />
            <Row label="Landed cost" value={cad(landedCost)} />
            <Row label="Net profit" value={<strong style={profit >= 0 ? profitGood : profitBad}>{cad(profit)}</strong>} />
          </tbody></table>
        </Section>

        {saleNotes && (
          <Section style={section}>
            <Heading as="h2" style={h2}>Sale Notes</Heading>
            <Text style={text}>{saleNotes}</Text>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          chairdaddy · automated proof of sale · <Link href="https://marketplaceflip.com" style={link}>marketplaceflip.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ChairSaleEmail,
  subject: (data: Record<string, any>) =>
    `SOLD — ${data.sku ?? ''} · ${data.brand ?? ''}${data.model ? ' ' + data.model : ''} · ${cad(data.soldPrice)}`.trim(),
  displayName: 'Chair sale',
  previewData: {
    sku: 'CF-1234', brand: 'Herman Miller', model: 'Aeron',
    soldBy: 'Suzaal', soldAt: '2026-05-12 14:32', dateSold: '2026-05-12',
    buyerName: 'Alex P.', paymentMethod: 'etransfer',
    soldPrice: 650, landedCost: 273, profit: 377, daysHeld: 12,
    saleNotes: 'Picked up at storage unit, paid in full.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#111111' }
const container = { padding: '24px', maxWidth: '640px', margin: '0 auto' }
const h1 = { fontSize: '20px', fontWeight: 700 as const, color: '#111111', margin: '0 0 4px', letterSpacing: '0.5px' }
const subtitle = { fontSize: '12px', color: '#6b7280', margin: '0 0 24px' }
const hero = { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '20px', textAlign: 'center' as const, margin: '0 0 24px' }
const heroLabel = { fontSize: '11px', color: '#15803d', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 4px' }
const heroAmount = { fontSize: '32px', fontWeight: 700 as const, color: '#14532d', margin: '0 0 4px' }
const heroProfit = { fontSize: '13px', color: '#374151', margin: 0 }
const profitGood = { color: '#15803d' }
const profitBad = { color: '#dc2626' }
const section = { margin: '0 0 24px' }
const h2 = { fontSize: '14px', fontWeight: 700 as const, color: '#111111', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const table = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' }
const tdLabel = { padding: '6px 8px', color: '#6b7280', width: '40%', verticalAlign: 'top' as const, borderBottom: '1px solid #f3f4f6' }
const tdValue = { padding: '6px 8px', color: '#111111', borderBottom: '1px solid #f3f4f6' }
const text = { fontSize: '13px', color: '#374151', lineHeight: '1.5', margin: '0 0 8px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af', textAlign: 'center' as const, margin: 0 }
const link = { color: '#3b6ef8', textDecoration: 'none' }
