import * as React from "react";

export interface AiSparkle16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AiSparkle16 = React.forwardRef<SVGSVGElement, AiSparkle16Props>(
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
        d="M3 8C5.77778 7.16667 7.16667 5.77778 8 3C8.83333 5.77778 10.2222 7.16667 13 8C10.2222 8.83333 8.83333 10.2222 8 13C7.16667 10.2222 5.77778 8.83333 3 8Z"
        stroke="currentColor"
        strokeOpacity={0.9}
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </svg>
  )
);

AiSparkle16.displayName = "AiSparkle16";
