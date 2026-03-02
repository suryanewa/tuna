import * as React from "react";

export interface ArrowProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Arrow = React.forwardRef<SVGSVGElement, ArrowProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.5 4.5C12.5 4.22386 12.7239 4 13 4H19.5C19.7761 4 20 4.22386 20 4.5V11C20 11.2761 19.7761 11.5 19.5 11.5C19.2239 11.5 19 11.2761 19 11V5.70711L4.85355 19.8536C4.65829 20.0488 4.34171 20.0488 4.14645 19.8536C3.95118 19.6583 3.95118 19.3417 4.14645 19.1464L18.2929 5H13C12.7239 5 12.5 4.77614 12.5 4.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Arrow.displayName = "Arrow";
