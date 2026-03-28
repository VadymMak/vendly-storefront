import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'VendShop <noreply@vendshop.shop>';

interface OrderItem {
  name: string;
  quantity: number;
  price: number | null;
}

function formatPrice(price: number): string {
  return `€${price.toFixed(2)}`;
}

function itemsTable(items: OrderItem[]): string {
  return items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${item.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${item.price ? formatPrice(item.price * item.quantity) : '—'}</td>
        </tr>`,
    )
    .join('');
}

/** Order confirmation email → customer */
export async function sendOrderConfirmation(params: {
  to: string;
  customerName: string;
  orderId: string;
  storeName: string;
  total: number;
  items: OrderItem[];
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `Order confirmed — ${params.storeName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#16a34a;border-radius:12px 12px 0 0;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:24px">Order Confirmed!</h1>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
            <p>Hello <strong>${params.customerName}</strong>,</p>
            <p>Thank you for your order from <strong>${params.storeName}</strong>.</p>

            <p style="font-size:14px;color:#6b7280">Order #${params.orderId.slice(0, 8)}</p>

            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280">Item</th>
                  <th style="padding:8px 12px;text-align:center;font-size:13px;color:#6b7280">Qty</th>
                  <th style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280">Price</th>
                </tr>
              </thead>
              <tbody>${itemsTable(params.items)}</tbody>
            </table>

            <div style="text-align:right;padding:12px;background:#f0fdf4;border-radius:8px;margin-top:8px">
              <strong style="font-size:18px;color:#16a34a">Total: ${formatPrice(params.total)}</strong>
            </div>

            <p style="margin-top:24px;font-size:13px;color:#9ca3af">
              The seller will contact you soon with delivery details.
            </p>
          </div>
          <p style="text-align:center;margin-top:16px;font-size:12px;color:#9ca3af">
            Powered by <a href="https://vendshop.shop" style="color:#16a34a">VendShop</a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send order confirmation email:', err);
  }
}

/** New order notification email → store owner */
export async function sendNewOrderNotification(params: {
  to: string;
  ownerName: string;
  orderId: string;
  storeName: string;
  customerName: string;
  customerEmail: string;
  total: number;
  items: OrderItem[];
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `New order #${params.orderId.slice(0, 8)} — ${params.storeName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:24px">New Order!</h1>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
            <p>Hello${params.ownerName ? ` <strong>${params.ownerName}</strong>` : ''},</p>
            <p>You received a new order in <strong>${params.storeName}</strong>.</p>

            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0 0 4px"><strong>Customer:</strong> ${params.customerName}</p>
              <p style="margin:0 0 4px"><strong>Email:</strong> <a href="mailto:${params.customerEmail}">${params.customerEmail}</a></p>
              <p style="margin:0"><strong>Order:</strong> #${params.orderId.slice(0, 8)}</p>
            </div>

            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280">Item</th>
                  <th style="padding:8px 12px;text-align:center;font-size:13px;color:#6b7280">Qty</th>
                  <th style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280">Price</th>
                </tr>
              </thead>
              <tbody>${itemsTable(params.items)}</tbody>
            </table>

            <div style="text-align:right;padding:12px;background:#f0fdf4;border-radius:8px;margin-top:8px">
              <strong style="font-size:18px;color:#16a34a">Total: ${formatPrice(params.total)}</strong>
            </div>

            <div style="text-align:center;margin-top:24px">
              <a href="https://vendshop.shop/dashboard/orders" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
                View in Dashboard
              </a>
            </div>
          </div>
          <p style="text-align:center;margin-top:16px;font-size:12px;color:#9ca3af">
            Powered by <a href="https://vendshop.shop" style="color:#16a34a">VendShop</a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send new order notification:', err);
  }
}
