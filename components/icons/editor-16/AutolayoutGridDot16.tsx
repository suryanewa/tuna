import * as React from "react";

export interface AutolayoutGridDot16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AutolayoutGridDot16 = React.forwardRef<SVGSVGElement, AutolayoutGridDot16Props>(
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
      <path
        d="M8 7C8.55228 7 9 7.44772 9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8C7 7.44772 7.44772 7 8 7Z"
        fill="currentColor" fillOpacity={0.3}
      />
    </svg>
  )
);

AutolayoutGridDot16.displayName = "AutolayoutGridDot16";
