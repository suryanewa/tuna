import * as React from "react";

export interface MinusProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Minus = React.forwardRef<SVGSVGElement, MinusProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6 12C6 11.7239 6.22386 11.5 6.5 11.5H17.5C17.7761 11.5 18 11.7239 18 12C18 12.2761 17.7761 12.5 17.5 12.5H6.5C6.22386 12.5 6 12.2761 6 12Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Minus.displayName = "Minus";
