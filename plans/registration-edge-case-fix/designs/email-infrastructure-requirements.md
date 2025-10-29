# Email Infrastructure Requirements (SPF/DKIM/DMARC) Design

## Overview

This document specifies the email infrastructure requirements for reliable delivery of verification codes in the orphaned user cleanup system. Proper configuration of SPF, DKIM, and DMARC is mandatory for >99% deliverability in 2025.

## Requirements Addressed

- **Req#5**: Enhanced Registration Flow with Retry Logic
- **Req#14**: Email Delivery Failure Edge Case

## Email Authentication Standards (2025 Requirements)

### SPF (Sender Policy Framework)

**Purpose**: Specifies which mail servers are authorized to send email from your domain.

**DNS Record Type**: TXT

**Format**:
```
v=spf1 include:spf.resend.com include:sendgrid.net ~all
```

**Components**:
- `v=spf1`: SPF version 1
- `include:spf.resend.com`: Authorize Resend's mail servers
- `include:sendgrid.net`: Authorize SendGrid's mail servers
- `~all`: Soft fail for unauthorized servers (recommended for testing)
- `-all`: Hard fail for unauthorized servers (recommended for production after testing)

**Recommendation**: Start with `~all`, monitor bounce/spam rates, switch to `-all` after verification.

### DKIM (DomainKeys Identified Mail)

**Purpose**: Cryptographic signature proving email authenticity.

**DNS Record Type**: TXT

**Setup**:
1. Generate DKIM keys via ESP dashboard (Resend/SendGrid)
2. Add public key to DNS

**Format** (provided by ESP):
```
resend._domainkey.yourdomain.com IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..."
sendgrid._domainkey.yourdomain.com IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD..."
```

**Testing**: Send test email, check DKIM signature in email headers.

### DMARC (Domain-based Message Authentication, Reporting & Conformance)

**Purpose**: Policy for handling SPF/DKIM failures + aggregate reporting.

**DNS Record Type**: TXT

**Format**:
```
_dmarc.yourdomain.com IN TXT "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; pct=100; adkim=r; aspf=r"
```

**Parameters**:
- `v=DMARC1`: Version
- `p=none`: Policy for failures (none = monitor only, quarantine = spam folder, reject = bounce)
- `rua=mailto:...`: Aggregate report recipient email
- `pct=100`: Percentage of emails subject to policy (100 = all)
- `adkim=r`: DKIM alignment mode (r = relaxed)
- `aspf=r`: SPF alignment mode (r = relaxed)

**Recommended Progression**:
1. **Phase 1** (Week 1-2): `p=none` - Monitor reports, fix issues
2. **Phase 2** (Week 3-4): `p=quarantine` - Quarantine failures, monitor impact
3. **Phase 3** (Week 5+): `p=reject` - Reject failures (strictest)

## Dedicated Subdomain

**Recommendation**: Use dedicated subdomain for transactional emails.

**Setup**:
```
auth.yourdomain.com
```

**Rationale**:
- Isolates reputation of transactional vs marketing emails
- Allows stricter DMARC policy for transactional emails
- Simplifies DNS management

**DNS Records**:
```
; SPF for subdomain
auth.yourdomain.com IN TXT "v=spf1 include:spf.resend.com include:sendgrid.net ~all"

; DKIM for subdomain
resend._domainkey.auth.yourdomain.com IN TXT "v=DKIM1; k=rsa; p=..."
sendgrid._domainkey.auth.yourdomain.com IN TXT "v=DKIM1; k=rsa; p=..."

; DMARC for subdomain
_dmarc.auth.yourdomain.com IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
```

## Email Service Provider Configuration

### Resend (Primary ESP)

**Setup**:
1. Add domain: Dashboard → Domains → Add Domain
2. Enter `auth.yourdomain.com`
3. Copy DNS records provided (SPF, DKIM, DMARC)
4. Add to your DNS provider
5. Verify domain in Resend dashboard
6. Configure webhook for bounce notifications

**API Configuration**:
```typescript
import { Resend } from 'resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

await resend.emails.send({
  from: 'verify@auth.yourdomain.com',
  to: userEmail,
  subject: 'Verification Code - Account Recovery',
  html: verificationEmailTemplate(code),
  headers: {
    'X-Entity-Ref-ID': correlationId, // For tracking
  },
});
```

### SendGrid (Fallback ESP)

**Setup**:
1. Add authenticated sender: Settings → Sender Authentication
2. Enter `verify@auth.yourdomain.com`
3. Follow DNS setup wizard
4. Verify domain
5. Configure Event Webhook for bounces

**API Configuration**:
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY'));

await sgMail.send({
  from: 'verify@auth.yourdomain.com',
  to: userEmail,
  subject: 'Verification Code - Account Recovery',
  html: verificationEmailTemplate(code),
  custom_args: {
    correlation_id: correlationId,
  },
});
```

## Email Retry Strategy

### Multi-Provider Failover

```typescript
async function sendVerificationEmail(
  email: string,
  code: string,
  correlationId: string
): Promise<void> {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS = [0, 1000, 2000]; // 0s, 1s, 2s

  let lastError: Error | null = null;

  // Try Resend first
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt]);
    }

    try {
      await sendViaResend(email, code, correlationId);
      logger.info('Email sent via Resend', { email: hashEmail(email), attempt });
      return; // Success
    } catch (error) {
      lastError = error;
      logger.warn('Resend attempt failed', { attempt, error: error.message });
    }
  }

  // Fallback to SendGrid
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt]);
    }

    try {
      await sendViaSendGrid(email, code, correlationId);
      logger.info('Email sent via SendGrid (fallback)', { email: hashEmail(email), attempt });
      return; // Success
    } catch (error) {
      lastError = error;
      logger.warn('SendGrid attempt failed', { attempt, error: error.message });
    }
  }

  // All attempts failed
  throw new Error(`Email delivery failed after all attempts: ${lastError?.message}`);
}
```

## Email Template

### HTML + Plain Text

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">Account Recovery Verification</h2>

    <p>You requested to clean up an incomplete registration for your account.</p>

    <p>Your verification code is:</p>

    <div style="
      background-color: #f3f4f6;
      border: 2px solid #2563eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      margin: 24px 0;
    ">
      <div style="
        font-family: 'Courier New', monospace;
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 4px;
        color: #1e40af;
      ">
        {{CODE}}
      </div>
    </div>

    <p><strong>This code expires in 5 minutes.</strong></p>

    <p>If you didn't request this code, please ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 14px; color: #6b7280;">
      Reference ID: {{CORRELATION_ID}}
    </p>
  </div>
</body>
</html>
```

