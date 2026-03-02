import * as React from "react";

export interface NavigateBackProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const NavigateBack = React.forwardRef<SVGSVGElement, NavigateBackProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M13.8536 7.14645C14.0488 7.34171 14.0488 7.65829 13.8536 7.85355L9.70711 12L13.8536 16.1464C14.0488 16.3417 14.0488 16.6583 13.8536 16.8536C13.6583 17.0488 13.3417 17.0488 13.1464 16.8536L8.64645 12.3535C8.55268 12.2598 8.5 12.1326 8.5 12C8.5 11.8674 8.55268 11.7402 8.64645 11.6464L13.1464 7.14645C13.3417 6.95118 13.6583 6.95118 13.8536 7.14645Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

NavigateBack.displayName = "NavigateBack";
