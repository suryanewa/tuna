import * as React from "react";

export interface AutolayoutVerticalCenter16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AutolayoutVerticalCenter16 = React.forwardRef<SVGSVGElement, AutolayoutVerticalCenter16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4 4L4 6L12 6L12 4L4 4ZM4 3C3.44772 3 3 3.44772 3 4L3 6C3 6.55228 3.44772 7 4 7L12 7C12.5523 7 13 6.55229 13 6L13 4C13 3.44772 12.5523 3 12 3L4 3ZM6 10L6 12L10 12L10 10L6 10ZM6 9C5.44772 9 5 9.44772 5 10L5 12C5 12.5523 5.44771 13 6 13L10 13C10.5523 13 11 12.5523 11 12L11 10C11 9.44772 10.5523 9 10 9L6 9Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

AutolayoutVerticalCenter16.displayName = "AutolayoutVerticalCenter16";
