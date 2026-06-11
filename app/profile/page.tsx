import { redirect } from 'next/navigation';

import { ProfilePanel } from '@/components/profile-panel';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?next=/profile' as never);
  }

  return <ProfilePanel userName={user.name} />;
}
