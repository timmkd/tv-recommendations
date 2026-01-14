import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to shows page with default filters: watchlist + unrated, sorted by predicted rating
  redirect('/shows?status=watchlist&unrated=true&sort=predicted');
}
