# ZKTeco LX50 (and compatible) biometric setup

The app supports **both** web app clock in/out and **biometric device** punches (e.g. ZKTeco LX50). All punches are stored in the same `time_entries` table so timesheets and payslips use one source of truth.

**Setup order:** Connect the device to your PC → Install software and verify it works → Generate webhook secret and configure your app → Point middleware/sync to the punch API.

---

## Connect the ZKTeco LX50 to your PC (do this first)

Before generating the webhook secret or sending punches to the app, you need to connect the biometric device to a PC and confirm it is detected and recording attendance.

**WiFi:** The LX50 **does not support wireless WiFi**. Official specs list only **USB Host** and **USB Client**; connection to the PC is via USB cable (or Ethernet only if your specific variant has a network port—check your model).

**Box contents:** The LX50 package **usually includes a USB cable**, along with the unit, power adaptor, and often TouchLink Time Recorder software (e.g. on a 16GB flash drive). If your box did not include a cable, use a standard USB cable that matches the device’s port (check the manual for USB type).

### Step 1: Choose how to connect

| Method | Use when | What you need |
|--------|----------|----------------|
| **USB** | Standard for LX50; device next to the PC | USB cable (included in the box for most packages). LX50 has USB Host and USB Client support. |
| **Ethernet (TCP/IP)** | Only if your LX50 variant has an Ethernet port; device on the office network | Ethernet cable to your network or PC. Not all LX50 units have Ethernet—check your model. |

**USB:** Plug the USB cable (from the LX50 box or a compatible cable) into the LX50 and your PC. Windows may prompt for drivers; use the driver from the ZKTeco software package or CD if needed.

**Ethernet (if your model has it):** Some ZKTeco devices use a **default IP** (e.g. **192.168.1.201**, subnet **255.255.255.0**). Your PC must be on the same network range (e.g. **192.168.1.x**). Check your LX50 manual for its default IP; some models use the device menu: **[COMM.] → [Ethernet] → [IP Address]** to view or change it.

### Step 2: Install ZKTeco software on the PC

Install the management software so the PC can talk to the device and download attendance logs.

