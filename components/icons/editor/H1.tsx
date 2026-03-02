import * as React from "react";

export interface H1Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const H1 = React.forwardRef<SVGSVGElement, H1Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7 6.5C7 6.22386 6.77614 6 6.5 6C6.22386 6 6 6.22386 6 6.5V11.5V17.5C6 17.7761 6.22386 18 6.5 18C6.77614 18 7 17.7761 7 17.5V12H13V17.5C13 17.7761 13.2239 18 13.5 18C13.7761 18 14 17.7761 14 17.5V11.5V6.5C14 6.22386 13.7761 6 13.5 6C13.2239 6 13 6.22386 13 6.5V11H7V6.5ZM18 12.5C18 12.3156 17.8985 12.1462 17.7359 12.0592C17.5733 11.9722 17.3761 11.9817 17.2226 12.084L15.7226 13.084C15.4929 13.2372 15.4308 13.5476 15.584 13.7773C15.7372 14.0071 16.0476 14.0692 16.2774 13.916L17 13.4343V17.5C17 17.7761 17.2239 18 17.5 18C17.7761 18 18 17.7761 18 17.5V12.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

H1.displayName = "H1";
