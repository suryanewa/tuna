import * as React from "react";

export interface ShaderProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Shader = React.forwardRef<SVGSVGElement, ShaderProps>(
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
      <path d="M12 3.5L4.5 7.75V16.25L12 20.5L19.5 16.25V7.75L12 3.5Z" stroke="currentColor" strokeOpacity={0.9}/>
      <path d="M12 12L4.5 7.75" stroke="currentColor" strokeOpacity={0.9}/>
      <path d="M12 12V20.5" stroke="currentColor" strokeOpacity={0.9}/>
      <path d="M12 12L19.5 7.75" stroke="currentColor" strokeOpacity={0.9}/>
    </svg>
  )
);

Shader.displayName = "Shader";
