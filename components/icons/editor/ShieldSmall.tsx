import * as React from "react";

export interface ShieldSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ShieldSmall = React.forwardRef<SVGSVGElement, ShieldSmallProps>(
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
      <path d="M11.5862 6.18809L7.0862 8.23355C6.7292 8.39582 6.5 8.75177 6.5 9.14391V10.2509C6.5 13.1785 8.0991 15.8722 10.6692 17.2741L11.5211 17.7388C11.8196 17.9016 12.1804 17.9016 12.4789 17.7388L13.3308 17.2741C15.9009 15.8722 17.5 13.1785 17.5 10.2509V9.14391C17.5 8.75177 17.2708 8.39582 16.9138 8.23355L12.4138 6.18809C12.1509 6.06858 11.8491 6.06858 11.5862 6.18809Z" stroke="currentColor" strokeOpacity={0.9}/>
    </svg>
  )
);

ShieldSmall.displayName = "ShieldSmall";
