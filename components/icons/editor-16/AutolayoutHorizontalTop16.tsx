import * as React from "react";

export interface AutolayoutHorizontalTop16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AutolayoutHorizontalTop16 = React.forwardRef<SVGSVGElement, AutolayoutHorizontalTop16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4 4H6V12H4V4ZM3 4C3 3.44771 3.44771 3 4 3H6C6.55229 3 7 3.44771 7 4V12C7 12.5523 6.55229 13 6 13H4C3.44771 13 3 12.5523 3 12V4ZM10 4H12V8H10V4ZM9 4C9 3.44771 9.44771 3 10 3H12C12.5523 3 13 3.44771 13 4V8C13 8.55229 12.5523 9 12 9H10C9.44771 9 9 8.55229 9 8V4Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

AutolayoutHorizontalTop16.displayName = "AutolayoutHorizontalTop16";
