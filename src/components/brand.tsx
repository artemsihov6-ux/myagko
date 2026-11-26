export function BrandMark() {
  return <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" width="31" height="31">
    <rect width="32" height="32" rx="10" fill="var(--action)"/>
    <path d="M8 16.5a2 2 0 0 1 4 0v1.1m8 0v-1.1a2 2 0 1 1 4 0v3a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3v-3Zm3-2.4v-1.6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1.6M11.5 24v-1.5m9 1.5v-1.5" stroke="var(--action-text)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
export function Brand({ name }: { name: string }) {
  return <a className="brand" href="/" aria-label={name + ' — главная'}><BrandMark/><span>{name}</span></a>;
}
