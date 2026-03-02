import * as React from "react";

export interface Mixed16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Mixed16 = React.forwardRef<SVGSVGElement, Mixed16Props>(
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
      <path d="M4 8C4 7.72386 4.22386 7.5 4.5 7.5H11.5C11.7761 7.5 12 7.72386 12 8C12 8.27614 11.7761 8.5 11.5 8.5H4.5C4.22386 8.5 4 8.27614 4 8Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Mixed16.displayName = "Mixed16";
