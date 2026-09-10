'use client'

import { useCallback, useRef, useState, type FormEvent } from 'react'

/**
 * The contact form, posting to the existing `/api/contact` route.
 *
 * It also carries ORBI's opt-in attributes — `data-orbi-form`,
 * `data-orbi-field`, `data-orbi-submit`, `data-orbi-form-state` — and nothing
 * else. ORBI reads those attributes and the focus/validity state of the
 * controls; it never sees what anyone types. Values live only in this
 * component's refs and in the request body.
 */

type Status = 'idle' | 'submitting' | 'success' | 'error'

const FIELDS = [
  { name: 'name', label: 'Name', type: 'text', required: true, autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
  { name: 'company', label: 'Company Name', type: 'text', required: false, autoComplete: 'organization' },
  { name: 'phone', label: 'Contact Number', type: 'tel', required: false, autoComplete: 'tel' },
] as const

export default function ContactForm({ packageName }: { packageName?: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  /** Which controls have failed validation. Names only — never values. */
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const formRef = useRef<HTMLFormElement>(null)
  /**
   * `status` is a render behind, so rapid clicks can slip past a check against
   * it. This ref is updated synchronously and is what actually guarantees one
   * request per submission.
   */
  const inFlightRef = useRef(false)

  const validate = useCallback((form: HTMLFormElement) => {
    const next: Record<string, boolean> = {}
    for (const control of form.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >('[data-orbi-field]')) {
      next[control.name] = !control.checkValidity()
    }
    setInvalid(next)
    return Object.values(next).every((bad) => !bad)
  }, [])

  /** Drops a control's invalid flag once it validates again. Name only. */
  const clearInvalid = useCallback((name: string) => {
    setInvalid((prev) => (prev[name] ? { ...prev, [name]: false } : prev))
  }, [])

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      if (inFlightRef.current) return

      if (!validate(form)) {
        setStatus('error')
        setMessage('Please fill in the required fields.')
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
        return
      }

      inFlightRef.current = true
      setStatus('submitting')
      setMessage(null)

      const data = new FormData(form)
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.get('name'),
            email: data.get('email'),
            company: data.get('company'),
            phone: data.get('phone'),
            package: data.get('package'),
            message: data.get('message'),
          }),
        })
        if (!response.ok) throw new Error('Request failed')
        setStatus('success')
        setMessage("Thanks — we'll be in touch within 24 hours.")
        form.reset()
        setInvalid({})
      } catch {
        setStatus('error')
        setMessage('Could not send your message. Please try again.')
      } finally {
        inFlightRef.current = false
      }
    },
    [validate],
  )

  const submitting = status === 'submitting'

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      data-orbi-form=""
      data-orbi-form-state={status}
      data-orbi-label="contact-form"
      className="contact-form"
      style={{ display: 'grid', gap: '18px', textAlign: 'left' }}
    >
      {/* Which pricing tier the visitor clicked, when this form was opened
          from the ORBI page's package cards. Nothing renders it — it rides
          along in the FormData so the enquiry arrives tagged. */}
      {packageName && <input type="hidden" name="package" value={packageName} />}

      <div
        className="form-row"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}
      >
        {FIELDS.slice(0, 2).map((field) => (
          <Field
            key={field.name}
            field={field}
            invalid={!!invalid[field.name]}
            onRecover={clearInvalid}
          />
        ))}
      </div>

      <div
        className="form-row"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}
      >
        {FIELDS.slice(2, 4).map((field) => (
          <Field
            key={field.name}
            field={field}
            invalid={!!invalid[field.name]}
            onRecover={clearInvalid}
          />
        ))}
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>
          Message <span style={{ color: '#00B7FF' }}>*</span>
        </span>
        <textarea
          name="message"
          rows={5}
          required
          data-orbi-field="message"
          aria-invalid={invalid.message ? 'true' : undefined}
          aria-describedby={invalid.message ? 'contact-message-error' : undefined}
          onInput={(e) => {
            if (invalid.message && e.currentTarget.checkValidity()) {
              setInvalid((prev) => ({ ...prev, message: false }))
            }
          }}
          style={{ ...controlStyle, resize: 'vertical', minHeight: '120px' }}
        />
        {invalid.message && <FieldError id="contact-message-error" />}
      </label>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginTop: '4px',
          textAlign: 'center',
        }}
      >
        <button
          type="submit"
          disabled={submitting}
          data-orbi-submit=""
          data-orbi-avoid="high"
          data-orbi-label="contact-submit"
          className="btn-shimmer btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minWidth: '180px',
            padding: '15px 32px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 700,
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            cursor: submitting ? 'progress' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Sending…' : 'Send Message'}
        </button>

        {/* The form is the source of truth for what happened; ORBI only
            echoes the mood. Polite, so it never talks over a field label. */}
        <p
          role="status"
          aria-live="polite"
          data-orbi-avoid="high"
          data-orbi-label="contact-status"
          style={{
            margin: 0,
            minHeight: '20px',
            fontSize: '14px',
            textAlign: 'center',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            color: status === 'error' ? '#F87171' : status === 'success' ? '#34D399' : '#6E8399',
          }}
        >
          {message}
        </p>
      </div>
    </form>
  )
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function Field({
  field,
  invalid,
  onRecover,
}: {
  field: (typeof FIELDS)[number]
  invalid: boolean
  onRecover: (name: string) => void
}) {
  return (
    <label style={labelStyle}>
      <span style={labelTextStyle}>
        {field.label}
        {field.required && <span style={{ color: '#00B7FF' }}> *</span>}
      </span>
      <input
        name={field.name}
        type={field.type}
        required={field.required}
        autoComplete={field.autoComplete}
        data-orbi-field={field.name}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={invalid ? `contact-${field.name}-error` : undefined}
        onInput={(event) => {
          if (invalid && event.currentTarget.checkValidity()) onRecover(field.name)
        }}
        style={controlStyle}
      />
      {invalid && <FieldError id={`contact-${field.name}-error`} />}
    </label>
  )
}

/** Marked `avoid` so ORBI never parks on top of a validation message. */
function FieldError({ id }: { id: string }) {
  return (
    <span
      id={id}
      data-orbi-avoid="high"
      data-orbi-label="field-error"
      style={{
        fontSize: '12.5px',
        color: '#F87171',
        fontFamily: 'var(--font-poppins), system-ui, sans-serif',
      }}
    >
      This field is required.
    </span>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '7px',
}

const labelTextStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: '#6E8399',
  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
}

const controlStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 15px',
  borderRadius: '12px',
  // Darker than the card, in the page's own near-black, so each field reads
  // as a recessed well rather than a raised grey (or tinted navy) panel.
  background: '#0A0E14',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
  transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
  color: '#E9F1F8',
  // 16px, not 15: iOS Safari zooms the page on focus for anything smaller,
  // which is jarring inside the ORBI page's fixed modal.
  fontSize: '16px',
  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
  outline: 'none',
  colorScheme: 'dark',
}
