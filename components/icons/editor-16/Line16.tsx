import * as React from "react";

export interface Line16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Line16 = React.forwardRef<SVGSVGElement, Line16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.8536 3.14645C13.0488 3.34171 13.0488 3.65829 12.8536 3.85355L3.85355 12.8536C3.65829 13.0488 3.34171 13.0488 3.14645 12.8536C2.95118 12.6583 2.95118 12.3417 3.14645 12.1464L12.1464 3.14645C12.3417 2.95118 12.6583 2.95118 12.8536 3.14645Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Line16.displayName = "Line16";
