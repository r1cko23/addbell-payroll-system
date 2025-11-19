# ⚡ Quick Start Guide

## 🎯 Get Running in 30 Minutes!

This is the **TL;DR version**. For detailed instructions, see [SETUP.md](./SETUP.md).

---

## Step 1: Supabase Setup (10 min)

### A. Create Project
1. Go to [supabase.com](https://supabase.com) → Sign up/Login
2. Click "New Project"
3. Name: `addbell-payroll`
4. Create strong database password → **SAVE IT!**
5. Choose region → Create
6. Wait 2-3 minutes ☕

### B. Run Migration
1. In Supabase → **SQL Editor**
2. Copy ALL of `supabase/migrations/001_initial_schema.sql`
3. Paste → Click **RUN**
4. Should see "Success" ✅

### C. Get API Keys
1. **Settings** → **API**
2. Copy:
   - Project URL
   - anon public key
3. **SAVE THESE!** 📝

### D. Create Admin User
1. **Authentication** → **Users** → "Add user"
2. Enter email/password → Check "Auto Confirm"
3. Go to **SQL Editor** → Run:
```sql
INSERT INTO public.users (email, full_name, role)
VALUES ('your-email@example.com', 'Your Name', 'admin');
```

---

## Step 2: Local Setup (5 min)

```bash
# Navigate to project
cd /Users/ecko/Desktop/Addbell/Payroll-system-addbell/payroll-app

# Install dependencies
npm install

# Create environment file
touch .env.local

# Add to .env.local:
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → Login with your admin account! 🎉

---

## Step 3: Deploy to Vercel (10 min)

### A. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### B. Deploy
1. Go to [vercel.com](https://vercel.com) → Import repo
2. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```
3. Click **Deploy**
4. Wait 2-3 minutes → Live! 🚀

---

## Step 4: Initial Data (5 min)

### A. Create HR Users
Login as admin → **Settings** → Add users with role "hr"

### B. Add Employees
Go to **Employees** → Add your 150 employees
- Employee ID
- Full Name
- Rate/Day
- Rate/Hour

**Bulk Import**: Use SQL Editor:
```sql
INSERT INTO public.employees (employee_id, full_name, rate_per_day, rate_per_hour, created_by)
VALUES 
  ('EMP001', 'John Doe', 600, 75, (SELECT id FROM users WHERE role='admin' LIMIT 1)),
  ('EMP002', 'Jane Smith', 650, 81.25, (SELECT id FROM users WHERE role='admin' LIMIT 1));
```

### C. Configure Deductions
**Deductions** tab → Set up weekly deductions and government contributions for each employee

---

## 📅 Weekly Workflow

### Every Monday Morning:

```
1. Timesheet Tab
   - Select week
   - Select employee  
   - Enter hours for each day
   - System auto-calculates
   - Save & repeat

2. Payslips Tab
   - Generate Weekly Payslips
   - Check government contributions (3rd/4th week)
   - Add adjustments
   - Add allowance (4th week)
   - Save as draft

3. Admin Approval
   - Review drafts
   - Approve all

4. Print/Export
   - Print All or Export Excel
   - Distribute to employees
```

**Total Time: ~30 minutes for 150 employees!** ⏱️

---

## 🎯 Key Features You Get

✅ Weekly timesheet entry (one screen for entire week)  
✅ Auto day-type detection (Sunday, holidays)  
✅ Real-time calculations (all PH labor law formulas)  
✅ Smart deductions (weekly + checkbox for monthly)  
✅ Adjustments from previous week  
✅ Allowances on 4th week  
✅ Role-based access (Admin + HR)  
✅ Print/export payslips  
✅ Audit trail  
✅ Cloud-based (access anywhere)  

---

## 🆘 Troubleshooting

**Can't login?**
→ Check user exists in both Supabase Auth AND public.users table

**RLS errors?**
→ Re-run migration SQL

**Build fails?**
→ Check environment variables are set

**Need detailed help?**
→ See [SETUP.md](./SETUP.md)

---

## 📞 What You Need

**Before Starting:**
- [ ] Supabase account (free)
- [ ] Vercel account (free)
- [ ] GitHub account (free)
- [ ] Node.js 18+ installed
- [ ] 30-45 minutes of time

**Costs:**
- Supabase: **FREE** (up to 500MB database)
- Vercel: **FREE** (100GB bandwidth)
- **Total: ₱0/month!** 🎉

---

## 🎓 Training Your Team

**Time needed**: 15-20 minutes per person

**Show them:**
1. How to login
2. Timesheet entry (main feature)
3. Payslip generation
4. Printing/exporting

**That's it!** System is intuitive. 👍

---

## ✅ You're Ready!

Your payroll system is now:
- ✅ Deployed to cloud
- ✅ Multi-user ready
- ✅ Secure & scalable
- ✅ Saving you 80% time

**Next**: Add your employees and start processing payroll! 🚀

---

**Questions?** See detailed [SETUP.md](./SETUP.md) or check [README_V2.md](./README_V2.md) for features.

