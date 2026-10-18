// DocChat mark: a page with a folded corner whose lower edge becomes a speech tail.
export default function BrandMark({ size = 28, className = '', detail = '#f5f6f4' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7 4.5h12.5L25 10v13.5a2 2 0 0 1-2 2H14l-5 4v-4H7a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2Z"
        fill="currentColor"
      />
      <path d="M19.5 4.5V10H25" stroke={detail} strokeOpacity=".55" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 14h11M9.5 18h7" stroke={detail} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
