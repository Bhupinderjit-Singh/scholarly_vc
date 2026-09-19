/**
 * The slice of the signed-in user the app shell renders (avatar, name,
 * handle, verification banner). `app/(app)/layout.tsx` builds it from
 * `requireUser()` once authentication exists (task 4.5); until then the
 * layout passes `null` and the shell shows a "Sign in" link instead of the
 * profile menu.
 */
export type ShellUser = {
  id: string;
  displayName: string;
  username: string;
  image: string | null;
  emailVerified: boolean;
};
