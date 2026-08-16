"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./ClientProfileAvatar.module.css";

const PROFILE_UPDATED_EVENT = "burgerdesk:profile-updated";

export function ClientProfileAvatar() {
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [avatarAvailable, setAvatarAvailable] = useState(true);

  useEffect(() => {
    function refreshAvatar() {
      setAvatarAvailable(true);
      setAvatarVersion((current) => current + 1);
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, refreshAvatar);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, refreshAvatar);
  }, []);

  return (
    <span className={styles.avatar} aria-hidden="true">
      {avatarAvailable ? (
        <Image
          key={avatarVersion}
          src={`/api/profile/avatar?v=${avatarVersion}`}
          alt=""
          fill
          sizes="44px"
          unoptimized
          className={styles.image}
          onError={() => setAvatarAvailable(false)}
        />
      ) : (
        <UserRound />
      )}
    </span>
  );
}
