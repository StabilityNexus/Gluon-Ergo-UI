import React from 'react';

interface ErgIconProps {
    className?: string;
}

const ErgIcon: React.FC<ErgIconProps> = ({ className = "w-8 h-8" }) => {
    return (
        <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            x="0px"
            y="0px"
            viewBox="0 0 58.4 58.4"
            className={className}
            fill="currentColor"
        >
            <title>Ergo Logo</title>
            <g id="main">
                <g id="Group-16" transform="translate(-70.000000, -35.000000)">
                    <g transform="translate(70.000000, 34.000000)">
                        <g id="Group-15" transform="translate(0.000000, 0.830280)">
                            <path
                                id="Fill-9"
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M11.2,47.8l18.3,7.4l18.2-7.8L55,29.1l-7.8-18.2L28.9,3.6l-18.2,7.8L3.4,29.7L11.2,47.8z
                M29.5,58.6c-0.2,0-0.4,0-0.6-0.1L9.3,50.6c-0.4-0.2-0.7-0.5-0.9-0.9L0.1,30.3c-0.2-0.4-0.2-0.8,0-1.3L8,9.5
                c0.2-0.4,0.5-0.7,0.9-0.9l19.4-8.3c0.4-0.2,0.8-0.2,1.3,0l19.6,7.9C49.5,8.3,49.8,8.6,50,9l8.3,19.4c0.2,0.4,0.2,0.8,0,1.3
                l-7.9,19.6c-0.2,0.4-0.5,0.7-0.9,0.9l-19.4,8.3C30,58.6,29.7,58.6,29.5,58.6z"
                            />
                            <polygon
                                id="Fill-10"
                                fillRule="evenodd"
                                clipRule="evenodd"
                                points="33.4,29.1 25.6,37.7 38,37.7 38,41.5 20.5,41.5 20.5,37.7 28.3,29.1 20.5,21 
                20.5,17.3 38,17.3 38,21 25.8,21"
                            />
                        </g>
                    </g>
                </g>
            </g>
        </svg>
    );
};

export default ErgIcon;
