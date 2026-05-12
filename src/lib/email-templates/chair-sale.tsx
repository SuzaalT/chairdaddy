import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface DownloadFile {
  url: string
  label: string
}

export interface ChairSaleProps {
  sku?: string
  brand?: string
  model?: string
  soldBy?: string
  soldAt?: string
  dateSold?: string
  buyerName?: string
  buyerContact?: string
  paymentMethod?: string
  soldPrice?: number
  landedCost?: number
  profit?: number
  daysHeld?: number | null
  saleNotes?: string
  // Original purchase
  source?: string
  dateAcquired?: string
  purchasePrice?: number
  transportCost?: number
  refurbCost?: number
  helperCost?: number
  // Condition
  condition?: string
  defects?: string
  workDone?: string
  // Misc
  marketplaceUrl?: string
  downloads?: DownloadFile[]
}

const cad = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  etransfer: 'E-Transfer',
  credit: 'Credit Card',
  paypal: 'PayPal',
  cheque: 'Cheque',
  other: 'Other',
}

const Row = ({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <tr>
    <td style={tdLabel}>{label}</td>
    <td style={mono ? tdValueMono : tdValue}>{value ?? '—'}</td>
  </tr>
)

const ChairSaleEmail = ({
  sku = '', brand = '', model = '',
  soldBy = 'Team', soldAt = '', dateSold = '',
  buyerName, buyerContact, paymentMethod = 'other',
  soldPrice = 0, landedCost = 0, profit = 0, daysHeld,
  saleNotes,
  source = '', dateAcquired = '',
  purchasePrice = 0, transportCost = 0, refurbCost = 0, helperCost = 0,
  condition = '', defects, workDone,
  marketplaceUrl,
  downloads = [],
}: ChairSaleProps) => {
  const profitPerDay = daysHeld && daysHeld > 0 ? profit / daysHeld : null
  const roi = landedCost > 0 ? (profit / landedCost) * 100 : null
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>SALE CONFIRMED {sku} — {cad(profit)} profit</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>SALE CONFIRMED</Heading>
            <Text style={headerSub}>{brand}{model ? ` ${model}` : ''} · {sku}</Text>
            <Text style={headerMeta}>{dateSold} · Ontario, Canada</Text>
          </Section>

          <Section style={section}>
            <Heading as="h2" style={h2}>Sale Details</Heading>
            <table style={table}><tbody>
              <Row label="Sold Price" value={cad(soldPrice)} />
              <Row label="Payment Method" value={PAYMENT_LABELS[paymentMethod] ?? paymentMethod} mono={false} />
              <Row label="Buyer Name" value={buyerName || 'Not recorded'} mono={false} />
              <Row label="Buyer Contact" value={buyerContact || 'Not recorded'} mono={false} />
            </tbody></table>
          </Section>

          <Section style={section}>
            <Heading as="h2" style={h2}>Profit Summary</Heading>
            <table style={table}><tbody>
              <Row label="Sold Price" value={cad(soldPrice)} />
              <Row label="Total Landed Cost" value={cad(landedCost)} />
              <Row label="Net Profit" value={<strong style={profit >= 0 ? profitGood : profitBad}>{cad(profit)}</strong>} />
              <Row label="Days in Stock" value={daysHeld != null ? `${daysHeld} days` : '—'} />
              <Row label="Profit Per Day" value={profitPerDay != null ? cad(profitPerDay) : '—'} />
              <Row label="Return on Capital" value={roi != null ? `${roi.toFixed(1)}%` : '—'} />
            </tbody></table>
          </Section>

          <Section style={section}>
            <Heading as="h2" style={h2}>Original Purchase</Heading>
            <table style={table}><tbody>
              <Row label="Source" value={source || '—'} mono={false} />
              <Row label="Date Acquired" value={dateAcquired || '—'} />
              <Row label="Purchase Price" value={cad(purchasePrice)} />
              <Row label="Transport In" value={cad(transportCost)} />
              <Row label="Refurb / Parts" value={cad(refurbCost)} />
              <Row label="Helper Cost" value={cad(helperCost)} />
            </tbody></table>
          </Section>

          <Section style={section}>
            <Heading as="h2" style={h2}>Condition at Sale</Heading>
            <table style={table}><tbody>
              <Row label="Condition" value={condition || '—'} mono={false} />
              <Row label="Defects noted" value={defects || 'None'} mono={false} />
              <Row label="Work done" value={workDone || 'None'} mono={false} />
            </tbody></table>
          </Section>

          {saleNotes && (
            <Section style={section}>
              <Heading as="h2" style={h2}>Sale Notes</Heading>
              <Text style={text}>{saleNotes}</Text>
            </Section>
          )}

          {marketplaceUrl && (
            <Section style={section}>
              <Heading as="h2" style={h2}>Original Listing</Heading>
              <Link href={marketplaceUrl} style={link}>{marketplaceUrl}</Link>
            </Section>
          )}

          {downloads.length > 0 && (
            <Section style={section}>
              <Heading as="h2" style={h2}>Proof Files & Receipts</Heading>
              <Text style={text}>Click to download (links expire in 7 days):</Text>
              {downloads.map((d, i) => (
                <Button key={i} href={d.url} style={button}>⬇ {d.label}</Button>
              ))}
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footer}>
            Logged by {soldBy} on {soldAt}<br />
            ChairFlip Business Manager · Ontario, Canada · <Link href="https://marketplaceflip.com" style={link}>marketplaceflip.com</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ChairSaleEmail,
  subject: (data: Record<string, any>) =>
    `✅ Sale Confirmed: ${data.sku ?? ''} — ${data.brand ?? ''} · ${cad(data.profit)} profit`.trim(),
  displayName: 'Chair sale',
  previewData: {
    sku: 'CF-1234', brand: 'Herman Miller', model: 'Aeron',
    soldBy: 'Suzaal', soldAt: '2026-05-12 14:32', dateSold: '2026-05-12',
    buyerName: 'Alex P.', buyerContact: '416-555-1234', paymentMethod: 'etransfer',
    soldPrice: 650, landedCost: 273, profit: 377, daysHeld: 12,
    source: 'Facebook Marketplace', dateAcquired: '2026-04-30',
    purchasePrice: 200, transportCost: 18, refurbCost: 25, helperCost: 30,
    condition: 'Good', defects: 'Minor scuff on armrest', workDone: 'Cleaned, lubed gas lift',
    saleNotes: 'Buyer picked up, no issues.',
    downloads: [{ url: '#', label: 'proof-CF-1234.jpg' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#111111' }
const container = { padding: '24px', maxWidth: '640px', margin: '0 auto' }
const header = { backgroundColor: '#111111', color: '#ffffff', padding: '20px 24px', borderRadius: '8px', margin: '0 0 24px' }
const h1 = { fontSize: '20px', fontWeight: 700 as const, color: '#ffffff', margin: '0 0 6px', letterSpacing: '1px' }
const headerSub = { fontSize: '14px', color: '#e5e7eb', margin: '0 0 4px', fontWeight: 600 as const }
const headerMeta = { fontSize: '11px', color: '#9ca3af', margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const section = { margin: '0 0 24px' }
const h2 = { fontSize: '13px', fontWeight: 700 as const, color: '#111111', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.8px', borderBottom: '2px solid #111111', paddingBottom: '4px' }
const table = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' }
const tdLabel = { padding: '6px 8px', color: '#6b7280', width: '45%', verticalAlign: 'top' as const, borderBottom: '1px solid #f3f4f6' }
const tdValue = { padding: '6px 8px', color: '#111111', borderBottom: '1px solid #f3f4f6' }
const tdValueMono = { padding: '6px 8px', color: '#111111', borderBottom: '1px solid #f3f4f6', fontFamily: 'Menlo, Consolas, monospace', fontSize: '13px' }
const profitGood = { color: '#15803d' }
const profitBad = { color: '#dc2626' }
const text = { fontSize: '13px', color: '#374151', lineHeight: '1.5', margin: '0 0 8px' }
const button = { display: 'block', backgroundColor: '#3b6ef8', color: '#ffffff', padding: '10px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 as const, textDecoration: 'none', margin: '8px 0', textAlign: 'center' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af', textAlign: 'center' as const, margin: 0, lineHeight: '1.6' }
const link = { color: '#3b6ef8', textDecoration: 'none' }
