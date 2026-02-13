/**
 * Seed test data for Clients, Vendors, and Projects.
 * Uses .env.local - run: node scripts/seed-test-data.js
 */
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function seed() {
  console.log("Seeding test data (using your .env.local Supabase project)...\n");

  // 1. Clients - upsert on client_code
  const { error: ce } = await supabase.from("clients").upsert([
    { name: "Pick Up Coffee", client_code: "PUC", client_name: "Pick Up Coffee", contact_person: "John Martin Tria", contact_email: "john.tria@pickupcoffee.com", contact_phone: "09171234567", address: "One Ayala, Makati City", notes: "Coffee chain - interior fit-out projects", is_active: true },
    { name: "San Miguel Corporation", client_code: "SMC", client_name: "San Miguel Corporation", contact_person: "Maria Santos", contact_email: "maria.santos@sanmiguel.com", contact_phone: "02-81234567", address: "40 San Miguel Ave, Mandaluyong", notes: "Commercial construction partner", is_active: true },
    { name: "Ayala Land Inc", client_code: "AYL", client_name: "Ayala Land Inc", contact_person: "Carlos Reyes", contact_email: "carlos.reyes@ayalaland.com", contact_phone: "02-75501234", address: "Makati Avenue, Makati City", notes: "Property developer - multiple projects", is_active: true },
  ], { onConflict: "client_code" });
  if (ce) {
    console.error("Clients error:", ce.message);
    process.exit(1);
  }
  console.log("Clients: PUC, SMC, AYL");

  // 2. Vendors - insert (ignore if duplicates by name)
  const { data: vendCheck } = await supabase.from("vendors").select("id").eq("name", "AIRT ENGINEERING SERVICES").limit(1);
  if (!vendCheck?.length) {
    const { error: ve } = await supabase.from("vendors").insert([
      { name: "AIRT ENGINEERING SERVICES", tin: "293 128 460 000000", address: "BLK 6 LOT 26 LONDON ST. VILLA OLYMPIA 1 BRGY. MAHARLIKA SAN PEDRO, LAGUNA", phone: "Mobile: 09063223449", email: "airt.engineeringservices@gmail.com", is_active: true },
      { name: "ACE HARDWARE PHILIPPINES", tin: "123 456 789 000000", address: "123 Commerce Ave, Ortigas Center, Pasig City", phone: "02-86341234", email: "procurement@acehardware.com.ph", is_active: true },
      { name: "CEMEX PHILIPPINES", tin: "987 654 321 000000", address: "Cemex Bldg, Merville, Paranaque City", phone: "02-87761234", email: "sales@cemex.com.ph", is_active: true },
      { name: "STEELCRAFT FABRICATORS INC", tin: "456 789 123 000000", address: "Industrial Rd, Valenzuela City", phone: "02-83567890", email: "orders@steelcraft.ph", is_active: true },
      { name: "ELECPRO ELECTRICAL SUPPLY", tin: "111 222 333 000000", address: "78 Circuit St, Quezon City", phone: "02-83712345", email: "info@elecpro.ph", is_active: true },
    ]);
    if (ve) {
      console.error("Vendors error:", ve.message);
      process.exit(1);
    }
    console.log("Vendors: 5 inserted");
  } else {
    console.log("Vendors: already exist");
  }

  // 3. Projects - need client ids
  const { data: clientRows } = await supabase.from("clients").select("id, client_code").in("client_code", ["PUC", "SMC", "AYL"]);
  const clientMap = Object.fromEntries((clientRows || []).map((c) => [c.client_code, c.id]));

  const { data: projCheck } = await supabase.from("projects").select("id").eq("project_code", "PUCFB").limit(1);
  if (!projCheck?.length && clientMap.PUC && clientMap.SMC && clientMap.AYL) {
    const { error: pe } = await supabase.from("projects").insert([
      { name: "Pick Up Coffee Filipino Building", project_code: "PUCFB", project_name: "Pick Up Coffee Filipino Building", client_id: clientMap.PUC, project_location: "PUC One Ayala, Makati City", deliver_to: "Pickup Coffee In Line Store - One Ayala Makati City", project_type: "renovation", project_sector: "commercial", start_date: "2026-01-15", target_end_date: "2026-06-30", project_status: "ongoing", progress_percentage: 25, budget_amount: 5000000, contract_amount: 4800000, description: "Interior renovation and fit-out for Pickup Coffee store at One Ayala", is_active: true },
      { name: "SMC Warehouse Extension", project_code: "SMC-WH", project_name: "SMC Warehouse Extension", client_id: clientMap.SMC, project_location: "40 San Miguel Ave, Mandaluyong", deliver_to: "SMC Logistics Center, Mandaluyong", project_type: "addition", project_sector: "industrial", start_date: "2026-02-01", target_end_date: "2026-09-15", project_status: "planning", progress_percentage: 0, budget_amount: 15000000, contract_amount: 14200000, description: "Warehouse extension - structural and MEP", is_active: true },
      { name: "Ayala Mall Retail Unit", project_code: "AYL-RET", project_name: "Ayala Mall Retail Unit", client_id: clientMap.AYL, project_location: "Greenbelt, Makati City", deliver_to: "Greenbelt 3, Makati City", project_type: "interior_fitout", project_sector: "commercial", start_date: "2026-01-01", target_end_date: "2026-04-30", project_status: "ongoing", progress_percentage: 60, budget_amount: 3000000, contract_amount: 2850000, description: "Retail unit interior fit-out", is_active: true },
    ]);
    if (pe) {
      console.error("Projects error:", pe.message);
      process.exit(1);
    }
    console.log("Projects: PUCFB, SMC-WH, AYL-RET");

    // 4. Project-Vendor links
    const { data: projRows } = await supabase.from("projects").select("id, project_code").in("project_code", ["PUCFB", "SMC-WH", "AYL-RET"]);
    const { data: vendRows } = await supabase.from("vendors").select("id, name").in("name", ["AIRT ENGINEERING SERVICES", "ACE HARDWARE PHILIPPINES", "CEMEX PHILIPPINES", "STEELCRAFT FABRICATORS INC", "ELECPRO ELECTRICAL SUPPLY"]);
    const projMap = Object.fromEntries((projRows || []).map((p) => [p.project_code, p.id]));
    const vendMap = Object.fromEntries((vendRows || []).map((v) => [v.name, v.id]));
    const links = [
      { project_id: projMap.PUCFB, vendor_id: vendMap["AIRT ENGINEERING SERVICES"] },
      { project_id: projMap.PUCFB, vendor_id: vendMap["ACE HARDWARE PHILIPPINES"] },
      { project_id: projMap["SMC-WH"], vendor_id: vendMap["CEMEX PHILIPPINES"] },
      { project_id: projMap["SMC-WH"], vendor_id: vendMap["STEELCRAFT FABRICATORS INC"] },
      { project_id: projMap["AYL-RET"], vendor_id: vendMap["ELECPRO ELECTRICAL SUPPLY"] },
      { project_id: projMap["AYL-RET"], vendor_id: vendMap["AIRT ENGINEERING SERVICES"] },
    ].filter((l) => l.project_id && l.vendor_id);
    for (const link of links) {
      await supabase.from("project_vendors").upsert(link, { onConflict: "project_id,vendor_id" });
    }
    console.log("Project-vendor links created");
  } else {
    console.log("Projects: already exist or clients missing");
  }

  console.log("\nDone. Refresh Clients, Vendors, and Projects pages in the app.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});