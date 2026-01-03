# GP-HRIS Documentation

## Quick Links

| Document                                       | Description                 |
| ---------------------------------------------- | --------------------------- |
| [QUICKSTART](./setup/QUICKSTART.md)            | Get started in 10 minutes   |
| [SETUP](./setup/SETUP.md)                      | Full setup guide            |
| [DEPLOYMENT](./deployment/DEPLOYMENT_GUIDE.md) | Deploy to production        |
| [PRIVACY COMPLIANCE](./privacy/README.md)      | Data Privacy Act compliance |

---

## Documentation Structure

```
docs/
├── architecture/
│   └── MODULAR_ARCHITECTURE.md    # Modular monolithic guide
├── deployment/
│   ├── DEPLOYMENT_GUIDE.md        # Full deployment guide
│   └── VERCEL_DEPLOYMENT_FIX.md   # Vercel-specific fixes
├── guides/
│   ├── IMPLEMENTATION_SUMMARY.md  # Feature implementation notes
│   ├── LOCATION_LOCKING_SETUP.md  # GPS location setup
│   ├── PAYROLL_BEST_PRACTICES.md  # PH payroll calculations
│   └── RLS_SECURITY_GUIDE.md      # Supabase RLS policies
├── privacy/
│   ├── DATA_PRIVACY_MANUAL.md     # Data Privacy Manual (for NPCRS)
│   ├── PRIVACY_NOTICE.md          # Privacy Notice
│   ├── NPCRS_SUBMISSION_GUIDE.md  # Submission guide
│   └── README.md                   # Privacy docs index
├── setup/
│   ├── QUICKSTART.md              # Quick start guide
│   ├── SETUP.md                   # Full setup instructions
│   └── SUPABASE_MCP_SETUP.md      # MCP configuration
├── status/
│   └── PROJECT_STATUS.md          # Current project status
├── ROLE_ACCESS_MATRIX.md          # Role-based access control
└── ROLE_ACCESS_QUICK_REFERENCE.md # Quick access reference
```

---

## Key Topics

### 🚀 Getting Started

- [Quickstart Guide](./setup/QUICKSTART.md) - 10 minute setup
- [Full Setup Guide](./setup/SETUP.md) - Complete instructions
- [Supabase MCP Setup](./setup/SUPABASE_MCP_SETUP.md) - AI integration

### 📦 Architecture

- [Modular Architecture](./architecture/MODULAR_ARCHITECTURE.md) - Code organization

### 💰 Payroll

- [Payroll Best Practices](./guides/PAYROLL_BEST_PRACTICES.md) - PH labor law calculations

### 🔒 Security

- [RLS Security Guide](./guides/RLS_SECURITY_GUIDE.md) - Row-level security
- [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) - Access control documentation

### 🔐 Privacy & Compliance

- [Privacy Compliance](./privacy/README.md) - Data Privacy Act (RA 10173) compliance
- [Data Privacy Manual](./privacy/DATA_PRIVACY_MANUAL.md) - Complete manual for NPCRS submission

### 🚢 Deployment

- [Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md) - Production deployment
- [Vercel Fixes](./deployment/VERCEL_DEPLOYMENT_FIX.md) - Common issues