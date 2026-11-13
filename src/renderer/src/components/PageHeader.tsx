import type { ReactNode } from 'react'

interface PageHeaderProps {
  step: number
  total: number
  title: string
  summary: string
  actions: string[]
  status?: ReactNode
}

export function PageHeader({ step, total, title, summary, actions, status }: PageHeaderProps) {
  return (
    <header className="page-head">
      <div className="page-head__top">
        <div className="page-head__route">
          <span className="page-head__index">
            第 {step} 步<span className="page-head__index-total">，共 {total} 步</span>
          </span>
          <span className="page-head__track" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i < step ? 'is-on' : undefined} />
            ))}
          </span>
        </div>
        {status && <div className="page-head__status">{status}</div>}
      </div>
      <h1 className="page-head__title">{title}</h1>
      <p className="page-head__summary">{summary}</p>

      <ol className="page-head__steps">
        {actions.map((action, index) => (
          <li className="page-head__step" key={action}>
            <span className="page-head__step-num">{index + 1}</span>
            <span className="page-head__step-text">{action}</span>
          </li>
        ))}
      </ol>
    </header>
  )
}