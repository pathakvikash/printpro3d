import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import MotorTest from '@/components/MotorTest';
import Icon from '@/components/Icon';

export const metadata: Metadata = {
  title: 'Motor test simulator - PrintPro3D',
  description: 'Pick a drone motor and prop or a small gear motor and see thrust, current, power and efficiency as you change throttle.',
};

export default function MotorTestPage() {
  return (
    <PageShell wide title="Motor test" lead="Move the throttle and see what a motor does: speed, thrust or torque, current, power and efficiency. Set your drone weight and current limit to get warnings.">
      <MotorTest />
      <Link href="/shop" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
        <Icon name="cart" />Need a mount or wheel for this motor? Browse parts
      </Link>
    </PageShell>
  );
}
