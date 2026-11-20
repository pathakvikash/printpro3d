// Status rules for the Track step and for the owner's status script (scripts/set-status.mjs).
// Pure: no React, no fs. The script imports this file under Node's type stripping,
// so keep it to erasable TypeScript (no enums, no parameter properties, no namespaces).

export type TrackType = 'order' | 'request';

export type StatusView = {
  stages: string[];
  current: number; // index into stages; -1 when cancelled
  sentence: string;
  cancelled: boolean;
};

export const ORDER_STAGES = ['Received', 'Checked and quoted', 'Awaiting payment', 'Paid', 'Printing', 'Shipped', 'Delivered'];
export const REQUEST_STAGES = ['Received', 'Design in progress', 'Quote sent', 'Approved'];

type Entry = { stage: number; sentence: string };

export const ORDER_STATUSES: Record<string, Entry> = {
  pending_review: { stage: 0, sentence: 'We received your order and are checking it.' },
  needs_manual_quote: { stage: 0, sentence: 'We received your order and will send you a quote.' },
  quoted: { stage: 1, sentence: 'We checked your order and the price is confirmed.' },
  awaiting_payment: { stage: 2, sentence: 'We sent you a payment link. Printing starts once it is paid.' },
  paid: { stage: 3, sentence: 'Payment received. Your order is in the print queue.' },
  printing: { stage: 4, sentence: 'Your order is being printed.' },
  shipped: { stage: 5, sentence: 'Your order has been shipped.' },
  delivered: { stage: 6, sentence: 'Your order was delivered.' },
  cancelled: { stage: -1, sentence: 'This order was cancelled.' },
};

export const REQUEST_STATUSES: Record<string, Entry> = {
  new: { stage: 0, sentence: 'We received your request. A designer will look at it.' },
  designing: { stage: 1, sentence: 'A designer is working on your model.' },
  quote_sent: { stage: 2, sentence: 'We sent you a design and a quote.' },
  approved: { stage: 3, sentence: 'You approved the design. We will start printing.' },
  cancelled: { stage: -1, sentence: 'This request was cancelled.' },
};

export const ALL_STATUSES: Record<TrackType, string[]> = {
  order: Object.keys(ORDER_STATUSES),
  request: Object.keys(REQUEST_STATUSES),
};

// Keeps only letters, digits, underscore and space, max 30 chars: unknown statuses are shown back, so no markup gets in.
export function sanitizeStatus(status: unknown): string {
  return String(status ?? '').replace(/[^A-Za-z0-9_ ]/g, '').slice(0, 30);
}

export function describeStatus(type: TrackType, status: string): StatusView {
  const stages = type === 'request' ? REQUEST_STAGES : ORDER_STAGES;
  const table = type === 'request' ? REQUEST_STATUSES : ORDER_STATUSES;
  const raw = String(status ?? '');
  // own-property check: "constructor" or "__proto__" must not match Object.prototype
  if (Object.prototype.hasOwnProperty.call(table, raw)) {
    const e = table[raw];
    return { stages: [...stages], current: e.stage, sentence: e.sentence, cancelled: e.stage === -1 };
  }
  const clean = sanitizeStatus(raw);
  return {
    stages: [...stages],
    current: 0,
    sentence: clean ? `We received it. Status: ${clean}` : 'We received it.',
    cancelled: false,
  };
}
