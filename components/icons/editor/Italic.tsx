import * as React from "react";

export interface ItalicProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Italic = React.forwardRef<SVGSVGElement, ItalicProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10 6.5C10 6.22386 10.2239 6 10.5 6H13H15.5C15.7761 6 16 6.22386 16 6.5C16 6.77614 15.7761 7 15.5 7H13.4173L11.5991 17H13.5C13.7761 17 14 17.2239 14 17.5C14 17.7761 13.7761 18 13.5 18H11H8.5C8.22386 18 8 17.7761 8 17.5C8 17.2239 8.22386 17 8.5 17H10.5827L12.4009 7H10.5C10.2239 7 10 6.77614 10 6.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Italic.displayName = "Italic";
