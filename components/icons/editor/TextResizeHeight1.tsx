import * as React from "react";

export interface TextResizeHeight1Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const TextResizeHeight1 = React.forwardRef<SVGSVGElement, TextResizeHeight1Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5 7.5C5 7.22386 5.22386 7 5.5 7H18.5C18.7761 7 19 7.22386 19 7.5C19 7.77614 18.7761 8 18.5 8H5.5C5.22386 8 5 7.77614 5 7.5ZM5 15.5C5 15.2239 5.22386 15 5.5 15H12.5C12.7761 15 13 15.2239 13 15.5C13 15.7761 12.7761 16 12.5 16H5.5C5.22386 16 5 15.7761 5 15.5ZM5.5 11C5.22386 11 5 11.2239 5 11.5C5 11.7761 5.22386 12 5.5 12H18.5C18.7761 12 19 11.7761 19 11.5C19 11.2239 18.7761 11 18.5 11H5.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

TextResizeHeight1.displayName = "TextResizeHeight1";
