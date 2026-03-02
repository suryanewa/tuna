import * as React from "react";

export interface AutolayoutHorizontalCenter16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AutolayoutHorizontalCenter16 = React.forwardRef<SVGSVGElement, AutolayoutHorizontalCenter16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4 4H6V12H4V4ZM3 4C3 3.44771 3.44771 3 4 3H6C6.55229 3 7 3.44771 7 4V12C7 12.5523 6.55229 13 6 13H4C3.44771 13 3 12.5523 3 12V4ZM10 6H12V10H10V6ZM9 6C9 5.44771 9.44771 5 10 5H12C12.5523 5 13 5.44771 13 6V10C13 10.5523 12.5523 11 12 11H10C9.44771 11 9 10.5523 9 10V6Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

AutolayoutHorizontalCenter16.displayName = "AutolayoutHorizontalCenter16";
