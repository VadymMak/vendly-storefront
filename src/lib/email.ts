// src/lib/email.ts
// Proven email templates transferred from vendly (battle-tested)

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL || 'VendShop <noreply@vendshop.shop>';
const OWNER = process.env.OWNER_EMAIL || '';
const SITE = process.env.NEXT_PUBLIC_SITE_NAME || 'VendShop';
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://vendshop.shop';

// ── Shared base template ─────────────────────────────────────────────────────
function baseTemplate(content: string, previewText = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${SITE}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;color:#f4f4f5">${previewText}</div>` : ''}

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

          <!-- HEADER -->
          <tr>
            <td align="center" style="padding-bottom:24px">
              <a href="${BASE}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px">
                <div style="width:36px;height:36px;background:#16a34a;border-radius:9px;display:inline-block;vertical-align:middle;line-height:36px;text-align:center">
                  <span style="color:#fff;font-weight:800;font-size:16px">V</span>
                </div>
                <span style="font-size:20px;font-weight:700;color:#111;vertical-align:middle">${SITE}</span>
              </a>
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding:28px 0 8px">
              <p style="margin:0;color:#9ca3af;font-size:12px">
                &copy; ${new Date().getFullYear()} ${SITE} &middot;
                <a href="${BASE}" style="color:#9ca3af;text-decoration:underline">${BASE.replace('https://', '')}</a>
              </p>
              <p style="margin:6px 0 0;color:#d1d5db;font-size:11px">
                You received this email because of activity on ${SITE}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Helper components ────────────────────────────────────────────────────────
const ACCENT_GREEN = '#16a34a';
const ACCENT_BLUE = '#3b82f6';
const ACCENT_YELLOW = '#f59e0b';
const ACCENT_RED = '#ef4444';

function accentBar(color: string) {
  return `<div style="height:4px;background:${color};width:100%"></div>`;
}

function cardBody(content: string) {
  return `<div style="padding:36px 40px">${content}</div>`;
}

function heading(text: string, color = '#111827') {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:${color};line-height:1.3">${text}</h1>`;
}

function subtext(text: string) {
  return `<p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">${text}</p>`;
}

function button(label: string, href: string, color = ACCENT_GREEN) {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px">${label}</a>`;
}

function infoBox(content: string) {
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin:20px 0">${content}</div>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0" />`;
}

function smallNote(text: string) {
  return `<p style="margin:20px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">${text}</p>`;
}

function formatPrice(price: number): string {
  return `&euro;${price.toFixed(2)}`;
}

// ── Interfaces ───────────────────────────────────────────────────────────────
interface OrderItem {
  name: string;
  quantity: number;
  price: number | null;
}

// ── Email verification ───────────────────────────────────────────────────────
export async function sendVerificationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}) {
  const verifyUrl = `${BASE}/api/auth/verify-email?token=${token}`;

  const content = cardBody(`
    ${accentBar(ACCENT_BLUE)}
    <div style="height:32px"></div>
    ${heading('Confirm your email address')}
    ${subtext(`Hi ${name}, please verify your email address to get started with ${SITE}.`)}
    ${infoBox(`
      <p style="margin:0;color:#6b7280;font-size:13px">Verification link expires in</p>
      <p style="margin:4px 0 0;color:#111827;font-size:22px;font-weight:700">24 hours</p>
    `)}
    ${button('Verify Email &rarr;', verifyUrl, ACCENT_BLUE)}
    ${smallNote(`If you didn't create an account on ${SITE}, you can safely ignore this email.`)}
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Verify your email — ${SITE}`,
      html: baseTemplate(content, `Confirm your email to get started with ${SITE}`),
    });
  } catch (err) {
    console.error('Failed to send verification email:', err);
  }
}

// ── Password reset ───────────────────────────────────────────────────────────
export async function sendPasswordResetEmail({
  email,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}) {
  const resetUrl = `${BASE}/auth/reset-password?token=${token}`;

  const content = cardBody(`
    ${accentBar(ACCENT_BLUE)}
    <div style="height:32px"></div>
    ${heading('Reset your password')}
    ${subtext(`Hi ${name}, we received a request to reset your password. Click the button below to choose a new one.`)}
    ${infoBox(`
      <p style="margin:0;color:#6b7280;font-size:13px">This link expires in</p>
      <p style="margin:4px 0 0;color:#111827;font-size:22px;font-weight:700">1 hour</p>
    `)}
    ${button('Reset Password &rarr;', resetUrl, ACCENT_BLUE)}
    ${divider()}
    ${smallNote('If you didn\'t request a password reset, ignore this email. Your password will not be changed.')}
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Reset your password — ${SITE}`,
      html: baseTemplate(content, 'Reset your password link inside'),
    });
  } catch (err) {
    console.error('Failed to send password reset email:', err);
  }
}

// ── Welcome email (store creation) ───────────────────────────────────────────
export async function sendWelcomeEmail({
  ownerEmail,
  ownerName,
  storeName,
  storeSlug,
}: {
  ownerEmail: string;
  ownerName: string;
  storeName: string;
  storeSlug: string;
}) {
  const dashboardUrl = `${BASE}/dashboard`;
  const shopUrl = `${BASE}/shop/${storeSlug}`;

  const content = cardBody(`
    ${accentBar(ACCENT_GREEN)}
    <div style="height:32px"></div>
    ${heading('Your shop is live! &#127881;', '#111827')}
    ${subtext(`Hi ${ownerName}, welcome to ${SITE}! Your shop <strong style="color:#111827">${storeName}</strong> is ready for customers.`)}
    ${infoBox(`
      <p style="margin:0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Your shop URL</p>
      <a href="${shopUrl}" style="display:block;margin:6px 0 0;color:#16a34a;font-size:16px;font-weight:600;text-decoration:none;word-break:break-all">${shopUrl}</a>
    `)}
    <p style="margin:20px 0 8px;color:#374151;font-size:14px;font-weight:600">Next steps:</p>
    <ul style="margin:0;padding-left:20px;color:#6b7280;font-size:14px;line-height:2">
      <li>Add your first products</li>
      <li>Customize your shop settings</li>
      <li>Share your shop link with customers</li>
    </ul>
    <div style="margin-top:28px">
      ${button('Go to Dashboard &rarr;', dashboardUrl)}
    </div>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: ownerEmail,
      subject: `Your shop "${storeName}" is live — ${SITE}`,
      html: baseTemplate(content, `${storeName} is ready — start selling today`),
    });
  } catch (err) {
    console.error('Failed to send welcome email:', err);
  }
}

