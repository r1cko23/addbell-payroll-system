# Documentation

## Quick Links

### Getting Started
- **[README](../README.md)** - Current project overview & quick start
- **[Legacy README](legacy/CLASSIC_README.md)** - Original static-app documentation
- **[Quickstart](setup/QUICKSTART.md)** - Get up and running fast
- **[Setup Guide](setup/SETUP.md)** - Detailed setup instructions

### Deployment
- **[Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)** - How to deploy
- **[Vercel Fix](deployment/VERCEL_DEPLOYMENT_FIX.md)** - Vercel-specific issues

### Development Guides
- **[Improvement Recommendations](guides/IMPROVEMENT_RECOMMENDATIONS.md)** - Future enhancements
- **[UI Upgrade Guide](guides/UI_UPGRADE_GUIDE.md)** - UI improvements
- **[Minimalistic Design](guides/MINIMALISTIC_DESIGN_GUIDE.md)** - Design principles

### Project Status
- **[Project Status](status/PROJECT_STATUS.md)** - What's built
- **[Complete Summary](status/COMPLETE_SYSTEM_SUMMARY.md)** - System overview
- **[Test Report](status/TEST_REPORT.md)** - Testing results

### Admin Dashboard
- **[What I Just Did](WHAT_I_JUST_DID.md)** - Recent implementation (role-based dashboards)
- **[Admin Dashboard](admin-dashboard/)** - Executive dashboard documentation

---

## Project Structure

```
payroll-app/
├── app/                    # Next.js app pages
│   ├── dashboard/         # Dashboard (role-based)
│   ├── employees/         # Employee management
│   ├── timesheet/         # Weekly attendance
│   ├── payslips/          # Payslip generation
│   └── ...
├── components/            # React components
├── lib/                   # Utilities
│   ├── hooks/            # Custom React hooks
│   └── supabase/         # Supabase clients
├── supabase/             # Database
│   └── migrations/       # SQL migrations
├── utils/                # Helper functions
├── types/                # TypeScript types
└── docs/                 # Documentation (you are here)
```

