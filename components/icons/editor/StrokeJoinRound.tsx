import * as React from "react";

export interface StrokeJoinRoundProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const StrokeJoinRound = React.forwardRef<SVGSVGElement, StrokeJoinRoundProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6 6.5C6 6.22386 6.22386 6 6.5 6H12.5C15.5376 6 18 8.46243 18 11.5V17.5C18 17.7761 17.7761 18 17.5 18H12.5C12.2239 18 12 17.7761 12 17.5V12H6.5C6.22386 12 6 11.7761 6 11.5V6.5ZM7 7V11H12.5C12.7761 11 13 11.2239 13 11.5V17H17V11.5C17 9.01472 14.9853 7 12.5 7H7Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

StrokeJoinRound.displayName = "StrokeJoinRound";
