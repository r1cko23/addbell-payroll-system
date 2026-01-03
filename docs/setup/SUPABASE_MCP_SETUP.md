# Supabase MCP Setup Guide

This guide explains how to add Supabase Model Context Protocol (MCP) to Cursor, enabling AI assistants to interact directly with your Supabase project.

## What is Supabase MCP?

Supabase MCP allows AI assistants (like Cursor's AI) to:
- Query your Supabase database tables
- Manage database configurations
- Fetch project settings
- Perform database operations through natural language

## Prerequisites

- A Supabase project (hosted or self-hosted)
- Cursor IDE installed
- Access to your Supabase project dashboard

## Setup Steps

### Step 1: Get Your Supabase MCP URL

#### For Hosted Supabase Projects:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API** (or look for **MCP** or **Model Context Protocol** section)
4. Generate or copy your MCP connection URL
   - The URL format is typically: `https://[project-ref].supabase.co/mcp`
   - You may need to enable MCP in your project settings first

#### For Self-Hosted Supabase:

1. Ensure your MCP server is configured and accessible
2. Use your self-hosted URL (e.g., `https://your-domain.com/mcp`)
3. Ensure proper security measures (VPN, SSH tunnel) are in place

### Step 2: Configure MCP in Cursor

#### Method 1: Through Cursor Settings UI

1. Open Cursor
2. Go to **Settings** (Ctrl+, or Cmd+,)
3. Search for "MCP" or "Model Context Protocol"
4. Click **Add MCP Server** or **Configure MCP**
5. Add the following configuration:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://[your-project-ref].supabase.co/mcp",
      "apiKey": "[your-anon-key-or-service-role-key]"
    }
  }
}
```

#### Method 2: Through Configuration File

1. Open Cursor's settings directory:
   - **Windows**: `%APPDATA%\Cursor\User\settings.json`
   - **macOS**: `~/Library/Application Support/Cursor/User/settings.json`
   - **Linux**: `~/.config/Cursor/User/settings.json`

2. Add or update the MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "supabase": {
        "command": "npx",
        "args": [
          "-y",
          "@supabase/mcp-server",
          "--url",
          "https://[your-project-ref].supabase.co",
          "--key",
          "[your-anon-key]"
        ]
      }
    }
  }
}
```

**Alternative Configuration (using URL directly):**

```json
{
  "mcp": {
    "servers": {
      "supabase": {
        "url": "https://[your-project-ref].supabase.co/mcp",
        "headers": {
          "apikey": "[your-anon-key]",
          "Authorization": "Bearer [your-anon-key]"
        }
      }
    }
  }
}
```

### Step 3: Get Your Supabase Credentials

You'll need:
- **Project URL**: Found in Settings → API → Project URL
- **Anon Key**: Found in Settings → API → Project API keys → `anon` `public`
- **Service Role Key** (optional, for admin operations): Found in Settings → API → Project API keys → `service_role` `secret`

⚠️ **Security Note**: 
- Use the `anon` key for most operations (it respects RLS policies)
- Only use `service_role` key if you need to bypass RLS (keep it secure!)

### Step 4: Test the Connection

1. Restart Cursor to apply the MCP configuration
2. In Cursor's chat, try asking:
   - "What tables are in my Supabase database?"
   - "Show me the schema of the employees table"
   - "Query the employees table"

If configured correctly, the AI should be able to interact with your Supabase project.

## Configuration Examples

### Example 1: Using NPX (Recommended)

```json
{
  "mcp": {
    "servers": {
      "supabase": {
        "command": "npx",
        "args": [
          "-y",
          "@supabase/mcp-server",
          "--url",
          "https://abcdefghijklmnop.supabase.co",
          "--key",
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        ]
      }
    }
  }
}
```

### Example 2: Using Direct URL

```json
{
  "mcp": {
    "servers": {
      "supabase": {
        "url": "https://abcdefghijklmnop.supabase.co/mcp",
        "headers": {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        }
      }
    }
  }
}
```

### Example 3: Multiple Supabase Projects

```json
{
  "mcp": {
    "servers": {
      "supabase-production": {
        "command": "npx",
        "args": [
          "-y",
          "@supabase/mcp-server",
          "--url",
          "https://prod-project.supabase.co",
          "--key",
          "[prod-key]"
        ]
      },
      "supabase-staging": {
        "command": "npx",
        "args": [
          "-y",
          "@supabase/mcp-server",
          "--url",
          "https://staging-project.supabase.co",
          "--key",
          "[staging-key]"
        ]
      }
    }
  }
}
```

## Troubleshooting

### MCP Server Not Connecting

1. **Verify your credentials**: Double-check your project URL and API key
2. **Check network**: Ensure you can access your Supabase project URL
3. **Restart Cursor**: MCP configurations require a restart
4. **Check Cursor logs**: Look for MCP-related errors in Cursor's developer console

### Permission Errors

- Ensure you're using the correct API key (anon vs service_role)
- Check your Row Level Security (RLS) policies
- Verify your API key has the necessary permissions

### Self-Hosted Issues

- Ensure MCP endpoint is accessible
- Check firewall and network configurations
- Verify Kong configuration for MCP endpoints
- Use SSH tunnel if accessing remotely

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive credentials when possible
3. **Use anon key** instead of service_role key for most operations
4. **Review RLS policies** to ensure proper data access control
5. **Rotate API keys** regularly

## Additional Resources

- [Supabase MCP GitHub Repository](https://github.com/supabase-community/supabase-mcp)
- [Supabase MCP Documentation](https://supabase.com/docs/guides/mcp)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Cursor MCP Documentation](https://docs.cursor.com/mcp)

## Next Steps

After setting up Supabase MCP, you can:

1. Ask Cursor AI to analyze your database schema
2. Generate queries based on natural language
3. Get help with database migrations
4. Debug RLS policies
5. Optimize database queries

## Quick Reference

**Find your Supabase credentials:**
- Dashboard: https://app.supabase.com
- Settings → API → Project URL
- Settings → API → Project API keys

**Cursor Settings Location:**
- Windows: `%APPDATA%\Cursor\User\settings.json`
- macOS: `~/Library/Application Support/Cursor/User/settings.json`
- Linux: `~/.config/Cursor/User/settings.json`

---

**Note**: MCP configuration format may vary depending on your Cursor version. If the above doesn't work, check Cursor's latest documentation for MCP setup instructions.
