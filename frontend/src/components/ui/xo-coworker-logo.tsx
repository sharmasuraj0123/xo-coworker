interface XoCoworkerLogoProps {
  size?: number;
  className?: string;
}

export function XoCoworkerLogo({ size = 20, className }: XoCoworkerLogoProps) {
  return (
    <img
      src="/favicon.svg"
      width={size}
      height={size}
      alt="XO-Coworker"
      className={className}
    />
  );
}
