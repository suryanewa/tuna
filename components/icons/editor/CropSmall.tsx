import * as React from "react";

export interface CropSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const CropSmall = React.forwardRef<SVGSVGElement, CropSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9 5.5C9 5.22386 8.77614 5 8.5 5C8.22386 5 8 5.22386 8 5.5V8H5.5C5.22386 8 5 8.22386 5 8.5C5 8.77614 5.22386 9 5.5 9H8V15.5C8 15.7761 8.22386 16 8.5 16H15V18.5C15 18.7761 15.2239 19 15.5 19C15.7761 19 16 18.7761 16 18.5V16H18.5C18.7761 16 19 15.7761 19 15.5C19 15.2239 18.7761 15 18.5 15H16V8.5C16 8.22386 15.7761 8 15.5 8H9V5.5ZM9 9V15H15V9H9Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

CropSmall.displayName = "CropSmall";
