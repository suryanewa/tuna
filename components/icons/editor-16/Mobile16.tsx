import * as React from "react";

export interface Mobile16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Mobile16 = React.forwardRef<SVGSVGElement, Mobile16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10 3H6C5.44772 3 5 3.44772 5 4V12C5 12.5523 5.44772 13 6 13H10C10.5523 13 11 12.5523 11 12V4C11 3.44772 10.5523 3 10 3ZM6 2C4.89543 2 4 2.89543 4 4V12C4 13.1046 4.89543 14 6 14H10C11.1046 14 12 13.1046 12 12V4C12 2.89543 11.1046 2 10 2H6ZM8.5 11.5C8.5 11.7761 8.27614 12 8 12C7.72386 12 7.5 11.7761 7.5 11.5C7.5 11.2239 7.72386 11 8 11C8.27614 11 8.5 11.2239 8.5 11.5ZM7.5 4C7.22386 4 7 4.22386 7 4.5C7 4.77614 7.22386 5 7.5 5H8.5C8.77614 5 9 4.77614 9 4.5C9 4.22386 8.77614 4 8.5 4H7.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Mobile16.displayName = "Mobile16";
