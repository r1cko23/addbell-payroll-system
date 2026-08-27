import { NextRequest, NextResponse } from "next/server";
export { dynamic } from "@/lib/api-route-segment";

/** Legacy projects table delete — retired; masterlist jobs are SoT. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      error:
        "Project catalog delete is retired. Manage jobs from Operations → Projects.",
      id: params.id,
    },
    { status: 410 }
  );
}
