// ============================================================
// Wedding RSVP — Cloudflare Worker (Notion API proxy)
// ============================================================
// Deploy: npx wrangler deploy
//
// Required secrets (set via `npx wrangler secret put <NAME>`):
//   NOTION_API_KEY    — your Notion integration token
//
// Required env vars (set in wrangler.toml):
//   NOTION_DATABASE_ID — your guest list database ID
//   ALLOWED_ORIGIN     — your wedding website domain (for CORS)
// ============================================================

// wrangler.toml example:
// name = "wedding-rsvp"
// main = "worker.js"
// compatibility_date = "2024-01-01"
// [vars]
// NOTION_DATABASE_ID = "your-database-id-here"
// ALLOWED_ORIGIN = "https://yourweddingsite.com"

const NOTION_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

export default {
  async fetch(request, env) {
    // CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname.endsWith('/lookup') && request.method === 'POST') {
        return handleLookup(request, env, corsHeaders);
      }

      if (url.pathname.endsWith('/submit') && request.method === 'POST') {
        return handleSubmit(request, env, corsHeaders);
      }

      return json({ error: 'Not found' }, 404, corsHeaders);
    } catch (err) {
      console.error(err);
      return json({ error: 'Internal error' }, 500, corsHeaders);
    }
  }
};

// ============================================================
// POST /lookup — find guest by name
// ============================================================
async function handleLookup(request, env, corsHeaders) {
  const { name } = await request.json();

  if (!name || typeof name !== 'string') {
    return json({ error: 'Name is required' }, 400, corsHeaders);
  }

  // Query Notion database — case-insensitive search on "Name" property
  const res = await notionFetch(`${NOTION_BASE}/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Name',        // <-- adjust to your property name
        rich_text: {
          equals: name
        }
      }
    })
  }, env);

  const data = await res.json();
  const results = data.results || [];

  // If exact match fails, try a "contains" search as fallback
  if (results.length === 0) {
    const fuzzyRes = await notionFetch(`${NOTION_BASE}/databases/${env.NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          property: 'Name',
          rich_text: {
            contains: name
          }
        }
      })
    }, env);

    const fuzzyData = await fuzzyRes.json();

    if ((fuzzyData.results || []).length === 0) {
      return json({ guest: null }, 200, corsHeaders);
    }

    // Return first fuzzy match
    return json({ guest: formatGuest(fuzzyData.results[0]) }, 200, corsHeaders);
  }

  return json({ guest: formatGuest(results[0]) }, 200, corsHeaders);
}

// ============================================================
// POST /submit — update guest record with RSVP
// ============================================================
async function handleSubmit(request, env, corsHeaders) {
  const body = await request.json();
  const { guestId, attending, dietary, songRequest, notes, plusOneName, plusOneDietary } = body;

  if (!guestId) {
    return json({ error: 'guestId is required' }, 400, corsHeaders);
  }

  // Build the properties to update
  // Adjust these property names to match YOUR Notion database
  const properties = {
    'RSVP': {
      select: {
        name: attending ? 'Attending' : 'Declined'
      }
    },
    'Dietary Requirements': {
      rich_text: [{ text: { content: dietary || '' } }]
    },
    'Song Request': {
      rich_text: [{ text: { content: songRequest || '' } }]
    },
    'Notes': {
      rich_text: [{ text: { content: notes || '' } }]
    },
  };

  // Only write plus-one fields if they provided them
  if (plusOneName) {
    properties['Plus One Name'] = {
      rich_text: [{ text: { content: plusOneName } }]
    };
  }
  if (plusOneDietary) {
    properties['Plus One Dietary'] = {
      rich_text: [{ text: { content: plusOneDietary } }]
    };
  }

  const res = await notionFetch(`${NOTION_BASE}/pages/${guestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties })
  }, env);

  if (!res.ok) {
    const err = await res.text();
    console.error('Notion update failed:', err);
    return json({ error: 'Failed to save RSVP' }, 500, corsHeaders);
  }

  return json({ success: true }, 200, corsHeaders);
}

// ============================================================
// Helpers
// ============================================================

// Extract guest data from a Notion page object
// *** ADJUST property names here to match your database ***
function formatGuest(page) {
  const props = page.properties;

  return {
    id: page.id,
    name: getTitle(props['Name']),
    hasPlusOne: getCheckbox(props['Has Plus One']),
    // Include previous RSVP data so the form can pre-fill
    previousRsvp: getRsvpStatus(props) ? {
      attending: getSelect(props['RSVP']) === 'Attending',
      dietary: getRichText(props['Dietary Requirements']),
      songRequest: getRichText(props['Song Request']),
      notes: getRichText(props['Notes']),
      plusOneName: getRichText(props['Plus One Name']),
      plusOneDietary: getRichText(props['Plus One Dietary']),
    } : null,
  };
}

function getRsvpStatus(props) {
  return getSelect(props['RSVP']) !== null && getSelect(props['RSVP']) !== '';
}

function getTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function getRichText(prop) {
  return prop?.rich_text?.[0]?.plain_text || '';
}

function getCheckbox(prop) {
  return prop?.checkbox || false;
}

function getSelect(prop) {
  return prop?.select?.name || null;
}

async function notionFetch(url, options, env) {
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
  });
}

function json(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
