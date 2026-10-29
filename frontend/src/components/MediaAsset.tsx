import React, { useState } from 'react';

interface MediaImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  unavailableLabel?: string;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  src,
  alt,
  unavailableLabel = 'Image unavailable',
  ...props
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) {
    return <div className="media-unavailable" role="img" aria-label={unavailableLabel}>{unavailableLabel}</div>;
  }
  return <img {...props} src={src} alt={alt || ''} onError={() => setFailedSrc(src)} />;
};

interface MediaVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  unavailableLabel?: string;
}

export const MediaVideo: React.FC<MediaVideoProps> = ({
  src,
  unavailableLabel = 'Video unavailable',
  ...props
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) {
    return <div className="media-unavailable" role="img" aria-label={unavailableLabel}>{unavailableLabel}</div>;
  }
  return <video {...props} src={src} onError={() => setFailedSrc(src)} />;
};
