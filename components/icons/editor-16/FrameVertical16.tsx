import * as React from "react";

export interface FrameVertical16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const FrameVertical16 = React.forwardRef<SVGSVGElement, FrameVertical16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3.00488 6.10254C3.05621 6.60667 3.48232 7 4 7L12 7L12.1025 6.99512C12.6067 6.94379 13 6.51768 13 6L13 4C13 3.48232 12.6067 3.05621 12.1025 3.00488L12 3L4 3C3.44772 3 3 3.44772 3 4L3 6L3.00488 6.10254ZM3.00488 12.1025C3.05621 12.6067 3.48232 13 4 13L12 13L12.1025 12.9951C12.573 12.9472 12.9472 12.573 12.9951 12.1025L13 12L13 10L12.9951 9.89746C12.9472 9.42703 12.573 9.05278 12.1025 9.00488L12 9L4 9C3.48232 9 3.05621 9.39333 3.00488 9.89746L3 10L3 12L3.00488 12.1025ZM12 4L12 6L4 6L4 4L12 4ZM12 10L12 12L4 12L4 10L12 10Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

FrameVertical16.displayName = "FrameVertical16";
