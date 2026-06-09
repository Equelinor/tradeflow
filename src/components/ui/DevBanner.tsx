import { IS_DEV } from '@/firebase';

export default function DevBanner() {
  if (!IS_DEV) return null;
  return (
    <div className="bg-amber-400 text-amber-900 text-xs font-medium text-center py-1 px-3">
      ⚠ DEV / STAGING — changes here do not affect the live site
    </div>
  );
}
