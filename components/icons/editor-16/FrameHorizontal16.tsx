import * as React from "react";

export interface FrameHorizontal16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const FrameHorizontal16 = React.forwardRef<SVGSVGElement, FrameHorizontal16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6.10254 12.9951C6.60667 12.9438 7 12.5177 7 12L7 4L6.99512 3.89746C6.94379 3.39333 6.51768 3 6 3L4 3C3.48232 3 3.05621 3.39333 3.00488 3.89746L3 4L3 12C3 12.5523 3.44772 13 4 13L6 13L6.10254 12.9951ZM12.1025 12.9951C12.6067 12.9438 13 12.5177 13 12L13 4L12.9951 3.89746C12.9472 3.42703 12.573 3.05278 12.1025 3.00488L12 3L10 3L9.89746 3.00488C9.42703 3.05278 9.05278 3.42703 9.00488 3.89746L9 4L9 12C9 12.5177 9.39333 12.9438 9.89746 12.9951L10 13L12 13L12.1025 12.9951ZM4 4L6 4L6 12L4 12L4 4ZM10 4L12 4L12 12L10 12L10 4Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

FrameHorizontal16.displayName = "FrameHorizontal16";
