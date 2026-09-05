// Provider StreamingCommunity per Nuvio
const BASE_URL = "https://streamingunity.vip";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getStreamLinks({ title, year, type, season, episode, tmdbId }) {
  const streams = [];

  try {
    // 1. Sessione e cookie Inertia
    const archiveRes = await fetch(`${BASE_URL}/it/archive`, {
      headers: { "User-Agent": USER_AGENT }
    });
    const setCookie = archiveRes.headers.get("set-cookie") || "";
    const htmlText = await archiveRes.text();
    
    // Estrae la versione Inertia dall'HTML
    const versionMatch = htmlText.match(/"version":"([^"]+)"/);
    const inertiaVersion = versionMatch ? versionMatch[1] : "";

    // 2. Ricerca del titolo
    const searchUrl = `${BASE_URL}/it/search?q=${encodeURIComponent(title)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Cookie": setCookie,
        "X-Inertia": "true",
        "X-Inertia-Version": inertiaVersion,
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    const searchData = await searchRes.json();
    const results = searchData?.props?.titles || [];
    const item = results[0];

    if (!item) return streams;

    // 3. Risoluzione stream per Film o Serie
    let iframeUrl = "";
    if (type === "movie") {
      iframeUrl = `${BASE_URL}/iframe/${item.id}&canPlayFHD=1`;
    } else {
      const seasonRes = await fetch(`${BASE_URL}/it/titles/${item.id}-${item.slug}/season-${season}`, {
        headers: {
          "User-Agent": USER_AGENT,
          "Cookie": setCookie,
          "X-Inertia": "true",
          "X-Inertia-Version": inertiaVersion,
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      const seasonData = await seasonRes.json();
      const episodes = seasonData?.props?.loadedSeason?.episodes || [];
      const currentEp = episodes.find(e => e.number === Number(episode));
      if (!currentEp) return streams;

      iframeUrl = `${BASE_URL}/iframe/${item.id}?episode_id=${currentEp.id}&canPlayFHD=1`;
    }

    // 4. Estrazione video da player iframe
    const iframeRes = await fetch(iframeUrl, {
      headers: { "User-Agent": USER_AGENT, "Cookie": setCookie }
    });
    const iframeHtml = await iframeRes.text();
    const embedSrcMatch = iframeHtml.match(/<iframe[^>]+src="([^">]+)"/i);

    if (embedSrcMatch && embedSrcMatch[1]) {
      const playerRes = await fetch(embedSrcMatch[1], {
        headers: { "User-Agent": USER_AGENT, "Referer": BASE_URL }
      });
      const playerHtml = await playerRes.text();
      const m3u8Match = playerHtml.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/i);

      if (m3u8Match) {
        streams.push({
          name: "StreamingCommunity",
          title: `${title} - 1080p [IT]`,
          url: m3u8Match[1],
          quality: "1080p",
          headers: { "Referer": BASE_URL }
        });
      }
    }

    // Mirror alternativo VixSrc
    if (tmdbId) {
      const vixUrl = type === "movie"
        ? `https://vixsrc.to/movie/${tmdbId}`
        : `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`;
      
      streams.push({
        name: "VixSrc Mirror",
        title: `${title} - Multi [IT]`,
        url: vixUrl,
        quality: "Auto"
      });
    }

  } catch (err) {
    console.error("Errore scraper:", err);
  }

  return streams;
}

export default { getStreamLinks };