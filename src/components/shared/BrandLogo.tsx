export function BrandLogo({
  className = "size-9",
  alt = "Vision Mentor X logo",
}: {
  className?: string;
  alt?: string;
}) {
  return <img src="/logo.png?v=2" alt={alt} className={`shrink-0 object-contain ${className}`} />;
}
