import { redirect } from "next/navigation";

export default async function SearchResultPage({ searchParams }) {
  const params = await searchParams;
  const query = params?.q ? `?q=${encodeURIComponent(params.q)}` : "";
  redirect(`/home/search${query}`);
}
