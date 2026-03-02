import * as React from "react";

export interface BorderSmallSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const BorderSmallSmall = React.forwardRef<SVGSVGElement, BorderSmallSmallProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M5 11.5C5 11.2239 5.22386 11 5.5 11H18.5C18.7761 11 19 11.2239 19 11.5C19 11.7761 18.7761 12 18.5 12H5.5C5.22386 12 5 11.7761 5 11.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

BorderSmallSmall.displayName = "BorderSmallSmall";
