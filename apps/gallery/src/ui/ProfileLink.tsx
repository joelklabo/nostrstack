import { type CSSProperties, type MouseEvent, useCallback, useMemo } from 'react';

import { buildProfilePath, navigateTo } from '../utils/navigation';

type ProfileLinkProps = {
  pubkey: string;
  label?: string;
  className?: string;
  title?: string;
  style?: CSSProperties;
};

export function ProfileLink({ pubkey, label, className, title, style }: ProfileLinkProps) {
  const href = useMemo(() => buildProfilePath(pubkey), [pubkey]);

  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigateTo(href);
  }, [href]);

  return (
    <a
      href={href}
      className={className}
      onClick={handleClick}
      title={title ?? pubkey}
      style={style}
    >
      {label ?? pubkey}
    </a>
  );
}
