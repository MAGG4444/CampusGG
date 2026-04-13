async function fetchActiveLobbies() {

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 1,
          host: 'lobby1',
          game: 'CS2',
          gameIcon: '🔫',
          gameClass: 'cs2',
          rank: 'Gold Nova III',
          rankIcon: '⭐',
          mode: 'Competitive 5v5',
          slotsOpen: 2,
          slotsTotal: 5,
          region: 'NA-East',
        },
        {
          id: 2,
          host: 'lobby2',
          game: 'Valorant',
          gameIcon: '🎯',
          gameClass: 'val',
          rank: 'Platinum 2',
          rankIcon: '💎',
          mode: 'Ranked',
          slotsOpen: 1,
          slotsTotal: 5,
          region: 'NA-East',
        },
        {
          id: 3,
          host: 'lobby3',
          game: 'League of Legends',
          gameIcon: '⚔️',
          gameClass: 'lol',
          rank: 'Gold I',
          rankIcon: '🏅',
          mode: 'Duo Queue',
          slotsOpen: 1,
          slotsTotal: 2,
          region: 'NA',
        },

      ]);
    }, 600); // Simulated latency
  });
}

async function fetchForumHighlights() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 101,
          tag: 'hot',
          tagLabel: 'content',
          title: 'content',
          excerpt: 'content',
          author: 'content',
          timeAgo: 'content',
          replies: 0,
          views: 0,
        },
        {
          id: 102,
          tag: 'announce',
          tagLabel: 'content',
          title: 'content',
          excerpt: 'content',
          author: 'content',
          timeAgo: 'content',
          replies: 0,
          views: 0,
        },
        {
          id: 103,
          tag: 'discuss',
          tagLabel: 'content',
          title: 'content',
          excerpt: 'content',
          author: 'content',
          timeAgo: 'content',
          replies: 0,
          views: 0,
        },
      ]);
    }, 800); // Simulated latency
  });
}


function renderLobbyCard(lobby) {
  return `
    <article class="lobby-card" id="lobby-${lobby.id}" role="listitem">
      <div class="lobby-card__game-icon lobby-card__game-icon--${lobby.gameClass}">
        ${lobby.gameIcon}
      </div>
      <div class="lobby-card__info">
        <div class="lobby-card__host">${lobby.host}</div>
        <div class="lobby-card__meta">
          <span class="lobby-card__game-tag">${lobby.game}</span>
          <span>·</span>
          <span>${lobby.mode}</span>
          <span>·</span>
          <span class="lobby-card__rank">${lobby.rankIcon} ${lobby.rank}</span>
        </div>
        <div class="lobby-card__slots">
          ${lobby.slotsOpen}/${lobby.slotsTotal} slots open
        </div>
      </div>
      <div class="lobby-card__actions">
        <button class="btn btn--join btn--sm" onclick="handleJoinLobby(${lobby.id})" aria-label="Join ${lobby.host}'s lobby">
          Join
        </button>
      </div>
    </article>
  `;
}

function renderForumCard(post) {
  return `
    <article class="forum-card" id="forum-${post.id}" role="listitem">
      <div class="forum-card__indicator forum-card__indicator--${post.tag}"></div>
      <div class="forum-card__body">
        <span class="forum-card__tag forum-card__tag--${post.tag}">${post.tagLabel}</span>
        <h3 class="forum-card__title">${post.title}</h3>
        <p class="forum-card__excerpt">${post.excerpt}</p>
        <div class="forum-card__footer">
          <span>👤 ${post.author}</span>
          <span>💬 ${post.replies}</span>
          <span>👁 ${post.views}</span>
          <span>🕐 ${post.timeAgo}</span>
        </div>
      </div>
    </article>
  `;
}

function showSkeletons(container, count = 4) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<div class="skeleton" style="height: 80px; margin-bottom: 12px;"></div>`;
  }
  container.innerHTML = html;
}


// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Loads all data and renders the homepage content.
 * Called on DOMContentLoaded.
 */
async function initHomepage() {
  const lobbyContainer = document.getElementById('lobby-feed');
  const forumContainer = document.getElementById('forum-feed');
  const lobbyCount = document.getElementById('lobby-count');

  // Show loading skeletons while data is being fetched
  showSkeletons(lobbyContainer, 5);
  showSkeletons(forumContainer, 5);

  try {
    // --- Fetch lobby data (API call placeholder) ---
    const lobbies = await fetchActiveLobbies();
    lobbyContainer.innerHTML = lobbies.map(renderLobbyCard).join('');
    lobbyCount.textContent = `${lobbies.length} Live`;

    // --- Fetch forum data (API call placeholder) ---
    const posts = await fetchForumHighlights();
    forumContainer.innerHTML = posts.map(renderForumCard).join('');

  } catch (error) {
    console.error('[CampusGG] Failed to load data:', error);
    lobbyContainer.innerHTML = `<p style="color: var(--accent-red); padding: 1rem;">Failed to load lobbies. Please try again later.</p>`;
    forumContainer.innerHTML = `<p style="color: var(--accent-red); padding: 1rem;">Failed to load forum posts. Please try again later.</p>`;
  }
}


// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * Handles a user clicking the 'Join' button on a lobby card.
 * @param {number} lobbyId - The ID of the lobby to join
 */
function handleJoinLobby(lobbyId) {
  // TODO: Replace with real join-lobby API call
  // Example:
  //   await fetch(`/api/lobbies/${lobbyId}/join`, { method: 'POST' });

  const card = document.getElementById(`lobby-${lobbyId}`);
  const btn = card?.querySelector('.btn--join');
  if (btn) {
    btn.textContent = 'Joined ✓';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'default';
  }
  console.log(`[CampusGG] User joined lobby #${lobbyId}`);
}

/**
 * Handles CTA button clicks (e.g., 'Find a Match').
 */
function handleFindMatch() {
  // TODO: Route to matchmaking page
  alert('Matchmaking coming soon! 🎮');
}

/**
 * Handles Navbar login button click.
 */
function handleLogin() {
  // TODO: Redirect to authentication / .edu verification
  alert('Purdue SSO login coming soon! 🔐');
}


// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', initHomepage);
