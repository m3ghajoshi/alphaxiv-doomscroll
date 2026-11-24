import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const UpvoteIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 4 4 13h5v7h6v-7h5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const CommentIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"
      fill="currentColor"
      stroke="none"
    />
  </Svg>
);

export const ShareIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 5l7 7-7 7v-4c-5 0-8.5 1.5-11 5 1-5 4-10 11-11z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PaperIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Svg>
);

export const VolumeOnIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);

export const VolumeOffIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
    <path d="m22 9-6 6M16 9l6 6" />
  </Svg>
);

export const CaptionsIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3" />
  </Svg>
);

export const PlayIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const SparkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2z"
      fill="currentColor"
      stroke="none"
    />
  </Svg>
);

export const EyeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const PauseIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const RotateIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M21 12a9 9 0 0 1-15.5 6.2" />
    <path d="M3 12a9 9 0 0 1 15.5-6.2" />
    <path d="M18.5 2v4h-4M5.5 22v-4h4" />
  </Svg>
);
