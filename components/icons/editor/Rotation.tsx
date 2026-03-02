import * as React from "react";

export interface RotationProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Rotation = React.forwardRef<SVGSVGElement, RotationProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9 8.5C9 8.22386 8.77614 8 8.5 8C8.22386 8 8 8.22386 8 8.5V15.5C8 15.7761 8.22386 16 8.5 16H15.5C15.7761 16 16 15.7761 16 15.5C16 15.2239 15.7761 15 15.5 15H13C13 12.7909 11.2091 11 9 11V8.5ZM9 12V15H12C12 13.3431 10.6569 12 9 12Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Rotation.displayName = "Rotation";
