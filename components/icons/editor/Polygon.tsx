import * as React from "react";

export interface PolygonProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Polygon = React.forwardRef<SVGSVGElement, PolygonProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0001 4.5L4.20586 18H19.7943L12.0001 4.5ZM12.6496 3.625C12.3609 3.125 11.6392 3.125 11.3506 3.625L3.12333 17.875C2.83465 18.375 3.1955 19 3.77285 19H20.2273C20.8047 19 21.1655 18.375 20.8769 17.875L12.6496 3.625Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Polygon.displayName = "Polygon";
