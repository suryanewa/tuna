import * as React from "react";

export interface Close16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Close16 = React.forwardRef<SVGSVGElement, Close16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4.14645 4.14645C4.34171 3.95118 4.65829 3.95118 4.85355 4.14645L8 7.29289L11.1464 4.14645C11.3417 3.95118 11.6583 3.95118 11.8536 4.14645C12.0488 4.34171 12.0488 4.65829 11.8536 4.85355L8.70711 8L11.8536 11.1464C12.0488 11.3417 12.0488 11.6583 11.8536 11.8536C11.6583 12.0488 11.3417 12.0488 11.1464 11.8536L8 8.70711L4.85355 11.8536C4.65829 12.0488 4.34171 12.0488 4.14645 11.8536C3.95118 11.6583 3.95118 11.3417 4.14645 11.1464L7.29289 8L4.14645 4.85355C3.95118 4.65829 3.95118 4.34171 4.14645 4.14645Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Close16.displayName = "Close16";
