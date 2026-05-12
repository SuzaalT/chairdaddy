import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface DownloadFile {
  url: string
  label: string
}

export interface ChairRecordProps {
  sku?: string
  loggedBy?: string
  loggedAt?: string
  brand?: string
  model?: string
  source?: string
  dateAcquired?: string
  storageUnit?: string
  condition?: string
  status?: string
  defects?: string
  workDone?: string
  purchasePrice?: number
  helperCost?: number
  refurbCost?: number
  transportCost?: number
  landedCost?: number
  listPrice?: number | null
  estProfit?: number | null
  tripStart?: string
  tripEnd?: string
  tripKm?: number | null
  tripEstimatedKm?: number | null
  tripVariancePct?: number | null
  tripFlagged?: boolean
  notes?: string
  downloads?: DownloadFile[]
}

const cad = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <tr>
    <td style={tdLabel}>{label}</td>
    <td style={tdValue}>{value ?? '—'}</td>
  </tr>
)

const ChairRecordEmail = ({
  sku = 'CF-XXXX', loggedBy = 'Team', loggedAt = '',
  brand = '', model = '', source = '', dateAcquired = '',
  storageUnit = '', condition = '', status = '',
  defects, workDone,
  purchasePrice = 0, helperCost = 0, refurbCost = 0, transportCost = 0, landedCost = 0,
  listPrice, estProfit,
  tripStart, tripEnd, tripKm, tripEstimatedKm, tripVariancePct, tripFlagged,
  notes,
  downloads = [],
}: ChairRecordProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Chair record {sku} — {brand}{model ? ` ${model}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>CHAIR RECORD — {sku}</Heading>
        <Text style={subtitle}>
          Logged by {loggedBy} on {loggedAt} · Ontario, Canada
        </Text>

        <Section style={section}>
          <Heading as="h2" style={h2}>Chair Details</Heading>
          <table style={table}><tbody>
            <Row label="SKU" value={sku} />
            <Row label="Brand/Model" value={`${brand}${model ? ` ${model}` : ''}`} />
            <Row label="Source" value={source} />
            <Row label="Date Acquired" value={dateAcquired} />
            <Row label="Storage Unit" value={storageUnit} />
            <Row label="Condition" value={condition} />
            <Row label="Status" value={status} />
          </tbody></table>
        </Section>

        {(defects || workDone) && (
          <Section style={section}>
            <Heading as="h2" style={h2}>Defects & Work</Heading>
            {defects && <Text style={text}><strong>Defects:</strong> {defects}</Text>}
            {workDone && <Text style={text}><strong>Work done:</strong> {workDone}</Text>}
          </Section>
        )}

        <Section style={section}>
          <Heading as="h2" style={h2}>Cost Breakdown</Heading>
          <table style={table}><tbody>
            <Row label="Purchase price" value={cad(purchasePrice)} />
            <Row label="Helper cost" value={cad(helperCost)} />
            <Row label="Refurb cost" value={cad(refurbCost)} />
            <Row label="Transport cost" value={cad(transportCost)} />
            <Row label="Landed cost" value={<strong>{cad(landedCost)}</strong>} />
            <Row label="List price" value={cad(listPrice ?? null)} />
            <Row label="Est. profit" value={cad(estProfit ?? null)} />
          </tbody></table>
        </Section>

        {(tripStart || tripEnd || tripKm) && (
          <Section style={section}>
            <Heading as="h2" style={h2}>Pickup Trip</Heading>
            <table style={table}><tbody>
              <Row label="From" value={tripStart} />
              <Row label="To" value={tripEnd} />
              <Row label="Distance (km)" value={tripKm} />
              <Row label="Estimated (km)" value={tripEstimatedKm} />
              <Row
                label="Variance"
                value={
                  tripVariancePct != null
                    ? <span style={tripFlagged ? flag : undefined}>
                        {tripVariancePct.toFixed(1)}%{tripFlagged ? ' ⚠ FLAGGED' : ''}
                      </span>
                    : '—'
                }
              />
            </tbody></table>
          </Section>
        )}

        {downloads.length > 0 && (
          <Section style={section}>
            <Heading as="h2" style={h2}>Proof Files</Heading>
            <Text style={text}>Click to download (links expire in 7 days):</Text>
            {downloads.map((d, i) => (
              <Button key={i} href={d.url} style={button}>
                ⬇ {d.label}
              </Button>
            ))}
          </Section>
        )}

        {notes && (
          <Section style={section}>
            <Heading as="h2" style={h2}>Notes</Heading>
            <Text style={text}>{notes}</Text>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          chairdaddy · automated record · <Link href="https://marketplaceflip.com" style={link}>marketplaceflip.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ChairRecordEmail,
  subject: (data: Record<string, any>) =>
    `Chair Record — ${data.sku ?? ''}${data.brand ? ` · ${data.brand}` : ''}${data.model ? ` ${data.model}` : ''}`.trim(),
  displayName: 'Chair record',
  previewData: {
    sku: 'CF-1234', loggedBy: 'Suzaal', loggedAt: '2026-05-12 14:32',
    brand: 'Herman Miller', model: 'Aeron', source: 'Facebook Marketplace',
    dateAcquired: '2026-05-12', storageUnit: 'Unit 1', condition: 'Good', status: 'in_stock',
    purchasePrice: 200, helperCost: 30, refurbCost: 25, transportCost: 18, landedCost: 273,
    listPrice: 650, estProfit: 377,
    tripStart: 'Toronto', tripEnd: 'Mississauga', tripKm: 42, tripEstimatedKm: 38,
    tripVariancePct: 10.5, tripFlagged: false,
    downloads: [{ url: '#', label: 'proof-of-purchase-CF-1234.jpg' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#111111' }
const container = { padding: '24px', maxWidth: '640px', margin: '0 auto' }
const h1 = { fontSize: '20px', fontWeight: 700 as const, color: '#111111', margin: '0 0 4px', letterSpacing: '0.5px' }
const subtitle = { fontSize: '12px', color: '#6b7280', margin: '0 0 24px' }
const section = { margin: '0 0 24px' }
const h2 = { fontSize: '14px', fontWeight: 700 as const, color: '#111111', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const table = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' }
const tdLabel = { padding: '6px 8px', color: '#6b7280', width: '40%', verticalAlign: 'top' as const, borderBottom: '1px solid #f3f4f6' }
const tdValue = { padding: '6px 8px', color: '#111111', borderBottom: '1px solid #f3f4f6' }
const text = { fontSize: '13px', color: '#374151', lineHeight: '1.5', margin: '0 0 8px' }
const button = { display: 'block', backgroundColor: '#3b6ef8', color: '#ffffff', padding: '10px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 as const, textDecoration: 'none', margin: '8px 0', textAlign: 'center' as const }
const flag = { color: '#dc2626', fontWeight: 600 as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af', textAlign: 'center' as const, margin: 0 }
const link = { color: '#3b6ef8', textDecoration: 'none' }
