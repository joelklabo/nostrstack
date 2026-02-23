import { useProfile } from '@nostrstack/react';
import { type CSSProperties, memo, type MouseEvent, useCallback, useMemo } from 'react';

import { buildProfilePath, navigateTo } from '../utils/navigation';
import { Image } from './Image';

interface ProfileMetadata {
  name?: string;
  display_name?: string;
  picture?: string;
}

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const AVATAR_SIZES: Record<AvatarSize, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 48
};

type ProfileLinkProps = {
  pubkey: string;
  label?: string;
  className?: string;
  title?: string;
  style?: CSSProperties;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Show avatar image */
  showAvatar?: boolean;
  /** Show only avatar (no text) */
  avatarOnly?: boolean;
  /** Avatar size */
  avatarSize?: AvatarSize;
};

export const ProfileLink = memo(function ProfileLink({
  pubkey,
  label,
  className,
  title,
  style,
  onClick,
  showAvatar = false,
  avatarOnly = false,
  avatarSize = 'sm'
}: ProfileLinkProps) {
  const href = useMemo(() => buildProfilePath(pubkey), [pubkey]);
  const { profile: profileEvent } = useProfile(pubkey);

  const profileMeta = useMemo<ProfileMetadata | null>(() => {
    if (!profileEvent) return null;
    try {
      return JSON.parse(profileEvent.content) as ProfileMetadata;
    } catch {
      return null;
    }
  }, [profileEvent]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (onClick) {
        onClick(event);
      }
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigateTo(href);
    },
    [href, onClick]
  );

  const displayName =
    profileMeta?.name || profileMeta?.display_name || label || `${pubkey.slice(0, 8)}...`;
  const avatarUrl = profileMeta?.picture;
  const size = AVATAR_SIZES[avatarSize];

  return (
    <a
      href={href}
      className={`${className || ''} ${showAvatar || avatarOnly ? 'profile-link--with-avatar' : ''}`.trim()}
      onClick={handleClick}
      title={title ?? displayName}
      style={style}
      aria-label={avatarOnly ? `View ${displayName}'s profile` : undefined}
    >
      {(showAvatar || avatarOnly) && (
        <Image
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          className="profile-link__avatar"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0
          }}
        />
      )}
      {!avatarOnly && <span className="profile-link__name">{displayName}</span>}
    </a>
  );
});
