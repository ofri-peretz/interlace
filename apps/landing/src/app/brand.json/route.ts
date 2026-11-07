import { getBrand } from "@/lib/brand";

export const revalidate = 86400;

// Public copy contract for every Interlace surface (product sites, READMEs,
// profile workflows): read this instead of hand-typing a tagline or a count.
export async function GET() {
  const brand = await getBrand();
  return Response.json(brand, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
