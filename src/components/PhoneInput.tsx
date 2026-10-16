import { useEffect, useRef, type ClipboardEvent } from 'react'
import { IMaskInput } from 'react-imask'
import { detectPhoneCountry, PHONE_COUNTRIES, type PhoneCountry } from '../lib/phone'

interface PhoneInputProps {
  id: string
  country: PhoneCountry
  /** Digits after the country code. */
  national: string
  onChange: (country: PhoneCountry, national: string) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}

/**
 * Masked phone input for Russia (+7) and Belarus (+375). IMask keeps the caret
 * in place when digits are inserted or removed in the middle. Pasting a full
 * number with a country code switches the country automatically.
 */
export function PhoneInput({ id, country, national, onChange, disabled, invalid, describedBy }: PhoneInputProps) {
  const info = PHONE_COUNTRIES[country]
  const inputRef = useRef<HTMLInputElement>(null)
  const prevCountryRef = useRef(country)

  // The masked input is remounted per country; keep focus (caret at the end) after a switch.
  useEffect(() => {
    if (prevCountryRef.current === country) return
    prevCountryRef.current = country
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [country])

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const detected = detectPhoneCountry(e.clipboardData.getData('text'))
    if (!detected) return // partial paste: let the mask insert the digits at the caret
    e.preventDefault()
    onChange(detected.country, detected.national.slice(0, PHONE_COUNTRIES[detected.country].nationalLength))
  }

  return (
    <div className="phone-input">
      <select
        className="phone-country"
        aria-label="Страна"
        value={country}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as PhoneCountry
          onChange(next, national.slice(0, PHONE_COUNTRIES[next].nationalLength))
        }}
      >
        {(Object.keys(PHONE_COUNTRIES) as PhoneCountry[]).map((code) => (
          <option key={code} value={code}>
            {PHONE_COUNTRIES[code].label} (+{PHONE_COUNTRIES[code].dialCode})
          </option>
        ))}
      </select>
      <IMaskInput
        // Remount when the country changes: switching the mask of a live instance
        // re-masks the previous digits and would echo a garbled value back.
        key={country}
        id={id}
        inputRef={inputRef}
        mask={info.mask}
        // The unmasked value contains the fixed country code followed by the national digits.
        unmask={true}
        value={national ? info.dialCode + national : ''}
        onAccept={(value: string) => {
          const next = value.startsWith(info.dialCode) ? value.slice(info.dialCode.length) : ''
          if (next !== national) onChange(country, next)
        }}
        onPaste={handlePaste}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder={info.placeholder}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
    </div>
  )
}
