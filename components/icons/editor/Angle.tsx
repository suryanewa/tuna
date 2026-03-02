import * as React from "react";

export interface AngleProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Angle = React.forwardRef<SVGSVGElement, AngleProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.59615 16.5966C9.40089 16.7919 9.40089 17.1085 9.59615 17.3037C9.79142 17.499 10.108 17.499 10.3033 17.3037L15.253 12.354C15.4483 12.1587 15.4483 11.8421 15.253 11.6469L10.3033 6.69714C10.108 6.50187 9.79142 6.50187 9.59615 6.69714C9.40089 6.8924 9.40089 7.20898 9.59615 7.40424L11.7707 9.57884C10.6955 11.0092 10.6956 12.9914 11.7711 14.4217L9.59615 16.5966ZM12.4878 13.705L14.1923 12.0004L12.4874 10.2955C11.7899 11.3212 11.7901 12.6794 12.4878 13.705Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Angle.displayName = "Angle";
