import * as React from "react";

export interface HighlightsSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const HighlightsSmall = React.forwardRef<SVGSVGElement, HighlightsSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7 12.0001C7 14.419 8.71776 16.4368 11 16.9001V7.1001C8.71776 7.56337 7 9.58112 7 12.0001Z" fill="currentColor" fillOpacity={0.3}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M18.0002 12.0001C18.0002 15.5262 15.3921 18.4447 12.0002 18.9293V5.07085C15.3921 5.55545 18.0002 8.47393 18.0002 12.0001ZM11.9983 19.9384C15.9455 19.4472 19.0002 16.0804 19.0002 12.0001C19.0002 7.91978 15.9455 4.55295 11.9983 4.06173C11.4502 3.99353 11.0002 4.4478 11.0002 5.00009V6.083C11.0002 6.08302 11.0001 6.08303 11 6.08304C8.16229 6.55912 6 9.02709 6 12.0001C6 14.9731 8.16229 17.441 11 17.9171C11.0001 17.9171 11.0002 17.9172 11.0002 17.9172V19.0001C11.0002 19.5524 11.4502 20.0066 11.9983 19.9384ZM11 16.9001C8.71776 16.4368 7 14.419 7 12.0001C7 9.58113 8.71776 7.56337 11 7.1001V16.9001Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

HighlightsSmall.displayName = "HighlightsSmall";
