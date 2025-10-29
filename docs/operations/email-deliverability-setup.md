# Email Deliverability Setup Guide

## Overview

This document provides comprehensive instructions for setting up email infrastructure for the Weg Translator application's verification email system. Proper configuration is critical for ensuring high deliverability rates, avoiding spam filters, and maintaining sender reputation.

**Requirements**: Req#13 (Documentation), NFR-34 (Email retry logic), Req#14 (Email delivery failure handling)

## Table of Contents

1. [DNS Records Configuration](#dns-records-configuration)
2. [Email Service Provider Setup](#email-service-provider-setup)
3. [Bounce and Complaint Handling](#bounce-and-complaint-handling)
4. [Monitoring and Alerts](#monitoring-and-alerts)
5. [Testing and Verification](#testing-and-verification)
6. [Troubleshooting](#troubleshooting)

---

## DNS Records Configuration

### Dedicated Subdomain

**Recommended**: Use a dedicated subdomain for all transactional emails to isolate sender reputation.

```
Subdomain: auth.yourdomain.com
Purpose: All verification emails, password resets, and authentication-related messages
```

**Benefits**:
- Isolates transactional email reputation from marketing emails
- Easier to troubleshoot deliverability issues
- Cleaner analytics and monitoring
- Better compliance with ESP requirements

### SPF (Sender Policy Framework)

SPF prevents email spoofing by specifying which mail servers are authorized to send email on behalf of your domain.

#### Setup Instructions

1. **Access your DNS provider** (e.g., Cloudflare, Route53, GoDaddy)

2. **Add TXT record** for your subdomain:

```
Type: TXT
Name: auth.yourdomain.com
Value: v=spf1 include:spf.resend.com include:sendgrid.net ~all
TTL: 3600
```

**Record Breakdown**:
- `v=spf1`: SPF version 1
- `include:spf.resend.com`: Authorize Resend servers
- `include:sendgrid.net`: Authorize SendGrid servers
- `~all`: Soft fail for unauthorized servers (use `-all` for hard fail after testing)

3. **Verify SPF record**:

```bash
dig TXT auth.yourdomain.com
# or
nslookup -type=TXT auth.yourdomain.com
```

**Expected Output**:
```
auth.yourdomain.com.  3600  IN  TXT  "v=spf1 include:spf.resend.com include:sendgrid.net ~all"
```

#### SPF Best Practices

- **Limit DNS Lookups**: SPF has a 10-lookup limit. Use `include:` sparingly.
- **Start with Soft Fail**: Use `~all` initially, then switch to `-all` after confirming delivery works.
- **Monitor Alignment**: Ensure `From` domain matches SPF domain (auth.yourdomain.com).

### DKIM (DomainKeys Identified Mail)

DKIM adds a cryptographic signature to emails, allowing recipients to verify the email came from your domain and wasn't altered in transit.

#### Resend DKIM Setup

1. **Log into Resend Dashboard** → Domains → Add Domain

2. **Enter your subdomain**: `auth.yourdomain.com`

3. **Resend will provide 3 CNAME records** (example):

```
Type: CNAME
Name: resend._domainkey.auth.yourdomain.com
Value: resend1._domainkey.resend.com
TTL: 3600

Type: CNAME
Name: resend2._domainkey.auth.yourdomain.com
Value: resend2._domainkey.resend.com
TTL: 3600

Type: CNAME
Name: resend3._domainkey.auth.yourdomain.com
Value: resend3._domainkey.resend.com
TTL: 3600
```

4. **Add all three CNAME records** to your DNS

5. **Wait for propagation** (5-30 minutes)

6. **Verify in Resend Dashboard**: Status should show "Verified"

#### SendGrid DKIM Setup

1. **Log into SendGrid Dashboard** → Settings → Sender Authentication

2. **Click "Authenticate Your Domain"**

3. **Enter subdomain**: `auth.yourdomain.com`

4. **SendGrid will provide CNAME records** (example):

```
Type: CNAME
Name: s1._domainkey.auth.yourdomain.com
Value: s1.domainkey.u12345.wl.sendgrid.net
TTL: 3600

Type: CNAME
Name: s2._domainkey.auth.yourdomain.com
Value: s2.domainkey.u12345.wl.sendgrid.net
TTL: 3600
```

5. **Add CNAME records** to your DNS

6. **Verify in SendGrid**: Status should show "Verified"

#### DKIM Verification

Test DKIM signatures using online tools:

```bash
# Send test email, then check headers
# Tools: mail-tester.com, dkimvalidator.com
```

**Expected Result**: `DKIM-Signature` header present with `d=auth.yourdomain.com`

### DMARC (Domain-based Message Authentication, Reporting & Conformance)

DMARC builds on SPF and DKIM, telling receiving servers what to do with emails that fail authentication and where to send reports.

#### Initial DMARC Setup (Monitoring Mode)

Start with monitoring mode to avoid blocking legitimate emails:

```
Type: TXT
Name: _dmarc.auth.yourdomain.com
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; pct=100; adkim=r; aspf=r
TTL: 3600
```

**Record Breakdown**:
- `v=DMARC1`: DMARC version 1
- `p=none`: Policy (none=monitor only, no action taken)
- `rua=mailto:dmarc@yourdomain.com`: Aggregate report destination
- `pct=100`: Apply policy to 100% of messages
- `adkim=r`: Relaxed DKIM alignment
- `aspf=r`: Relaxed SPF alignment

#### Progressive DMARC Enforcement

**Phase 1 (Week 1-2)**: Monitor

```
p=none
```
- Collect reports
- Verify SPF and DKIM pass rates
- Identify any legitimate sources failing authentication

**Phase 2 (Week 3-4)**: Quarantine

```
p=quarantine; pct=10
```
- Apply quarantine policy to 10% of failing messages
- Monitor bounce/complaint rates
- Gradually increase `pct` to 100% over 2 weeks

**Phase 3 (Week 5+)**: Reject

```
p=reject; pct=100
```
- Reject all messages failing authentication
- Continuously monitor reports

#### Production DMARC Policy

After testing (4-6 weeks):

```
Type: TXT
Name: _dmarc.auth.yourdomain.com
Value: v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc-forensic@yourdomain.com; pct=100; adkim=s; aspf=s
TTL: 3600
```

**Changes from initial**:
- `p=reject`: Reject unauthenticated emails
- `ruf=mailto:...`: Forensic (failure) reports
- `adkim=s`, `aspf=s`: Strict alignment

#### DMARC Report Analysis

**Tools for analyzing reports**:
- [dmarc-analyzer.com](https://dmarc-analyzer.com)
- [postmark.com/dmarc](https://dmarkian.com)
- [dmarcian.com](https://dmarcian.com)

**Key metrics to monitor**:
- SPF pass rate (target: >99%)
- DKIM pass rate (target: >99%)
- DMARC alignment rate (target: >99%)
- Unauthenticated sources (investigate and authorize or block)

---

## Email Service Provider Setup

### Resend (Primary Provider)

#### Account Setup

1. **Create account**: [resend.com/signup](https://resend.com/signup)

2. **Generate API key**:
   - Dashboard → API Keys → Create API Key
   - Name: `weg-translator-production`
   - Permissions: Send emails only
   - **Copy key**: `re_xxxxx...` (save to Supabase Vault)

3. **Configure domain**: Follow DKIM steps above

4. **Set sending rate limits** (if available):
   - Burst: 100 emails/minute
   - Sustained: 1000 emails/hour

#### Integration Code

```typescript
// supabase/functions/cleanup-orphaned-user/email-providers/resend.ts

import { Resend } from 'https://esm.sh/resend@2.0.0';

export async function sendViaResend(
  to: string,
  code: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

  try {
    const { data, error } = await resend.emails.send({
      from: 'Weg Translator <noreply@auth.yourdomain.com>',
      to: [to],
      subject: 'Verify Your Account Cleanup Request',
      html: generateEmailHtml(code),
      tags: [
        { name: 'category', value: 'verification' },
        { name: 'type', value: 'orphan-cleanup' },
      ],
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### SendGrid (Fallback Provider)

#### Account Setup

1. **Create account**: [sendgrid.com/pricing](https://sendgrid.com/pricing)
   - Free tier: 100 emails/day
   - Recommended: Essentials plan (40k emails/month)

2. **Generate API key**:
   - Settings → API Keys → Create API Key
   - Name: `weg-translator-production`
   - Permissions: Mail Send → Full Access
   - **Copy key**: `SG.xxxxx...` (save to Supabase Vault)

3. **Configure domain**: Follow DKIM steps above

4. **Setup email templates** (optional):
   - Marketing → Design Library → Create Template
   - Template ID: Save for code

#### Integration Code

```typescript
// supabase/functions/cleanup-orphaned-user/email-providers/sendgrid.ts

import sgMail from 'https://esm.sh/@sendgrid/mail@7.7.0';

export async function sendViaSendGrid(
  to: string,
  code: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY'));

  const msg = {
    to,
    from: 'Weg Translator <noreply@auth.yourdomain.com>',
    subject: 'Verify Your Account Cleanup Request',
    html: generateEmailHtml(code),
    categories: ['verification', 'orphan-cleanup'],
    customArgs: {
      type: 'verification',
      flow: 'orphan-cleanup',
    },
  };

  try {
    const [response] = await sgMail.send(msg);
    return {
      success: true,
      messageId: response.headers['x-message-id'],
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.body?.errors?.[0]?.message || error.message,
    };
  }
}
```

### Retry Logic with Fallback

```typescript
// supabase/functions/cleanup-orphaned-user/email.ts

export async function sendVerificationEmail(
  email: string,
  code: string,
  correlationId: string
): Promise<{ success: boolean; provider?: string; error?: string }> {
  const retryDelays = [0, 1000, 2000]; // immediate, +1s, +2s

  // Try Resend first (primary)
  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }

    const result = await sendViaResend(email, code);

    if (result.success) {
      console.log('Email sent via Resend', {
        correlationId,
        attempt: attempt + 1,
        messageId: result.messageId,
      });
      return { success: true, provider: 'resend' };
    }

    console.warn('Resend attempt failed', {
      correlationId,
      attempt: attempt + 1,
      error: result.error,
    });
  }

  // Fallback to SendGrid
  console.log('Resend failed, trying SendGrid fallback', { correlationId });

  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }

    const result = await sendViaSendGrid(email, code);

    if (result.success) {
      console.log('Email sent via SendGrid', {
        correlationId,
        attempt: attempt + 1,
        messageId: result.messageId,
      });
      return { success: true, provider: 'sendgrid' };
    }

    console.warn('SendGrid attempt failed', {
      correlationId,
      attempt: attempt + 1,
      error: result.error,
    });
  }

  // Both failed
  return {
    success: false,
    error: 'All email providers failed after retries',
  };
}
```

---

## Bounce and Complaint Handling

### Resend Webhooks

1. **Configure webhook** in Resend Dashboard:
   - Settings → Webhooks → Add Endpoint
   - URL: `https://your-project.supabase.co/functions/v1/email-webhook`
   - Events: `email.bounced`, `email.complained`

2. **Webhook handler**:

```typescript
// supabase/functions/email-webhook/index.ts

serve(async (req) => {
  const event = await req.json();

  if (event.type === 'email.bounced') {
    const { email, bounce_type } = event.data;

    // Log bounce
    await supabase.from('email_bounces').insert({
      email_hash: await hashEmail(email),
      bounce_type, // 'hard' or 'soft'
      timestamp: new Date().toISOString(),
      provider: 'resend',
    });

    // Mark email as invalid if hard bounce
    if (bounce_type === 'hard') {
      await supabase.from('invalid_emails').insert({
        email_hash: await hashEmail(email),
        reason: 'hard_bounce',
      });
    }
  }

  if (event.type === 'email.complained') {
    const { email } = event.data;

    // Log complaint
    await supabase.from('spam_complaints').insert({
      email_hash: await hashEmail(email),
      timestamp: new Date().toISOString(),
      provider: 'resend',
    });
  }

  return new Response(null, { status: 200 });
});
```

### SendGrid Event Webhook

Similar setup as Resend, using SendGrid's Event Webhook feature.

---

## Monitoring and Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Bounce Rate | <0.3% | >0.5% |
| Spam Complaint Rate | <0.1% | >0.3% |
| Delivery Time | <30s | >60s |
| SPF Pass Rate | >99% | <95% |
| DKIM Pass Rate | >99% | <95% |
| Delivery Success Rate | >99.5% | <98% |

### Grafana Dashboard

Example queries for monitoring:

```sql
-- Bounce rate (last 24h)
SELECT
  COUNT(*) FILTER (WHERE bounce_type = 'hard') AS hard_bounces,
  COUNT(*) AS total_sent,
  (COUNT(*) FILTER (WHERE bounce_type = 'hard')::float / COUNT(*)) * 100 AS bounce_rate_percent
FROM email_bounces
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- Delivery time p95
SELECT
  percentile_cont(0.95) WITHIN GROUP (ORDER BY delivery_duration_ms) AS p95_delivery_time_ms
FROM email_logs
WHERE timestamp > NOW() - INTERVAL '24 hours';
```

### Alert Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: email_deliverability
    rules:
      - alert: HighBounceRate
        expr: bounce_rate_percent > 0.5
        for: 1h
        annotations:
          summary: "Bounce rate exceeded 0.5%"
          description: "Current bounce rate: {{ $value }}%"

      - alert: SlowEmailDelivery
        expr: p95_delivery_time_ms > 60000
        for: 15m
        annotations:
          summary: "Email delivery time exceeded 60s"
```

---

## Testing and Verification

### Pre-Production Checklist

- [ ] SPF record added and verified
- [ ] DKIM records added for both Resend and SendGrid
- [ ] DMARC record added (monitoring mode initially)
- [ ] Test email sent via Resend → delivered
- [ ] Test email sent via SendGrid → delivered
- [ ] Bounce webhook configured and tested
- [ ] Spam complaint webhook configured
- [ ] Monitoring dashboards created
- [ ] Alerts configured

### Testing Tools

**mail-tester.com**: Send test email, get score out of 10

```bash
# Send test email to provided address
# Check: SPF, DKIM, DMARC, spam score, content issues
```

**mxtoolbox.com**: Check DNS records

```
https://mxtoolbox.com/SuperTool.aspx?action=spf:auth.yourdomain.com
https://mxtoolbox.com/SuperTool.aspx?action=dmarc:auth.yourdomain.com
```

**gmass.co/email-deliverability-test**: Deliverability across providers

---

## Troubleshooting

### Common Issues

**SPF Hard Fail**:
- Symptom: Emails bouncing with "SPF check failed"
- Solution: Verify `From` domain matches SPF domain, check SPF syntax

**DKIM Signature Invalid**:
- Symptom: DKIM verification failing
- Solution: Re-verify CNAME records, wait for DNS propagation (up to 48h), check selector names

**High Bounce Rate**:
- Symptom: >1% bounce rate
- Solution: Validate email addresses before sending, remove hard bounces from list, check domain reputation

**Emails in Spam**:
- Symptom: Emails going to spam folder
- Solution: Improve DMARC policy to `p=reject`, add unsubscribe link (not needed for transactional), warm up IP (for dedicated IPs)

**Slow Delivery**:
- Symptom: Emails taking >30s to deliver
- Solution: Check ESP status pages, verify network latency, scale ESP plan if rate-limited

---

## References

- [RFC 7208: SPF](https://datatracker.ietf.org/doc/html/rfc7208)
- [RFC 6376: DKIM](https://datatracker.ietf.org/doc/html/rfc6376)
- [RFC 7489: DMARC](https://datatracker.ietf.org/doc/html/rfc7489)
- [Resend Documentation](https://resend.com/docs)
- [SendGrid Documentation](https://docs.sendgrid.com)

---

**Last Updated**: 2025-01-28
**Version**: 1.0
**Maintainer**: DevOps Team
