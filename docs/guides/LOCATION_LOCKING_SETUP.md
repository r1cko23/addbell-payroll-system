# 📍 Location Locking Setup Guide

## Overview
Location locking restricts clock in/out to specific office locations within a configurable radius (default: **1 kilometer**).

## Setup Steps

### 1. Run the Migration
Execute the migration file in Supabase SQL Editor:
```sql
-- File: supabase/migrations/010_location_locking.sql
```

### 2. Configure Your Office Location

#### Find Your Office Coordinates:
1. Go to [Google Maps](https://www.google.com/maps)
2. Search for your office address
3. Right-click on the exact location → "What's here?"
4. Copy the coordinates (latitude, longitude)

#### Update Office Location:
Run this SQL in Supabase SQL Editor, replacing with your actual coordinates:

```sql
-- Update existing location or insert new one
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters)
VALUES (
  'Main Office',
  'Your Office Address Here',
  14.5547,  -- Replace with your actual latitude
  121.0244, -- Replace with your actual longitude
  1000      -- 1000 meters = 1 kilometer radius
)
ON CONFLICT (id) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  radius_meters = EXCLUDED.radius_meters;
```

### 3. Add Multiple Locations (Optional)

If you have multiple office locations:

```sql
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters)
VALUES 
  ('Main Office', 'Address 1', 14.5547, 121.0244, 1000),
  ('Branch Office', 'Address 2', 14.6000, 121.1000, 1000),
  ('Warehouse', 'Address 3', 14.5000, 121.0000, 1000);
```

### 4. Adjust Radius Per Location

You can set different radius for each location:

```sql
-- Update radius for a specific location
UPDATE public.office_locations
SET radius_meters = 500  -- 500 meters
WHERE name = 'Main Office';
```

## How It Works

### Employee Portal:
- ✅ **Location Valid**: Shows green checkmark with office name and distance
- 🚫 **Location Invalid**: Shows red warning, buttons disabled
- Employees **cannot** clock in/out if outside the allowed radius

### HR Clock Page:
- ⚠️ Shows warning if outside radius but allows override (for manual entries)
- HR can still proceed with confirmation

## Radius Options

| Radius | Use Case |
|--------|----------|
| 100m | Very strict (small office) |
| 500m | Standard office building |
| **1000m** | **Default - 1 kilometer** |
| 2000m | Large campus/compound |

## Testing

1. **Test from Office**: Should show ✅ "At Main Office"
2. **Test from Home**: Should show 🚫 "Location Not Allowed"
3. **Check Distance**: UI shows distance in meters

## Disable Location Locking

To temporarily disable (allow all locations):

```sql
UPDATE public.office_locations
SET is_active = false;
```

To re-enable:

```sql
UPDATE public.office_locations
SET is_active = true;
```

## View Current Locations

```sql
SELECT 
  name,
  address,
  latitude,
  longitude,
  radius_meters,
  is_active
FROM public.office_locations
ORDER BY created_at;
```
