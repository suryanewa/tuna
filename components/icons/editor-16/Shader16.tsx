import * as React from "react";

export interface Shader16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Shader16 = React.forwardRef<SVGSVGElement, Shader16Props>(
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
      <path d="M7.73535 2.75488C7.8973 2.65387 8.1027 2.65387 8.26465 2.75488L12.2646 5.25488C12.4109 5.34625 12.5 5.5063 12.5 5.67871V10.3213C12.5 10.4937 12.4109 10.6538 12.2646 10.7451L8.26465 13.2451C8.1027 13.3461 7.8973 13.3461 7.73535 13.2451L3.73535 10.7451C3.58913 10.6538 3.5 10.4937 3.5 10.3213V5.67871C3.5 5.5063 3.58913 5.34625 3.73535 5.25488L7.73535 2.75488Z" stroke="currentColor"/>
      <path d="M3.5 5.5L8 7.99992M8 13.5V7.99992M12.5 5.5L8 7.99992" stroke="currentColor"/>
    </svg>
  )
);

Shader16.displayName = "Shader16";
