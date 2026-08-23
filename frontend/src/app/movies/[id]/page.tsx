import { MovieDetailClient } from '@/components/movie/movie-detail-client';
import { API_URL } from '@/lib/constants';

async function getMovie(id: string) {
  try {
    const res = await fetch(`${API_URL}/movies/${id}`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch (error) {
    return null;
  }
}

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie = await getMovie(id);

  return <MovieDetailClient id={id} initialMovie={movie} />;
}
