import React from 'react';

interface GauGaucIconProps {
    className?: string;
}

// GAU-GAUC Combined Icon - Red to Yellow gradient
const GauGaucIcon: React.FC<GauGaucIconProps> = ({ className = "w-6 h-6" }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 262.27 262.27"
            className={className}
        >
            <defs>
                <linearGradient
                    id="gauGaucGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                    gradientUnits="objectBoundingBox"
                >
                    <stop offset="0%" stopColor="#e4201f" />
                    <stop offset="100%" stopColor="#ffd007" />
                </linearGradient>
                <style>
                    {`
            .gau-gauc-fill{fill:url(#gauGaucGradient);}
            .gau-gauc-stroke{fill:none;stroke:#fff;stroke-miterlimit:10;stroke-width:7px;}
          `}
                </style>
            </defs>
            <g id="Layer_2" data-name="Layer 2">
                <g id="Layer_1-2" data-name="Layer 1">
                    <circle
                        className="gau-gauc-fill"
                        cx="131.14"
                        cy="131.14"
                        r="131.11"
                        transform="translate(-54.32 131.14) rotate(-45)"
                    />
                    <path
                        className="gau-gauc-stroke"
                        d="M131,232c-23.41,0-42.45-45.68-42.45-101.83S107.55,28.3,131,28.3,169.6,53,172.76,96.13a.29.29,0,0,1-.57,0C169.06,53.4,154,28.87,131,28.87S89.08,74.3,89.08,130.14,107.87,231.4,131,231.4c11.65,0,22.15-7.75,29.56-21.83,8.06-15.31,12.32-37.41,12.32-63.91v-.08c0-3.77-3.42-6.85-7.61-6.85H132a.28.28,0,0,1,0-.56h33.24c4.5,0,8.17,3.32,8.17,7.41v.08c0,26.59-4.28,48.78-12.38,64.18C153.51,224.11,142.83,232,131,232Z"
                    />
                    <path
                        className="gau-gauc-stroke"
                        d="M164.19,62.1C181,55.32,226,42.81,224.31,74.94c-.58,11.08-6.19,21.75-12,31-8.35,13.25-18.84,25.16-30.07,36-25.45,24.67-56.42,46.59-90.18,58.15C77.31,205.13,44,213.24,40.17,189.76c-1.78-11,3.66-22.56,8.93-31.8,8.23-14.44,19.26-27.27,31-38.91q5.11-5.05,10.49-9.82"
                    />
                    <ellipse
                        className="gau-gauc-stroke"
                        cx="129.11"
                        cy="129.8"
                        rx="42.16"
                        ry="111.82"
                        transform="translate(-52.54 152.66) rotate(-52.32)"
                    />
                </g>
            </g>
        </svg>
    );
};

export default GauGaucIcon;

