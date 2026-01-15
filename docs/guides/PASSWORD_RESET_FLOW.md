# Password Reset Flow for Admin/HR Users

This document explains how password reset works for admin and HR users using Supabase Authentication.

## Overview

Admin and HR users authenticate through **Supabase Auth** (not the custom employee portal authentication). When they request a password reset, Supabase handles the email delivery and token generation.

## Flow Diagram

```
1. User clicks "Forgot Password" on login page
   ↓
2. User enters email address
   ↓
3. Frontend calls /api/auth/reset-request
   ↓
4. API route validates email and checks throttling
   ↓
5. API calls Supabase Auth resetPasswordForEmail()
   ↓
6. Supabase sends email with reset link
   ↓
7. User clicks link in email
   ↓
8. User redirected to /reset-password page
   ↓
9. Page validates reset token/session
   ↓
10. User enters new password
   ↓
11. Frontend calls supabase.auth.updateUser()
   ↓
12. Password updated in Supabase Auth
   ↓
13. User redirected to login page
```

## Step-by-Step Breakdown

### Step 1: Request Password Reset

**Location:** `app/login/LoginPageClient.tsx`

When user clicks "Forgot Password" and enters their email:

```typescript
const handleForgotPassword = async () => {
  // ... validation ...

  const res = await fetch("/api/auth/reset-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  });

  toast.success("If that email exists, a reset link was sent.");
};
```

