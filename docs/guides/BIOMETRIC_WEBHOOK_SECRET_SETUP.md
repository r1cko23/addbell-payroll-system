# Biometric webhook secret – setup guide

This guide explains how to **generate**, **configure**, and **use** the webhook secret for the biometric punch API so only your ZKTeco device or middleware can send time in/out to the app.

**Before you start:** Connect the biometric device to your PC and install the ZKTeco software so the device is detected and recording punches. See [ZKTeco LX50 biometric setup](./ZKTECO_LX50_BIOMETRIC_SETUP.md#connect-the-zkteco-lx50-to-your-pc-do-this-first) for hardware connection, drivers, and software setup. Then return here to generate the secret and configure the API.

---

## 1. Generate a secret

Run **one** of these in your terminal and copy the output.

**macOS / Linux:**
```bash
openssl rand -base64 32
```

**Node:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

You should get a long random string (e.g. `K7x9mN2pQ4vR8sT1wY3zA5bC6dE0fG2hJ4kL7mN9pQ=`). Use this as your **webhook secret**.

---

## 2. Add the secret to the app

### Local (`.env.local`)

1. Open the project root and edit (or create) **`.env.local`**.
2. Add:
   ```env
   BIOMETRIC_WEBHOOK_SECRET=paste-your-generated-secret-here
   ```
3. Save the file.
4. Restart the dev server (`npm run dev` or `yarn dev`).

### Production (e.g. Vercel)

1. In Vercel: **Project → Settings → Environment Variables**.
2. **Add new:**
   - **Key:** `BIOMETRIC_WEBHOOK_SECRET`
   - **Value:** the same secret you generated.
   - **Environments:** Production (and Preview if you use it).
3. Save and **redeploy** the project so the variable is applied.

---

## 3. Use the secret when calling the API

Every `POST` to `/api/biometric/punch` must include the secret in a header.

| Header name           | Header value        |
|-----------------------|---------------------|
| `X-Biometric-Secret`  | Your secret (exact)  |

**Example – cURL:**
```bash
curl -X POST "https://YOUR-DOMAIN/api/biometric/punch" \
  -H "Content-Type: application/json" \
  -H "X-Biometric-Secret: YOUR_SECRET_HERE" \
  -d '{"employee_code":"10001","punched_at":"2026-03-14T08:00:00.000Z","punch_type":"in"}'
```

**Example – ZKTeco middleware / script:**  
Store the secret in the middleware’s environment (e.g. its own `.env` or config) and send it in the `X-Biometric-Secret` header on every request to `https://YOUR-DOMAIN/api/biometric/punch`.

If the header is missing or incorrect, the API returns **401 Unauthorized**.

---

## 4. Checklist

- [ ] Secret generated (32+ chars, random).
- [ ] `BIOMETRIC_WEBHOOK_SECRET` set in `.env.local` (local).
- [ ] `BIOMETRIC_WEBHOOK_SECRET` set in host env vars (production).
- [ ] App restarted / redeployed after adding the variable.
- [ ] Middleware or device sends `X-Biometric-Secret: <secret>` on every punch request.
- [ ] `.env.local` is in `.gitignore` (never commit the secret).

For full ZKTeco LX50 and office locations setup, see [ZKTECO_LX50_BIOMETRIC_SETUP.md](./ZKTECO_LX50_BIOMETRIC_SETUP.md).
