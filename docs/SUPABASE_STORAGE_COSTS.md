# Supabase Storage Costs for Profile Pictures

## Overview

Supabase Storage is built on top of S3-compatible storage, which means you do incur costs, but they are typically very low for small files like profile pictures.

## Cost Structure

### Free Tier (Supabase Free Plan)

- **Storage**: 1 GB free
- **Bandwidth**: 2 GB/month free
- **File Operations**: Unlimited

### Paid Plans

- **Storage**: ~$0.021 per GB/month (very cheap)
- **Bandwidth**: ~$0.09 per GB (outbound data transfer)
- **File Operations**: Usually included

## Profile Picture Cost Calculation

### Example Scenario:

- **File Size**: ~80 KB per profile picture (after compression)
- **Number of Employees**: 100 employees
- **Total Storage**: 100 × 80 KB = 8 MB = 0.008 GB
- **Monthly Storage Cost**: 0.008 GB × $0.021 = **$0.00017/month** (essentially free)

### Bandwidth Costs (When Pictures are Loaded)

- Each time a profile picture is loaded, it counts as bandwidth
- **Example**: 100 employees viewing profiles 10 times/month = 1,000 loads
- **Bandwidth**: 1,000 × 80 KB = 80 MB = 0.08 GB
- **Monthly Bandwidth Cost**: 0.08 GB × $0.09 = **$0.0072/month** (less than 1 cent)

### Bandwidth Costs for Pages with Multiple Pictures

When profile pictures are displayed on pages like:

- **Time Entries**: Shows multiple employees per page (e.g., 20-50 entries)
- **Employee Directory**: Lists all employees (e.g., 100+ employees)
- **Dashboard Overview**: Shows recent entries and clocked-in employees
- **Approval Pages**: Shows multiple requests with employee pictures

**Real-World Scenario:**

- **Page Views**: 1,000 page loads/month (across all pages)
- **Average Pictures per Page**: 25 profile pictures per page
- **Total Picture Loads**: 1,000 × 25 = 25,000 loads/month
- **Bandwidth**: 25,000 × 80 KB = 2,000 MB = 2 GB
- **Monthly Bandwidth Cost**: 2 GB × $0.09 = **$0.18/month** (less than 20 cents)

**With Browser Caching:**

- Modern browsers cache images, so repeat visits don't reload pictures
- **Effective Bandwidth**: ~50% reduction with caching = 1 GB/month
- **Monthly Bandwidth Cost**: 1 GB × $0.09 = **$0.09/month** (less than 10 cents)

**Supabase CDN Benefits:**

- Supabase uses Cloudflare CDN, which caches images globally
- Reduces bandwidth costs significantly
- Images served from edge locations (faster + cheaper)

## Why Clean Up Old Files Matters

### Cost Impact of Duplicates:

- **Without cleanup**: 100 employees × 3 duplicate files = 300 files = 24 MB
- **With cleanup**: 100 employees × 1 file = 100 files = 8 MB
- **Savings**: 16 MB storage + reduced bandwidth

### Best Practices:

1. ✅ **Delete old files** when users upload new pictures (implemented)
2. ✅ **Clean up duplicates** periodically (cleanup script provided)
3. ✅ **Compress images** to keep file sizes small (already implemented - 100KB limit)
4. ✅ **Use CDN caching** to reduce bandwidth (Supabase handles this automatically)

## Monitoring Costs

### Check Your Usage:

1. Go to Supabase Dashboard → Settings → Usage
2. Monitor Storage and Bandwidth metrics
3. Set up alerts if usage exceeds thresholds

### Estimate Your Costs:

- **Storage**: (Total GB) × $0.021/month
- **Bandwidth**: (GB transferred/month) × $0.09

## Conclusion

For a typical payroll system with profile pictures:

- **Storage costs**: Negligible (less than $0.01/month for hundreds of employees)
- **Bandwidth costs**: Very low ($0.09-$0.18/month for normal usage with multiple page loads)
- **Total**: Well within free tier limits for most small-to-medium businesses

### Key Takeaways:

1. **Browser Caching**: Reduces bandwidth by ~50% on repeat visits
2. **CDN Caching**: Supabase's Cloudflare CDN further reduces costs and improves speed
3. **Small File Sizes**: 100KB limit keeps costs minimal
4. **Free Tier**: Most small businesses stay within the 2 GB/month free bandwidth limit

### Cost Breakdown for Typical Usage:

| Scenario                        | Page Loads/Month | Pictures/Page | Bandwidth | Cost/Month |
| ------------------------------- | ---------------- | ------------- | --------- | ---------- |
| Small Business (50 employees)   | 500              | 20            | ~0.8 GB   | $0.07      |
| Medium Business (200 employees) | 2,000            | 30            | ~4.8 GB   | $0.43      |
| Large Business (500 employees)  | 5,000            | 50            | ~20 GB    | $1.80      |

**Note**: With browser and CDN caching, actual costs are typically 30-50% lower.

The main reason to clean up duplicates is:

1. **Organization** - Keep storage clean and manageable
2. **Performance** - Faster file listings and operations
3. **Cost efficiency** - Even small savings add up over time
4. **Best practices** - Proper resource management
