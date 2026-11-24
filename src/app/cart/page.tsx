import type { Metadata } from 'next';
import CartPage from '@/components/CartPage';

export const metadata: Metadata = { title: 'Your cart - PrintPro3D', description: 'Review your items and send your order request. We confirm shipping and send a payment link.' };

export default function Page() {
  return <CartPage />;
}
