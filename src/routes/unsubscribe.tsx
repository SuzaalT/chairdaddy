import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/unsubscribe')({ component: UnsubscribePage })

function UnsubscribePage() {
  const [token, setToken] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error'>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    if (!t) { setState('invalid'); return }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState('valid')
        else if (d.reason === 'already_unsubscribed') setState('already')
        else setState('invalid')
      })
      .catch(() => setState('error'))
  }, [])

  async function confirm() {
    if (!token) return
    setBusy(true)
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const d = await r.json()
      if (d.success) setState('success')
      else if (d.reason === 'already_unsubscribed') setState('already')
      else setState('error')
    } catch { setState('error') } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-xl font-semibold mb-2">Email preferences</h1>
        {state === 'loading' && <p className="text-sm text-muted-foreground">Checking link…</p>}
        {state === 'valid' && (
          <>
            <p className="text-sm text-muted-foreground mb-6">Unsubscribe from chairdaddy emails?</p>
            <Button onClick={confirm} disabled={busy}>{busy ? 'Processing…' : 'Confirm unsubscribe'}</Button>
          </>
        )}
        {state === 'already' && <p className="text-sm text-muted-foreground">You're already unsubscribed.</p>}
        {state === 'success' && <p className="text-sm text-muted-foreground">You've been unsubscribed. ✓</p>}
        {state === 'invalid' && <p className="text-sm text-destructive">Invalid or expired link.</p>}
        {state === 'error' && <p className="text-sm text-destructive">Something went wrong. Try again later.</p>}
      </div>
    </div>
  )
}
