import { business } from '@/lib/contact';

// Bottom-left so it never covers the cart drawer/controls on the right; renders nothing without a number.
export default function WhatsAppButton() {
  if (!business.whatsapp) return null;
  return (
    <a
      href={`https://wa.me/${business.whatsapp}`}
      target='_blank'
      rel='noopener noreferrer'
      aria-label='Chat on WhatsApp'
      className='fixed bottom-20 left-4 sm:bottom-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg ring-1 ring-black/10 hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 dark:ring-white/20'
    >
      <svg aria-hidden='true' className='h-6 w-6' viewBox='0 0 24 24' fill='currentColor'>
        <path d='M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.700 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.200c0 1.300.9 2.500 1 2.700.1.200 1.800 2.800 4.400 3.900 1.600.7 2.300.7 3.100.6.500-.1 1.500-.6 1.700-1.200.2-.6.2-1.100.2-1.200-.1-.2-.3-.2-.5-.3z' />
      </svg>
    </a>
  );
}
