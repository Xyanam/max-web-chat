import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const first = dialogRef.current?.querySelector<HTMLElement>('input, textarea, button:not(.modal-close)')
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key !== 'Tab' || !dialogRef.current) return
      // Keep keyboard focus inside the dialog.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]',
      )
      if (!focusable.length) return
      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef}>
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Закрыть">
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
