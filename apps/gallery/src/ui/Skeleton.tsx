import { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ variant = 'text', width, height, className = '', style, ...props }: SkeletonProps) {
  const styles = {
    width,
    height,
    ...style,
  };

  return (
    <div
      className={`skeleton skeleton--${variant} ${className}`}
      style={styles}
      {...props}
    />
  );
}
