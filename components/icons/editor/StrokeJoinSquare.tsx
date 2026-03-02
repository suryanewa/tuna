import * as React from "react";

export interface StrokeJoinSquareProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const StrokeJoinSquare = React.forwardRef<SVGSVGElement, StrokeJoinSquareProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M6 6.5C6 6.22386 6.22386 6 6.5 6H17.5C17.7761 6 18 6.22386 18 6.5V17.5C18 17.7761 17.7761 18 17.5 18H12.5C12.2239 18 12 17.7761 12 17.5V12H6.5C6.22386 12 6 11.7761 6 11.5V6.5ZM7 7V11H12.5C12.7761 11 13 11.2239 13 11.5V17H17V7H7Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

StrokeJoinSquare.displayName = "StrokeJoinSquare";
