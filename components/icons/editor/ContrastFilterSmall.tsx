import * as React from "react";

export interface ContrastFilterSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ContrastFilterSmall = React.forwardRef<SVGSVGElement, ContrastFilterSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6ZM12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7V17Z" fill="currentColor"/>
    </svg>
  )
);

ContrastFilterSmall.displayName = "ContrastFilterSmall";
