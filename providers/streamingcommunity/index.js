const BASE_URL = "https://streamingunity.vip";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default {
  id: "provider.streamingcommunity",
  name: "StreamingCommunity",
  types: ["movie", "tv"],

  async getStreams(item) {
    const streams = [];
    const query = item.title || item.name;
    if (!query) return streams;

    try {
      // 1. Sessione Inertia iniziale
      const archiveRes = await fetch(`${BASE_URL}/it/archive`, {
        headers: { "User-Agent": USER_AGENT }
      });
      const cookieHeader = archiveRes.headers.get("set-cookie") || "";
      const archiveHtml = await archiveRes.text();
      
      const vMatch = archiveHtml.match(/"version":"([^"]+)"/);
      const inertiaVersion = vMatch ? vMatch[1] : "";

      // 2. Ricerca del titolo
      const searchRes = await fetch(`${BASE_URL}/it/search?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": USER_AGENT,
          "Cookie": cookieHeader,
          "X-Inertia": "true",
          "X-Inertia-Version": inertiaVersion,
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      const searchData = await searchRes.json();
      const results = searchData?.props?.titles || [];
      const match = results[0];

      if (!match) return streams;

      // 3. Risoluzione Film o Serie
      let iframeUrl = "";
      if (item.type === "movie") {
        iframeUrl = `${BASE_URL}/iframe/${match.id}&canPlayFHD=1`;
      } else {
        const season = item.season || 1;
        const episode = item.episode || 1;

        const seasonRes = await fetch(`${BASE_URL}/it/titles/${match.id}-${match.slug}/season-${season}`, {
          headers: {
            "User-Agent": USER_AGENT,
            "Cookie": cookieHeader,
            "X-Inertia": "true",
            "X-Inertia-Version": inertiaVersion,
            "X-Requested-With": "XMLHttpRequest"
          }
        });
        const seasonData = await seasonRes.json();
        const eps = seasonData?.props?.loadedSeason?.episodes || [];
        const epMatch = eps.find(e => e.number === Number(episode));
        if (!epMatch) return streams;

        iframeUrl = `${BASE_URL}/iframe/${match.id}?episode_id=${epMatch.id}&canPlayFHD=1`;
      }

      // 4. Estrazione video da player iframe
      const ifrRes = await fetch(iframeUrl, {
        headers: { "User-Agent": USER_AGENT, "Cookie": cookieHeader }
      });
      const ifrText = await ifrRes.text();
      const embedSrcMatch = ifrText.match(/<iframe[^>]+src="([^">]+)"/i);

      if (embedSrcMatch && embedSrcMatch[1]) {
        const playerRes = await fetch(embedSrcMatch[1], {
          headers: { "User-Agent": USER_AGENT, "Referer": BASE_URL }
        });
        const playerHtml = await playerRes.text();
        const m3u8Match = playerHtml.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/i);

        if (m3u8Match) {
          streams.push({
            name: "StreamingCommunity",
            title: `${query} - 1080p [IT]`,
            url: m3u8Match[1],
            headers: { "Referer": BASE_URL }
          });
        }
      }

      // Fallback VixSrc
      const tmdbId = item.tmdbId || item.imdbId;
      if (tmdbId) {
        const vixUrl = item.type === "movie"
          ? `https://vixsrc.to/movie/${tmdbId}`
          : `https://vixsrc.to/tv/${tmdbId}/${item.season || 1}/${item.episode || 1}`;
        
        streams.push({
          name: "VixSrc Mirror",
          title: `${query} [IT]`,
          url: vixUrl
        });
      }

    } catch (e) {
      console.error("Errore recupero stream:", e);
    }

    return streams;
  }
};
