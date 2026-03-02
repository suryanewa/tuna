import * as React from "react";

export interface Arrow16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Arrow16 = React.forwardRef<SVGSVGElement, Arrow16Props>(
  ({ size = 16, className, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M7 3.5C7 3.22386 7.22386 3 7.5 3H12.5C12.7761 3 13 3.22386 13 3.5V8.5C13 8.77614 12.7761 9 12.5 9C12.2239 9 12 8.77614 12 8.5V4.70711L3.85355 12.8536C3.65829 13.0488 3.34171 13.0488 3.14645 12.8536C2.95118 12.6583 2.95118 12.3417 3.14645 12.1464L11.2929 4H7.5C7.22386 4 7 3.77614 7 3.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Arrow16.displayName = "Arrow16";
