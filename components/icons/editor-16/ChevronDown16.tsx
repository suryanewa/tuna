import * as React from "react";

export interface ChevronDown16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ChevronDown16 = React.forwardRef<SVGSVGElement, ChevronDown16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.4751 7.47486C10.6704 7.2796 10.6704 6.96302 10.4751 6.76775C10.2798 6.57249 9.96326 6.57249 9.768 6.76775L8.00023 8.53552L6.23246 6.76775C6.0372 6.57249 5.72062 6.57249 5.52535 6.76775C5.33009 6.96302 5.33009 7.2796 5.52535 7.47486L7.64668 9.59618L8.00023 9.94973L8.35378 9.59618L10.4751 7.47486Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

ChevronDown16.displayName = "ChevronDown16";
