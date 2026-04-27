import { NextRequest, NextResponse } from "next/server";

type NominatimResponse = {
  display_name?: string;
};

type BigDataCloudResponse = {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  postcode?: string;
};

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = toNumber(searchParams.get("lat"));
  const lng = toNumber(searchParams.get("lng"));

  if (lat == null || lng == null) {
    return NextResponse.json(
      { error: "lat and lng are required query params" },
      { status: 400 }
    );
  }

  try {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    nominatimUrl.searchParams.set("lat", String(lat));
    nominatimUrl.searchParams.set("lon", String(lng));
    nominatimUrl.searchParams.set("format", "jsonv2");
    nominatimUrl.searchParams.set("zoom", "18");
    nominatimUrl.searchParams.set("addressdetails", "1");

    const nominatimRes = await fetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": "addbell-payroll-system/1.0",
        Accept: "application/json",
        "Accept-Language": "en",
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (nominatimRes.ok) {
      const nominatimData = (await nominatimRes.json()) as NominatimResponse;
      if (nominatimData.display_name) {
        return NextResponse.json({
          address: nominatimData.display_name,
        });
      }
    }

    const bdcUrl = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client"
    );
    bdcUrl.searchParams.set("latitude", String(lat));
    bdcUrl.searchParams.set("longitude", String(lng));
    bdcUrl.searchParams.set("localityLanguage", "en");

    const bdcRes = await fetch(bdcUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (bdcRes.ok) {
      const bdcData = (await bdcRes.json()) as BigDataCloudResponse;
      const pieces = [
        bdcData.locality || bdcData.city || null,
        bdcData.principalSubdivision || null,
        bdcData.countryName || null,
      ].filter(Boolean);

      if (pieces.length > 0) {
        return NextResponse.json({
          address: pieces.join(", "),
        });
      }
    }

    return NextResponse.json({
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return NextResponse.json({
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  }
}
