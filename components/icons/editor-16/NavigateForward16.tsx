import * as React from "react";

export interface NavigateForward16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const NavigateForward16 = React.forwardRef<SVGSVGElement, NavigateForward16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5.64645 12.3536C5.45118 12.1583 5.45118 11.8417 5.64645 11.6464L8.79289 8.5L5.64645 5.35355C5.45118 5.15829 5.45119 4.84171 5.64645 4.64645C5.84171 4.45118 6.15829 4.45118 6.35355 4.64645L9.85355 8.14645C10.0488 8.34171 10.0488 8.65829 9.85355 8.85355L6.35355 12.3536C6.15829 12.5488 5.84171 12.5488 5.64645 12.3536Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

NavigateForward16.displayName = "NavigateForward16";
