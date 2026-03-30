// lib/tmdb.js
// Fetch trending movies from TMDB

export class TMDBFetcher {
    static async fetchTrendingMovies(apiKey, lang = 'th-TH') {
        if (!apiKey) throw new Error('กรุณาเซฟ TMDB API Key ในหน้า Settings ก่อนใช้งาน');
        
        const url = `https://api.themoviedb.org/3/trending/movie/day?api_key=${apiKey}&language=${lang}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`TMDB Error: ${response.status}`);
            
            const data = await response.json();
            return data.results.slice(0, 10).map(movie => ({
                id: 'tmdb_' + movie.id,
                keyword: 'รีวิวหนัง',
                traffic: movie.vote_average.toFixed(1) + ' ⭐',
                image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                newsTitle: movie.title,
                newsSnippet: movie.overview,
                newsSource: 'TMDB Trending',
                newsUrl: `https://www.themoviedb.org/movie/${movie.id}`
            }));
        } catch (error) {
            console.error('[TMDBFetcher] Error:', error);
            throw error;
        }
    }
}
