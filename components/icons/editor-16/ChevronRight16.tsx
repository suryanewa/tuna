import * as React from "react";

export interface ChevronRight16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ChevronRight16 = React.forwardRef<SVGSVGElement, ChevronRight16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6.76754 5.52511C6.9628 5.32985 7.27938 5.32985 7.47465 5.52511L9.59596 7.64643L9.94952 7.99999L9.59596 8.35354L7.47465 10.4749C7.27938 10.6701 6.9628 10.6701 6.76754 10.4749C6.57228 10.2796 6.57228 9.96302 6.76754 9.76775L8.53531 7.99999L6.76754 6.23222C6.57228 6.03695 6.57228 5.72037 6.76754 5.52511Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

ChevronRight16.displayName = "ChevronRight16";