1. **Download software** (choose one that supports your model):
   - **TouchLink Time Recorder** – common for time-and-attendance devices like the LX50 (often bundled with the device or from your supplier).
   - **ZKAccess** (e.g. ZKAccess 3.5) – for access control and attendance.
   - **ZKBio Time** – for cloud/time attendance.
   - Get installers from [ZKTeco downloads](https://zkteco.eu/downloads) or your local ZKTeco distributor (e.g. MySolutions for PH).

2. **Prerequisites (TouchLink example):**
   - Windows 7 or later.
   - **.NET Framework** (as required by the installer).
   - **SQL Server LocalDB** (often in the software’s “Prerequisites” folder – install the 32-bit or 64-bit version to match your Windows).

3. **Install:** Run the installer (e.g. `setup.exe` from the TR STD folder). When asked, choose “everyone” for access. Default login is often **Admin** with no password (check the manual).

4. **Drivers (USB):** If the device is not detected over USB, install the USB driver from the same ZKTeco package or from the manufacturer’s support page.

### Step 3: Add the device in the software

1. Open the ZKTeco software (TouchLink / ZKAccess / etc.).
2. **Add device:**
   - **USB:** Select “USB” or “Com” and connect; the software may auto-detect the device.
   - **Network:** Add device by IP (e.g. **192.168.1.201**). Ensure the PC can ping the device (e.g. `ping 192.168.1.201` from Command Prompt).
3. Set the **communication password** if your device uses one (common default is **0** or blank; see device menu or manual).
4. Test the connection (e.g. “Connect” or “Download” in the software). You should see device info and be able to download logs or users.

### Step 4: Register employees and test punches

1. **Add users on the device or in the software:** Each employee should have a **User ID / PIN** that matches **`employees.employee_code`** (digits only — usually **1, 2, 3, …** in hire order after migration). The HR-facing **Company ID no.** (`company_id_no`, e.g. AX-10001) is separate and does not need to match the terminal.
2. Enroll fingerprints (or cards) as per the device menu.
3. Do a test **punch in** and **punch out** on the device.
4. In the ZKTeco software, **download attendance / transaction logs** and confirm the test punches appear with correct time and in/out state.

Once the device is connected, the software can see it, and test punches show in the logs, you are ready to send that data to the payroll app. Continue with **Webhook secret setup** below, then configure your middleware or sync tool to POST to the punch API.

---

## Webhook secret setup (after device is connected)

The punch API (`POST /api/biometric/punch`) requires a **shared secret** so only your device or middleware can send punches. Follow these steps.

### Step 1: Generate a secret

Use a long, random string (at least 32 characters). You can generate one:

**Option A – Terminal (macOS/Linux):**
```bash
openssl rand -base64 32
```
Example output: `K7x9mN2pQ4vR8sT1wY3zA5bC6dE0fG2hJ4kL7mN9pQ=`

**Option B – Node (one-liner):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option C – Any password generator:** Create a 32+ character random string and copy it. Do not use a simple word or date.

Copy the value; you will use it in two places: your app env and your webhook client.

### Step 2: Add the secret to your app

**Local development (`.env.local`):**

1. Open or create `.env.local` in the project root (same folder as `package.json`).
2. Add this line (replace with your actual secret):

```env
BIOMETRIC_WEBHOOK_SECRET=K7x9mN2pQ4vR8sT1wY3zA5bC6dE0fG2hJ4kL7mN9pQ=
```

3. Restart the Next.js dev server so it picks up the new variable (`npm run dev` or `yarn dev`).

**Production (Vercel / other host):**

1. Open your project in Vercel (or your hosting dashboard).
2. Go to **Settings → Environment Variables**.
3. Add a variable:
   - **Name:** `BIOMETRIC_WEBHOOK_SECRET`
   - **Value:** the same secret you generated (paste it, do not share it).
   - **Environment:** Production (and Preview if you test there).
4. Redeploy the app so the new variable is applied.

### Step 3: Use the secret when calling the API

Every request to `POST /api/biometric/punch` must send the secret in a header.

**Header name:** `X-Biometric-Secret`  
**Header value:** the exact same string you put in `BIOMETRIC_WEBHOOK_SECRET`

**Example with cURL:**
```bash
curl -X POST "https://your-app.com/api/biometric/punch" \
  -H "Content-Type: application/json" \
  -H "X-Biometric-Secret: K7x9mN2pQ4vR8sT1wY3zA5bC6dE0fG2hJ4kL7mN9pQ=" \
  -d '{"employee_code":"10001","punched_at":"2026-03-14T08:00:00.000Z","punch_type":"in"}'
```

**Example in middleware / script (Node):**
```js
const secret = process.env.BIOMETRIC_WEBHOOK_SECRET; // Store this in your middleware's env
await fetch("https://your-app.com/api/biometric/punch", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Biometric-Secret": secret,
  },
  body: JSON.stringify({
    employee_code: "10001",
    punched_at: new Date().toISOString(),
    punch_type: "in",
  }),
});
```

If the header is missing or wrong, the API returns **401 Unauthorized**.

### Step 4: Keep the secret safe

- Do **not** commit `.env.local` or the secret value to Git (`.env.local` should be in `.gitignore`).
- Use a **different** secret for local dev and production if you want.
- If the secret is ever exposed, generate a new one and update both the app env and your webhook client.

---

## 1. Office locations (for web and devices)

You can add locations in Supabase and use them for:

- **Web app:** Restrict clock in/out to allowed locations (radius). See [Location Locking Setup](./LOCATION_LOCKING_SETUP.md).
- **Biometric:** Assign a device to a location so punches are tagged with `office_location_id`.

Add locations in Supabase (SQL or Table Editor):

```sql
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters)
VALUES
  ('Main Office', 'Your Address', 14.5547, 121.0244, 1000),
  ('Branch', 'Branch Address', 14.6000, 121.1000, 1000);
```

Run the migration that creates `office_locations` and adds biometric columns to `time_entries`:

- `supabase/migrations/161_biometric_and_office_locations.sql`

## 2. Biometric webhook API

Punches from ZKTeco (or middleware) are sent to:

- **URL:** `POST https://your-app-url/api/biometric/punch`
- **Auth:** Header `X-Biometric-Secret: <your-secret>`. See [Webhook secret setup](./BIOMETRIC_WEBHOOK_SECRET_SETUP.md) for how to generate and configure the secret.

**JSON body (example):**

```json
{
  "employee_code": "10001",
  "punched_at": "2026-03-14T08:00:00.000Z",
  "punch_type": "in",
  "device_serial": "LX50-ABC123",
  "device_name": "Reception LX50",
  "office_location_id": "uuid-of-office-locations-row"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `employee_code` or `pin` or `user_id` | One of these | Matches **`employees.employee_code`** (numeric time clock ID; not `company_id_no`) or UUID for `employee_id`. |
| `punched_at` or `timestamp` | Yes | ISO datetime or `YYYY-MM-DD HH:mm:ss`. |
| `punch_type` | Yes | `"in"` or `"out"`. ZKTeco `state`: 0 = in, 1 = out. |
| `device_serial` | No | Device serial (e.g. LX50 serial). |
| `device_name` | No | Friendly name (e.g. "Reception LX50"). |
| `office_location_id` | No | UUID from `office_locations.id` for this device. |

Response: `200` with `{ ok: true, id, punched_at, punch_type, employee_id }`.

## 3. ZKTeco LX50 integration options

### Option A: ZKBio Time / PUSH middleware

If you use ZKBio Time or a PUSH-capable middleware that can send HTTP POST to your server:

1. Configure the middleware to POST to `https://your-app-url/api/biometric/punch`.
2. Map the middleware payload to our JSON (e.g. map device user PIN to `employee_code`, device serial to `device_serial`, timestamp to `punched_at`, state to `punch_type`).
3. Set `BIOMETRIC_WEBHOOK_SECRET` and send it in the `X-Biometric-Secret` header.

### Option B: Sync script (poll device, then POST)

If the device is polled (e.g. via ZKTeco SDK or TCP):

1. Poll attendance logs (e.g. ATTLOG).
2. For each new record: resolve user PIN to `employee_code` (must match `employees.employee_code`), convert time and state to `punched_at` and `punch_type`, then `POST` to `/api/biometric/punch` with the same JSON and secret header.

### Option C: Third-party (ZKTeco API / StandTech, etc.)

Some services (e.g. ZKTeco cloud, StandTech PUSH SDK) can forward events to a webhook URL. Point that webhook to `https://your-app-url/api/biometric/punch` and adapt their payload to our JSON format in a small proxy if needed.

## 4. Employee code on the device

Ensure each user on the ZKTeco LX50 uses a **numeric PIN** that matches **`employees.employee_code`**. The webhook does not match **`company_id_no`** (Company ID no.); use the time clock / biometric ID on the device.

## 5. Env variable (summary)

| Variable | Where | Purpose |
|----------|--------|---------|
| `BIOMETRIC_WEBHOOK_SECRET` | `.env.local` (local) and host Environment Variables (production) | Secret that must be sent in `X-Biometric-Secret` header when calling `POST /api/biometric/punch`. |

If `BIOMETRIC_WEBHOOK_SECRET` is **not** set, the API accepts requests without the header (use only for local testing). In production, **always** set it and send it in every webhook request.
