import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[leads/checkout] Starting...');

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const origin = request.headers.get('origin') || 'https://vendshop.shop';

    // Use lead's one-time price, fallback to 249 EUR
    const amountEur = lead.priceOneTime ?? 249;
    const unitAmount = Math.round(amountEur * 100); // cents

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: lead.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Website — ${lead.businessName ?? lead.contactName ?? 'Client'}`,
              description: lead.package ? `Package: ${lead.package}` : undefined,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'lead_payment',
        leadId: lead.id,
      },
      success_url: `${origin}/admin/leads?paid=true`,
      cancel_url: `${origin}/admin/leads`,
    });

    console.log('[leads/checkout] Session created, url:', checkoutSession.url);
    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[leads/checkout] Error:', error instanceof Error ? error.message : error);
    console.error('[leads/checkout] Stack:', error instanceof Error ? error.stack : 'no stack');
    return NextResponse.json({ error: 'Checkout session creation failed' }, { status: 500 });
  }
}