**Plain Text Version**:
```
Account Recovery Verification

You requested to clean up an incomplete registration for your account.

Your verification code is:

{{CODE}}

This code expires in 5 minutes.

If you didn't request this code, please ignore this email.

---
Reference ID: {{CORRELATION_ID}}
```

**Why Both**: Some email clients prefer plain text; always provide both for maximum compatibility.

## Bounce Handling

### Webhook Configuration

**Resend Webhook**:
```typescript
// File: supabase/functions/email-webhooks/resend.ts

serve(async (req) => {
  const signature = req.headers.get('resend-signature');
  const body = await req.text();

  // Verify webhook signature
  if (!verifyResendSignature(signature, body)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    await handleEmailFailure(event.data.email, event.type);
  }

  return new Response('OK', { status: 200 });
});
```

**SendGrid Webhook**: Similar implementation.

### Bounce Processing

```typescript
async function handleEmailFailure(email: string, reason: string) {
  // Log bounce/complaint
  logger.warn('Email delivery failure', {
    email: hashEmail(email),
    reason,
    timestamp: new Date().toISOString(),
  });

  // Mark email as invalid (prevent future sends)
  await supabase.from('invalid_emails').insert({
    email_hash: await hashEmail(email),
    reason,
    detected_at: new Date().toISOString(),
  });

  // Alert if bounce rate exceeds threshold
  const bounceRate = await calculateBounceRate();
  if (bounceRate > 0.003) { // 0.3%
    await sendAlertToslack('High bounce rate detected', { bounceRate });
  }
}
```

## Monitoring Requirements

### Metrics to Track

```typescript
interface EmailDeliverabilityMetrics {
  // Delivery
  sentCount: number;
  deliveredCount: number;
  deliveryRate: number; // %

  // Bounces
  hardBounceCount: number;
  softBounceCount: number;
  bounceRate: number; // %

  // Spam
  spamComplaintCount: number;
  spamRate: number; // %

  // Performance
  avgDeliveryTime: number; // seconds

  // ESP health
  resendSuccessRate: number; // %
  sendgridSuccessRate: number; // %
}
```

### Alert Thresholds

```typescript
const EMAIL_ALERTS = {
  bounceRateHigh: {
    condition: 'bounceRate > 0.3%',
    severity: 'critical',
    action: 'Check email list quality, verify DNS records',
  },

  spamRateHigh: {
    condition: 'spamRate > 0.1%',
    severity: 'critical',
    action: 'Review email content, check DMARC policy',
  },

  deliveryTimeSlow: {
    condition: 'avgDeliveryTime > 30s',
    severity: 'warning',
    action: 'Check ESP status, verify API latency',
  },

  espFailoverHigh: {
    condition: 'sendgridSuccessRate > 10% (fallback usage)',
    severity: 'warning',
    action: 'Investigate Resend issues',
  },
};
```

## Testing Procedure

### DNS Verification

```bash
# Check SPF record
dig TXT auth.yourdomain.com

# Expected output includes:
# "v=spf1 include:spf.resend.com include:sendgrid.net ~all"

# Check DKIM record
dig TXT resend._domainkey.auth.yourdomain.com

# Expected output includes:
# "v=DKIM1; k=rsa; p=..."

# Check DMARC record
dig TXT _dmarc.auth.yourdomain.com

# Expected output includes:
# "v=DMARC1; p=none; rua=mailto:..."
```

### Email Deliverability Test

1. **Send test email** via Resend/SendGrid
2. **Check headers** in received email:
   ```
   Authentication-Results: spf=pass dkim=pass dmarc=pass
   ```
3. **Use testing tools**:
   - Mail Tester (mail-tester.com): Score should be 10/10
   - GlockApps: Inbox placement test
   - MX Toolbox: SPF/DKIM/DMARC validator

### Load Test

```typescript
// Send 100 verification codes concurrently
const emails = generateTestEmails(100);

await Promise.all(
  emails.map(email =>
    sendVerificationEmail(email, generateSecureCode(), crypto.randomUUID())
  )
);

// Measure:
// - Success rate (should be 100%)
// - Average delivery time (should be <5s)
// - ESP distribution (Resend vs SendGrid)
```

## Acceptance Criteria

- [x] SPF record format documented with ESP includes
- [x] DKIM setup procedure documented (per ESP)
- [x] DMARC record format documented with phased deployment strategy
- [x] Dedicated subdomain recommendation documented (auth.yourdomain.com)
- [x] Multi-provider retry strategy specified (Resend → SendGrid, 3 attempts each)
- [x] Email template provided (HTML + plain text)
- [x] Bounce webhook handling documented
- [x] Monitoring metrics and alert thresholds specified
- [x] Testing procedures documented (DNS verification, deliverability test)

**Status**: Ready for implementation in Phase 2 (setup) and Phase 6 (monitoring)
