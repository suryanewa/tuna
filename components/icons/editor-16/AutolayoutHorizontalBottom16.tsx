import * as React from "react";

export interface AutolayoutHorizontalBottom16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AutolayoutHorizontalBottom16 = React.forwardRef<SVGSVGElement, AutolayoutHorizontalBottom16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4 4H6V12H4V4ZM3 4C3 3.44771 3.44771 3 4 3H6C6.55229 3 7 3.44771 7 4V12C7 12.5523 6.55229 13 6 13H4C3.44771 13 3 12.5523 3 12V4ZM10 8H12V12H10V8ZM9 8C9 7.44771 9.44771 7 10 7H12C12.5523 7 13 7.44771 13 8V12C13 12.5523 12.5523 13 12 13H10C9.44771 13 9 12.5523 9 12V8Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

AutolayoutHorizontalBottom16.displayName = "AutolayoutHorizontalBottom16";
