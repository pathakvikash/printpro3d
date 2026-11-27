import { manifestResponse } from '@/lib/orrery';

export const dynamic = 'force-dynamic'; // env is read per request

export const GET = () => manifestResponse();
