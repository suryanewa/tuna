import * as React from "react";

export interface ShowAll16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ShowAll16 = React.forwardRef<SVGSVGElement, ShowAll16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8 11C8.55228 11 9 11.4477 9 12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11ZM8 7C8.55228 7 9 7.44772 9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8C7 7.44772 7.44772 7 8 7ZM9 4C9 3.44771 8.55228 3 8 3C7.44772 3 7 3.44771 7 4C7 4.55229 7.44772 5 8 5C8.55228 5 9 4.55229 9 4Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

ShowAll16.displayName = "ShowAll16";