// ── Order confirmation → customer ────────────────────────────────────────────
export async function sendOrderConfirmation({
  to,
  customerName,
  orderId,
  storeName,
  total,
  items,
}: {
  to: string;
  customerName: string;
  orderId: string;
  storeName: string;
  total: number;
  items: OrderItem[];
}) {
  const itemRows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px">${i.name}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:center;color:#6b7280;font-size:14px">&times;${i.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;font-size:14px;font-weight:600">${i.price ? formatPrice(i.price * i.quantity) : '&mdash;'}</td>
      </tr>`,
    )
    .join('');

  const content = cardBody(`
    ${accentBar(ACCENT_GREEN)}
    <div style="height:32px"></div>
    ${heading('Order Confirmed! &#10003;')}
    ${subtext(`Hi ${customerName}, thank you for your order from <strong style="color:#111827">${storeName}</strong>.`)}
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Order #${orderId.slice(0, 8)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px">
      <thead>
        <tr style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">
          <th style="text-align:left;padding-bottom:10px;font-weight:600">Item</th>
          <th style="text-align:center;padding-bottom:10px;font-weight:600">Qty</th>
          <th style="text-align:right;padding-bottom:10px;font-weight:600">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    ${infoBox(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:#6b7280;font-size:14px">Order total</span>
        <span style="color:#111827;font-size:22px;font-weight:700">${formatPrice(total)}</span>
      </div>
    `)}
    ${smallNote('The seller will contact you soon with delivery details.')}
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Order confirmed — ${storeName}`,
      html: baseTemplate(content, `Your order total: ${formatPrice(total)}`),
    });
  } catch (err) {
    console.error('Failed to send order confirmation email:', err);
  }
}

