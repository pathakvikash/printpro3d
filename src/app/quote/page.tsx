import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import UploadForm from '@/components/UploadForm';

export const metadata: Metadata = { title: 'Get a quote - PrintPro3D', description: 'Upload an STL or OBJ file and get an instant price for your 3D print.' };

export default function QuotePage() {
  return (
    <PageShell title="Get a quote" lead="Upload your 3D file, pick a material and quantity, and see the price.">
      <UploadForm />
    </PageShell>
  );
}
