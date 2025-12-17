# Addbell Payroll System - Setup Guide

## 🚀 Complete Setup Instructions

This guide will walk you through setting up and deploying your production-ready payroll system.

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works great)
- Vercel account (free tier works great)
- Git installed

---

## Part 1: Supabase Setup

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new organization (if you don't have one)
4. Click "New Project"
5. Fill in:
   - **Project Name**: `addbell-payroll`
   - **Database Password**: (create a strong password - SAVE THIS!)
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free (sufficient for 5 users + 150 employees)
6. Click "Create new project"
7. Wait 2-3 minutes for project to be ready

### Step 2: Run Database Migration

1. In your Supabase project dashboard, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the ENTIRE contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click **RUN** (bottom right)
6. You should see "Success. No rows returned" ✅

This creates all your tables, security policies, and adds Philippine holidays!

### Step 3: Get API Keys

1. In Supabase dashboard, go to **Settings** > **API**
2. You'll see:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)
3. **SAVE THESE** - you'll need them next!

### Step 4: Create Admin User

1. In Supabase dashboard, go to **Authentication** > **Users**
2. Click "Add user" > "Create new user"
3. Fill in:
   - **Email**: your admin email
   - **Password**: create a secure password
   - **Auto Confirm User**: ✅ CHECK THIS
4. Click "Create user"
5. Go to **SQL Editor** and run this query (replace with your email):

```sql
INSERT INTO public.users (email, full_name, role, is_active)
VALUES ('your-email@example.com', 'Admin Name', 'admin', true);
```

6. Click **RUN**

Now you have an admin account!

---

## Part 2: Local Development Setup

### Step 1: Install Dependencies

```bash
cd /Users/ecko/Desktop/Addbell/Payroll-system-addbell/payroll-app
npm install
```

### Step 2: Configure Environment Variables

1. Create a file named `.env.local` in the project root
2. Add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Replace the values with your actual Supabase URL and key from Part 1, Step 3.

### Step 3: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

### Step 4: Test Login

1. Go to `http://localhost:3000`
2. You'll be redirected to `/login`
3. Use your admin credentials
4. You should see the dashboard! 🎉

---

## Part 3: Deploy to Vercel (Production)

### Step 1: Push to GitHub

1. Create a new GitHub repository
2. Initialize git in your project (if not already):

```bash
cd /Users/ecko/Desktop/Addbell/Payroll-system-addbell/payroll-app
git init
git add .
git commit -m "Initial commit: Addbell Payroll System"
```

3. Connect to your GitHub repo:

```bash
git remote add origin https://github.com/your-username/payroll-system.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Click "Add New" > "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as is)
   - **Build Command**: `npm run build` (default)
   - **Install Command**: `npm install` (default)

### Step 3: Add Environment Variables

In Vercel project settings, add these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Step 4: Deploy!

1. Click "Deploy"
2. Wait 2-3 minutes
3. Your app will be live at `https://your-app.vercel.app`! 🚀

### Step 5: Configure Custom Domain (Optional)

1. In Vercel project, go to **Settings** > **Domains**
2. Add your custom domain
3. Follow DNS instructions
4. Update `NEXT_PUBLIC_APP_URL` in environment variables

---

## Part 4: Initial Data Setup

### Step 1: Create HR Users

1. Log in as admin
2. Go to **Settings** > **Users**
3. Create accounts for your 5 HR staff
4. Assign roles:
   - **Admin**: Can approve payslips, manage users
   - **HR**: Can create employees, enter attendance, generate payslips

### Step 2: Add Employees

1. Go to **Employees** tab
2. Click "Add Employee"
3. Enter:
   - Employee ID (e.g., EMP001)
   - Full Name
   - Rate per Day
   - Rate per Hour
4. Repeat for all ~150 employees

**Tip**: You can import employees via SQL:

```sql
INSERT INTO public.employees (employee_id, full_name, rate_per_day, rate_per_hour, created_by)
VALUES 
  ('EMP001', 'John Doe', 600, 75, (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)),
  ('EMP002', 'Jane Smith', 650, 81.25, (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1));
  -- Add more...
```

### Step 3: Configure Employee Deductions

1. Go to **Deductions** tab
2. Select an employee
3. Set up their weekly deductions:
   - Vale
   - Uniform/PPE
   - SSS Loans
   - Pag-IBIG Loans
4. Set government contributions (for checkbox control in payslip):
   - SSS Contribution
   - PhilHealth Contribution
   - Pag-IBIG Contribution

---

## Part 5: Weekly Workflow

### Monday Morning Routine (Processing Last Week's Payroll)

#### Step 1: Enter Weekly Attendance

1. Go to **Timesheet** tab
2. Select the week (e.g., Nov 5-11, 2025)
3. Select employee
4. For each day, enter:
   - Regular Hours
   - Overtime Hours
   - Night Diff Hours (10PM-6AM)
5. System auto-detects:
   - Sundays
   - Holidays
   - Day type multipliers
6. Click "Save Week"
7. Repeat for all employees

#### Step 2: Generate Payslips

1. Go to **Payslips** tab
2. Click "Generate Payslips"
3. Select week and employees
4. For each payslip:
   - Review calculations
   - Check/uncheck government contributions (3rd/4th week)
   - Add adjustments if needed
   - Add allowance (4th week only)
5. Click "Save as Draft"

#### Step 3: Admin Approval

1. Admin reviews draft payslips
2. Clicks "Approve" on each payslip
3. Status changes to "Approved"

#### Step 4: Print/Export

1. Select approved payslips
2. Click "Print All" or "Export to Excel"
3. Distribute to employees

**Time saved: ~80% vs manual calculations!** ⏱️

---

## Features Overview

### ✅ What You Get

1. **Employee Management**
   - Add/edit/deactivate employees
   - Track rates (per day, per hour)
   - View employee history

2. **Weekly Timesheet Entry**
   - One-screen entry for entire week
   - Auto day-type detection
   - Real-time calculations
   - Quick employee switching

3. **Automatic Calculations**
   - All Philippine labor law formulas
   - Regular, Sunday, Holiday rates
   - Overtime calculations
   - Night differential

4. **Deductions Management**
   - Weekly deductions (Vale, Uniform, Loans)
   - Government contributions (checkbox controlled)
   - Adjustments (+ or -)
   - Allowances (4th week)

5. **Payslip Generation**
   - Complete earnings breakdown
   - Itemized deductions
   - Net pay calculation
   - Print-ready format
   - Export to CSV/Excel

6. **Role-Based Access**
   - Admin: Full access
   - HR: Limited to payroll operations

7. **Audit Trail**
   - Who created/modified what
   - Change history
   - Security logs

---

## Troubleshooting

### Can't Login?

- Check email/password
- Verify user exists in Supabase **Auth** > **Users**
- Verify user exists in `public.users` table
- Check email matches in both places

### "Row Level Security" Error?

- Re-run the migration SQL
- Check RLS policies are enabled
- Verify user has correct role in `public.users`

### Can't See Data?

- Check Supabase connection (green dot in dashboard)
- Verify environment variables in Vercel
- Check browser console for errors

### Deployment Failed?

- Check build logs in Vercel
- Verify all environment variables are set
- Run `npm run build` locally to test

---

## Support & Maintenance

### Database Backups

Supabase automatically backs up your database daily. To manual backup:

1. Go to **Database** > **Backups**
2. Click "Create backup"
3. Download if needed

### Adding New Holidays

```sql
INSERT INTO public.holidays (holiday_date, holiday_name, holiday_type, year)
VALUES ('2026-01-01', 'New Year''s Day', 'regular', 2026);
```

### Monitoring Usage

- **Database**: Check **Reports** in Supabase
- **App**: Check Vercel Analytics
- Free tier limits:
  - Supabase: 500MB database, 5GB bandwidth
  - Vercel: 100GB bandwidth

---

## Security Best Practices

1. ✅ Strong passwords for all users
2. ✅ Enable 2FA in Supabase/Vercel
3. ✅ Regular database backups
4. ✅ Keep environment variables secret
5. ✅ Update dependencies monthly: `npm update`
6. ✅ Review audit logs regularly

---

## Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Vercel Docs**: https://vercel.com/docs

---

## Version Info

- **Version**: 2.0.0
- **Framework**: Next.js 14
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **Last Updated**: November 2025

---

## Congratulations! 🎉

You now have a production-ready payroll system that will save your team hours every week!

**Next Steps:**
1. Train your HR team on the system
2. Enter all employees
3. Configure deductions
4. Start processing weekly payroll

**Questions?** Refer back to this guide or check the troubleshooting section.

