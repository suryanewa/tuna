import * as React from "react";

export interface InvertSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const InvertSmall = React.forwardRef<SVGSVGElement, InvertSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.251 5.99936C11.6246 5.47873 12.3754 5.47873 12.749 5.99936C13.907 7.6129 16 10.8302 16 13.0003C15.9997 15.2093 14.209 17.0003 12 17.0003L11.7939 16.9955C9.68071 16.8882 8.00025 15.1402 8 13.0003C8 10.8302 10.093 7.6129 11.251 5.99936ZM12 16.0003C13.6567 16.0003 14.9997 14.657 15 13.0003C15 12.174 14.5803 11.0111 13.9229 9.75424C13.4626 8.87441 12.9259 8.0227 12.4502 7.32065L12 6.67319V16.0003Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

InvertSmall.displayName = "InvertSmall";
