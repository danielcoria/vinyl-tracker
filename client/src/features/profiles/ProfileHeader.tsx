// ============================================================================
// ProfileHeader.tsx: THE TOP OF A PROFILE PAGE
//
// The person's name, @username and "collecting since", plus:
//   - a Share button that copies the page's link
//   - for the owner only: the switch that makes the profile public or private
// ============================================================================

import { useState } from 'react';
import type { Profile } from '@vinyl/shared';
import { describeError } from '../../api/client';
import { useUpdateSettings } from '../../api/dust';
import { profileUrl } from '../../api/profiles';

export function ProfileHeader({ profile }: { profile: Profile }) {
  const since = new Date(profile.user.memberSince).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="profile-header">
      <div>
        <h1>{profile.user.displayName}</h1>
        <p className="muted">
          @{profile.user.username} · Collecting since {since}
        </p>
      </div>
      {profile.isPublic && <ShareButton username={profile.user.username} />}
      {profile.isOwner && <PrivacySwitch isPublic={profile.isPublic} />}
    </div>
  );
}

function ShareButton({ username }: { username: string }) {
  const url = profileUrl(username);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('yes');
    } catch {
      // Some browsers block copying; then the link is shown to copy by hand.
      setCopied('failed');
    }
  }

  return (
    <div className="share">
      <button type="button" className="button" onClick={copy}>
        Share profile
      </button>
      {/* role="status": screen readers announce the change when it appears. */}
      <span role="status" className="muted">
        {copied === 'yes' && 'Link copied!'}
        {copied === 'failed' && <span className="share-url">{url}</span>}
      </span>
    </div>
  );
}

function PrivacySwitch({ isPublic }: { isPublic: boolean }) {
  const updateSettings = useUpdateSettings();
  // While saving, show the new position straight away (the profile reloads after).
  const checked = updateSettings.isPending
    ? Boolean(updateSettings.variables.profilePublic)
    : isPublic;

  return (
    <div className="privacy-switch">
      <label>
        <input
          type="checkbox"
          checked={checked}
          disabled={updateSettings.isPending}
          onChange={(event) => updateSettings.mutate({ profilePublic: event.target.checked })}
        />
        Public profile
      </label>
      <span className="muted">
        {checked
          ? 'Anyone with the link can see this page.'
          : 'Only you can see this page. Turn this on to share it.'}
      </span>
      {updateSettings.isError && (
        <span className="field-error" role="alert">
          Couldn't change it: {describeError(updateSettings.error)}
        </span>
      )}
    </div>
  );
}