**Key Points:**
- Always shows success message (even if email doesn't exist) to prevent account enumeration
- Email is sent to lowercase and trimmed

### Step 2: API Route Processing

**Location:** `app/api/auth/reset-request/route.ts`

The API route performs several checks:

#### 2.1 Email Validation
```typescript
function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
```

#### 2.2 Throttling Protection
- **Minimum gap:** 5 minutes between requests per email
- **Daily limit:** Maximum 5 requests per email per 24 hours
- Checks `password_reset_requests` table for recent requests

```typescript
const MIN_GAP_MS = 5 * MINUTE; // 5 minutes
const DAILY_LIMIT = 5; // max per email per day
```

#### 2.3 Supabase Auth Call
```typescript
const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
  redirectTo: `${base}/reset-password`,
});
```

**What happens:**
- Supabase generates a secure reset token
- Sends email with reset link containing the token
- Link format: `https://your-site.com/reset-password?code=...&type=recovery` (PKCE) or `#access_token=...&type=recovery` (hash-based)

#### 2.4 Audit Logging
Records the attempt in `password_reset_requests` table:
```typescript
await supabaseAdmin.from("password_reset_requests").insert({
  email,
  requester_ip: requesterIp,
  user_agent: userAgent,
  success,
});
```

### Step 3: Email Delivery

Supabase sends an email with:
- Reset link (valid for limited time, typically 1 hour)
- Link contains authentication token/code
- Two formats supported:
  - **PKCE flow:** `?code=...&type=recovery` (newer, more secure)
  - **Hash-based:** `#access_token=...&refresh_token=...&type=recovery` (legacy)

### Step 4: Reset Password Page

**Location:** `app/reset-password/page.tsx`

When user clicks the link, they're redirected to `/reset-password`. The page handles multiple token formats:

#### 4.1 PKCE Code Exchange (New Format)
```typescript
const code = searchParams?.get("code");
const type = searchParams?.get("type");
if (code && type === "recovery") {
  await supabase.auth.exchangeCodeForSession(code);
}
```

#### 4.2 Hash-Based Token (Legacy Format)
```typescript
const hash = window.location.hash || "";
const params = new URLSearchParams(hash.slice(1));
const accessToken = params.get("access_token");
const refreshToken = params.get("refresh_token");
if (accessToken && refreshToken && typeParam === "recovery") {
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}
```

#### 4.3 Auth State Listener
```typescript
supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    setCanReset(true); // Enable password reset form
  }
});
```

### Step 5: Password Update

When user submits new password:

```typescript
const { error } = await supabase.auth.updateUser({
  password: newPassword.trim(),
});
```

**Requirements:**
- Password must be at least 8 characters
- Passwords must match (new password and confirm password)
- User must have valid recovery session

**What happens:**
- Supabase validates the recovery session
- Updates password in Supabase Auth (hashed with bcrypt)
- Invalidates old password
- Session remains active (user can continue using the app)

### Step 6: Redirect to Login

After successful password update:
```typescript
toast.success("Password updated. You can now sign in.");
router.push("/login");
router.refresh();
```

## Security Features

### 1. Account Enumeration Prevention
- Always returns `{ ok: true }` regardless of email existence
- Prevents attackers from discovering valid email addresses

### 2. Rate Limiting
- **5-minute cooldown** between requests per email
- **5 requests per day** maximum per email
- Prevents abuse and spam

### 3. Token Expiration
- Reset tokens expire after a set time (configured in Supabase)
- Old tokens cannot be reused
- Each reset request generates a new token

### 4. Secure Token Handling
- Tokens are single-use
- PKCE flow provides additional security
- Tokens are cryptographically secure

### 5. Audit Trail
- All reset requests logged to `password_reset_requests` table
- Includes IP address and user agent
- Tracks success/failure for monitoring

## Database Schema

### password_reset_requests Table
```sql
CREATE TABLE public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  requester_ip TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
- Index on `email` and `requested_at` for throttling queries

## Configuration

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `NEXT_PUBLIC_SITE_URL` - Base URL for reset links (optional)

### Supabase Dashboard Settings
1. **Authentication > Email Templates**
   - Customize reset password email template
   - Set reset link expiration time

2. **Authentication > URL Configuration**
   - Set redirect URLs
   - Configure site URL

## Error Handling

### Common Errors

1. **Invalid or expired link**
   - Error: "This reset link is invalid or has expired"
   - Solution: Request a new reset email

2. **Rate limit exceeded**
   - Error: Silent failure (returns `{ ok: true }` but doesn't send email)
   - Solution: Wait 5 minutes or try again tomorrow

3. **Email not found**
   - Error: Silent failure (returns `{ ok: true }` but doesn't send email)
   - Solution: Verify email address is correct

4. **Password too short**
   - Error: "Password must be at least 8 characters"
   - Solution: Use a longer password

5. **Passwords don't match**
   - Error: "Passwords don't match"
   - Solution: Ensure both password fields match

## Differences from Employee Portal

| Feature | Admin/HR (Supabase Auth) | Employee Portal (Custom) |
|---------|-------------------------|-------------------------|
| **Authentication** | Supabase Auth | Custom RPC function |
| **Password Storage** | Supabase Auth (hashed) | `employees.portal_password` (plain text) |
| **Reset Flow** | Email-based with tokens | Admin/HR resets to default |
| **Reset Page** | `/reset-password` | N/A (admin action) |
| **Security** | Token-based, time-limited | Manual reset by admin |

## Troubleshooting

### Reset email not received
1. Check spam/junk folder
2. Verify email address is correct
3. Check Supabase email logs
4. Verify rate limiting hasn't blocked the request
5. Check `password_reset_requests` table for recent attempts

### Reset link expired
1. Request a new reset email
2. Use the link within the expiration window (typically 1 hour)
3. Don't request multiple resets in quick succession

### Reset page shows "invalid link"
1. Ensure you're using the most recent reset email
2. Check that the URL hasn't been modified
3. Try requesting a new reset email
4. Clear browser cache and cookies

## Related Files

- `app/api/auth/reset-request/route.ts` - API route for reset requests
- `app/reset-password/page.tsx` - Reset password UI page
- `app/login/LoginPageClient.tsx` - Login page with forgot password button
- `supabase/migrations/*` - Database migrations (password_reset_requests table)

## Notes

- Admin/HR users are stored in `public.users` table
- Their authentication is handled entirely by Supabase Auth
- Password reset does NOT affect the `users` table directly
- All password operations go through Supabase Auth API
- The `password_reset_requests` table is for audit/throttling only