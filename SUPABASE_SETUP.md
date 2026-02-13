# Supabase Configuration for Addbell

## Current Configuration

Your app is currently configured to use a Supabase instance. The configuration is stored in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://wavweetmtjoxzdirnfva.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## To Use Your Own Supabase Instance

1. **Create a Supabase Project** (if you haven't already):
   - Go to https://supabase.com
   - Sign up or log in
   - Create a new project
   - Wait for the project to be provisioned

2. **Get Your Supabase Credentials**:
   - Go to your project settings
   - Navigate to "API" section
   - Copy your:
     - Project URL
     - `anon` public key
     - `service_role` secret key (keep this secure!)

3. **Update `.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

4. **Run Migrations**:
   After updating your Supabase instance, you need to run the database migrations:
   ```bash
   # If using Supabase CLI locally
   supabase db push
   
   # Or manually run migrations in Supabase Dashboard:
   # 1. Go to SQL Editor in Supabase Dashboard
   # 2. Run migrations in order from supabase/migrations/
   #    - Start with 001_initial_schema.sql
   #    - Then run all numbered migrations in order
   #    - Finally run 152_construction_project_management.sql
   #    - And 153_fund_requests_table.sql
   ```

5. **Update TypeScript Types** (if using Supabase CLI):
   ```bash
   npm run supabase:types
   ```

## Important Notes

- **Never commit `.env.local`** to version control (it's already in `.gitignore`)
- The `SUPABASE_SERVICE_ROLE_KEY` has admin access - keep it secure
- The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose in client-side code
- Make sure your Supabase project has Row Level Security (RLS) enabled for all tables

## Database Migrations

The following migrations need to be run in order:
1. All existing migrations (001-151)
2. `152_construction_project_management.sql` - Project management tables
3. `153_fund_requests_table.sql` - Fund request workflow

## Testing Your Connection

After updating your Supabase credentials, test the connection by:
1. Starting the dev server: `npm run dev`
2. Try logging in or accessing any page
3. Check browser console for any Supabase connection errors
