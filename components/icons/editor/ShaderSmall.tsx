import * as React from "react";

export interface ShaderSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ShaderSmall = React.forwardRef<SVGSVGElement, ShaderSmallProps>(
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
      <path d="M12 5.5L6.5 8.625V14.875L12 18L17.5 14.875V8.625L12 5.5Z" stroke="currentColor" strokeOpacity={0.9}/>
      <path d="M12 11.75L6.5 8.625" stroke="currentColor" strokeOpacity={0.9}/>
      <path d="M12 11.75V18" stroke="currentColor" strokeOpacity={0.9}/>
      <path d="M12 11.75L17.5 8.625" stroke="currentColor" strokeOpacity={0.9}/>
    </svg>
  )
);

ShaderSmall.displayName = "ShaderSmall";
