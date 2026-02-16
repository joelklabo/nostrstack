import '../styles/components/find-friend.css';

export function FindFriendCard({ onClick }: { onClick?: () => void }) {
  return (
    <section className="find-friend-card" aria-label="Find a friend to tip">
      <div className="find-friend-card__content">
        <div className="find-friend-card__title">Find a friend to tip</div>
        <div className="find-friend-card__subtitle">
          Paste an npub, nprofile, or NIP-05 address to jump to their profile.
        </div>
      </div>
      <button
        className="find-friend-card__action"
        type="button"
        onClick={onClick}
        aria-label="Find a friend to tip"
      >
        Find friend
      </button>
    </section>
  );
}
