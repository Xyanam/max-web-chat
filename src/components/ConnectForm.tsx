import { useState, type FormEvent } from 'react'
import type { Credentials } from '../types'
import { normalizeApiUrl, suggestApiUrl, validateApiUrl } from '../api/config'
import { EyeIcon, EyeOffIcon } from './Icons'

interface ConnectFormProps {
  initial?: Credentials | null
  initialRemember?: boolean
  submitLabel: string
  /** Resolves on success; rejects with an Error whose message is shown to the user. */
  onSubmit: (credentials: Credentials, remember: boolean) => Promise<void>
}

type FieldErrors = Partial<Record<keyof Credentials, string>>

export function ConnectForm({ initial, initialRemember = false, submitLabel, onSubmit }: ConnectFormProps) {
  const [idInstance, setIdInstance] = useState(initial?.idInstance ?? '')
  const [apiTokenInstance, setApiTokenInstance] = useState(initial?.apiTokenInstance ?? '')
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? '')
  const [apiUrlTouched, setApiUrlTouched] = useState(Boolean(initial?.apiUrl))
  const [remember, setRemember] = useState(initialRemember)
  const [showToken, setShowToken] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const effectiveApiUrl = apiUrlTouched ? apiUrl : suggestApiUrl(idInstance)

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    const id = idInstance.trim()
    if (!id) next.idInstance = 'Укажите idInstance.'
    else if (!/^\d+$/.test(id)) next.idInstance = 'idInstance должен состоять только из цифр.'
    if (!apiTokenInstance.trim()) next.apiTokenInstance = 'Укажите apiTokenInstance.'
    const urlError = validateApiUrl(effectiveApiUrl)
    if (urlError) next.apiUrl = urlError
    return next
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const fieldErrors = validate()
    setErrors(fieldErrors)
    setSubmitError(null)
    if (Object.keys(fieldErrors).length) return

    setBusy(true)
    try {
      await onSubmit(
        {
          idInstance: idInstance.trim(),
          apiTokenInstance: apiTokenInstance.trim(),
          apiUrl: normalizeApiUrl(effectiveApiUrl),
        },
        remember,
      )
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Не удалось подключиться.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="connect-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="idInstance">idInstance</label>
        <input
          id="idInstance"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1101000001"
          value={idInstance}
          onChange={(e) => setIdInstance(e.target.value)}
          aria-invalid={Boolean(errors.idInstance)}
          aria-describedby={errors.idInstance ? 'idInstance-error' : undefined}
          disabled={busy}
        />
        {errors.idInstance && (
          <p className="field-error" id="idInstance-error">
            {errors.idInstance}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="apiTokenInstance">apiTokenInstance</label>
        <div className="input-with-button">
          <input
            id="apiTokenInstance"
            type={showToken ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder="Токен из консоли GREEN-API"
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            aria-invalid={Boolean(errors.apiTokenInstance)}
            aria-describedby={errors.apiTokenInstance ? 'apiTokenInstance-error' : undefined}
            disabled={busy}
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => setShowToken((v) => !v)}
            aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
            aria-pressed={showToken}
          >
            {showToken ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
          </button>
        </div>
        {errors.apiTokenInstance && (
          <p className="field-error" id="apiTokenInstance-error">
            {errors.apiTokenInstance}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="apiUrl">Адрес API (apiUrl)</label>
        <input
          id="apiUrl"
          type="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://xxxx.api.green-api.com/v3"
          value={effectiveApiUrl}
          onChange={(e) => {
            setApiUrlTouched(true)
            setApiUrl(e.target.value)
          }}
          aria-invalid={Boolean(errors.apiUrl)}
          aria-describedby="apiUrl-hint"
          disabled={busy}
        />
        {errors.apiUrl ? (
          <p className="field-error" id="apiUrl-hint">
            {errors.apiUrl}
          </p>
        ) : (
          <p className="field-hint" id="apiUrl-hint">
            Заполняется по idInstance. Если в консоли GREEN-API указан другой apiUrl, вставьте его.
          </p>
        )}
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} />
        <span>Запомнить на этом устройстве</span>
      </label>

      {submitError && (
        <div className="alert alert-error" role="alert">
          {submitError}
        </div>
      )}

      <button type="submit" className="button button-primary button-block" disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" /> Подключение…
          </>
        ) : (
          submitLabel
        )}
      </button>
    </form>
  )
}
