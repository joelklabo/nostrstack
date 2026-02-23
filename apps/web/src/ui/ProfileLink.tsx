import { useProfile } from '@nostrstack/react';
import {
  type CSSProperties,
  memo,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo
} from 'react';

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

const PROFILE_NAME_CACHE = new Map<string, string>();

type ProfileLinkProps = {
  pubkey: string;
  label?: string;
  preferLabel?: boolean;
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
  preferLabel = false,
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

  const profileMetaName = useMemo(
    () => profileMeta?.name?.trim() || profileMeta?.display_name?.trim() || null,
    [profileMeta]
  );
  useEffect(() => {
    if (profileMetaName) {
      PROFILE_NAME_CACHE.set(pubkey, profileMetaName);
    }
  }, [profileMetaName, pubkey]);

  const cachedProfileName = PROFILE_NAME_CACHE.get(pubkey);

  const classNames = useMemo(() => {
    const classes = ['profile-link', className?.trim(), showAvatar || avatarOnly ? 'profile-link--with-avatar' : ''];
    return classes.filter(Boolean).join(' ');
  }, [avatarOnly, className, showAvatar]);

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

  const resolvedProfileName = profileMetaName || cachedProfileName;
  const preferredLabel = label?.trim();
  const displayName = preferLabel && preferredLabel
    ? preferredLabel
    : resolvedProfileName || preferredLabel || `${pubkey.slice(0, 8)}...`;
  const resolvedTitle = preferLabel && resolvedProfileName && preferredLabel && resolvedProfileName !== preferredLabel
    ? `${preferredLabel} (${resolvedProfileName})`
    : displayName;
  const avatarUrl = profileMeta?.picture;
  const size = AVATAR_SIZES[avatarSize];

  return (
    <a
      href={href}
      className={classNames}
      onClick={handleClick}
      title={title ?? resolvedTitle}
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
