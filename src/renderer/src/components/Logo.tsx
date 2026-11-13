interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 22, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
      role="presentation"
    >
      <rect x="1.5" y="1.5" width="29" height="29" rx="4" fill="var(--accent)" />
      <path
        d="M9.4 8.6 16 17.2v7.2"
        stroke="#fff"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22.6 8.6 16 17.2"
        stroke="#fff"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />
    </svg>
  )
}
