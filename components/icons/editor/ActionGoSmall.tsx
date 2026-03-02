import * as React from "react";

export interface ActionGoSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ActionGoSmall = React.forwardRef<SVGSVGElement, ActionGoSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M13.1463 7.14645C13.3416 6.95119 13.6582 6.95118 13.8534 7.14644L17.8535 11.1464C17.9473 11.2402 18 11.3674 18 11.5C18 11.6326 17.9473 11.7598 17.8535 11.8536L13.8534 15.8536C13.6582 16.0488 13.3416 16.0488 13.1463 15.8535C12.9511 15.6583 12.9511 15.3417 13.1463 15.1464L16.2929 12H6.5C6.22386 12 6 11.7761 6 11.5C6 11.2239 6.22386 11 6.5 11H16.2929L13.1463 7.85356C12.9511 7.6583 12.9511 7.34172 13.1463 7.14645Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

ActionGoSmall.displayName = "ActionGoSmall";
