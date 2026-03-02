import * as React from "react";

export interface AlConstrainVertProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AlConstrainVert = React.forwardRef<SVGSVGElement, AlConstrainVertProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8.5 6.50024C8.5 6.2241 8.72386 6.00024 9 6.00024H11.5H14C14.2761 6.00024 14.5 6.2241 14.5 6.50024C14.5 6.77639 14.2761 7.00024 14 7.00024H12V16.0002H14C14.2761 16.0002 14.5 16.2241 14.5 16.5002C14.5 16.7764 14.2761 17.0002 14 17.0002H11.5H9C8.72386 17.0002 8.5 16.7764 8.5 16.5002C8.5 16.2241 8.72386 16.0002 9 16.0002H11V7.00024H9C8.72386 7.00024 8.5 6.77639 8.5 6.50024Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

AlConstrainVert.displayName = "AlConstrainVert";
