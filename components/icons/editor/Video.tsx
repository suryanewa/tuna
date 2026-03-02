import * as React from "react";

export type VideoProps = React.SVGProps<SVGSVGElement>;

export const Video = React.forwardRef<SVGSVGElement, VideoProps>(
  (props, ref) => (
    <svg
      ref={ref}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M18 4C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6C4 4.89543 4.89543 4 6 4H18ZM6 5C5.44772 5 5 5.44772 5 6V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V6C19 5.44772 18.5523 5 18 5H6ZM9.125 9.83496C9.125 9.06516 9.95833 8.58385 10.625 8.96875L14.375 11.1338C15.0415 11.5187 15.0415 12.4803 14.375 12.8652L10.625 15.0303C9.95845 15.4151 9.1253 14.9346 9.125 14.165V9.83496ZM10.125 14.165L13.875 12L10.125 9.83496V14.165Z"
        fill="currentColor"
        fillOpacity={0.9}
      />
    </svg>
  )
);

Video.displayName = "Video";