// ── New order notification → store owner ─────────────────────────────────────
export async function sendNewOrderNotification({
  to,
  ownerName,
  orderId,
  storeName,
  customerName,
  customerEmail,
  total,
  items,
}: {
  to: string;
  ownerName: string;
  orderId: string;
  storeName: string;
  customerName: string;
  customerEmail: string;
  total: number;
  items: OrderItem[];
}) {
  const itemList = items
    .map(
      (i) => `<p style="margin:6px 0;color:#374151;font-size:14px">
        <span style="color:#6b7280">&bull;</span> ${i.name} &times;${i.quantity}
        <span style="float:right;font-weight:600">${i.price ? formatPrice(i.price * i.quantity) : '&mdash;'}</span>
      </p>`,
    )
    .join('');

  const content = cardBody(`
    ${accentBar(ACCENT_BLUE)}
    <div style="height:32px"></div>
    ${heading('New Order Received! &#128717;')}
    ${subtext(`Hi${ownerName ? ` <strong>${ownerName}</strong>` : ''}, you have a new order from <strong style="color:#111827">${customerName}</strong>.`)}
    ${infoBox(`
      <p style="margin:0 0 4px;color:#374151;font-size:14px"><strong>Customer:</strong> ${customerName}</p>
      <p style="margin:0 0 4px;color:#374151;font-size:14px"><strong>Email:</strong> <a href="mailto:${customerEmail}" style="color:#3b82f6">${customerEmail}</a></p>
      <p style="margin:0;color:#374151;font-size:14px"><strong>Order:</strong> #${orderId.slice(0, 8)}</p>
    `)}
    ${infoBox(itemList)}
    ${infoBox(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:#6b7280;font-size:14px">Order total</span>
        <span style="color:#111827;font-size:22px;font-weight:700">${formatPrice(total)}</span>
      </div>
    `)}
    <div style="text-align:center;margin-top:8px">
      ${button('View Dashboard &rarr;', `${BASE}/dashboard/orders`)}
    </div>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `New order #${orderId.slice(0, 8)} — ${formatPrice(total)} — ${storeName}`,
      html: baseTemplate(content, `New order from ${customerName}: ${formatPrice(total)}`),
    });
  } catch (err) {
    console.error('Failed to send new order notification:', err);
  }
}

// ── Review notification → store owner ────────────────────────────────────────
export async function sendReviewNotification({
  to,
  storeName,
  authorName,
  rating,
}: {
  to: string;
  storeName: string;
  authorName: string;
  rating: number;
}) {
  const stars = '&#9733;'.repeat(rating) + '&#9734;'.repeat(5 - rating);

  const content = cardBody(`
    ${accentBar(ACCENT_YELLOW)}
    <div style="height:32px"></div>
    ${heading('New Review! &#11088;')}
    ${subtext(`<strong style="color:#111827">${authorName}</strong> left a review for <strong style="color:#111827">${storeName}</strong>.`)}
    ${infoBox(`
      <p style="margin:0;font-size:28px;color:#f59e0b;letter-spacing:2px">${stars}</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:13px">View and manage reviews in your dashboard.</p>
    `)}
    ${button('View Reviews &rarr;', `${BASE}/dashboard/reviews`, ACCENT_YELLOW)}
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `New review for ${storeName} — ${SITE}`,
      html: baseTemplate(content, `${authorName} left a ${rating}-star review`),
    });
  } catch (err) {
    console.error('Failed to send review notification:', err);
  }
}

// ── Content report → admin ───────────────────────────────────────────────────
export async function sendReportNotification({
  itemTitle,
  itemId,
  reportReason,
  reporterEmail,
}: {
  itemTitle: string;
  itemId: string;
  reportReason: string;
  reporterEmail: string;
}) {
  if (!OWNER) return;

  const content = cardBody(`
    ${accentBar(ACCENT_RED)}
    <div style="height:32px"></div>
    ${heading('&#9888; Content Report', ACCENT_RED)}
    ${subtext('A listing has been reported by a user and requires your review.')}
    ${infoBox(`
      <p style="margin:0 0 8px;color:#374151;font-size:14px"><strong>Item:</strong> ${itemTitle}</p>
      <p style="margin:0 0 8px;color:#374151;font-size:14px"><strong>Reason:</strong> ${reportReason}</p>
      <p style="margin:0;color:#374151;font-size:14px"><strong>Reporter:</strong> ${reporterEmail}</p>
    `)}
    ${button('Review in Admin &rarr;', `${BASE}/admin/items?report=${itemId}`, ACCENT_RED)}
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: OWNER,
      subject: `Content report — ${itemTitle}`,
      html: baseTemplate(content, `Report: ${reportReason}`),
    });
  } catch (err) {
    console.error('Failed to send report notification:', err);
  }
}
