import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import ModelPlayground from '@/components/ModelPlayground';

export const metadata: Metadata = {
  title: 'Model playground - PrintPro3D',
  description: 'Spin, zoom and measure drone, RC and robotics parts, or your own STL/OBJ, with a blueprint and material previews. Then send it to Get a quote.',
};

export default function PlaygroundPage() {
  return (
    <PageShell wide title="Model playground" lead="View a sample part or your own file in 3D, check its size on the blueprint, try materials and lighting, then send it to Get a quote.">
      <ModelPlayground />
    </PageShell>
  );
}
