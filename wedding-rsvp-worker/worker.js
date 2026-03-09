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
//
// Notion database expected properties:
//   Name              — title (guest full name)
//   Code              — rich_text (unique RSVP code sent via email)
//   Email             — email
//   Has Plus One      — checkbox
//   RSVP              — select (Attending / Declined)
//   Dietary Requirements — rich_text
//   Song Request      — rich_text
//   Notes             — rich_text
//   Plus One Name     — rich_text
//   Plus One Dietary  — rich_text
// ============================================================

const NOTION_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

export default {
  async fetch(request, env) {
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
// POST /lookup — find guest by RSVP code
// ============================================================
async function handleLookup(request, env, corsHeaders) {
  const { code } = await request.json();

  if (!code || typeof code !== 'string') {
    return json({ error: 'Code is required' }, 400, corsHeaders);
  }

  const res = await notionFetch(`${NOTION_BASE}/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Code',
        rich_text: {
          equals: code.trim()
        }
      }
    })
  }, env);

  const data = await res.json();
  const results = data.results || [];

  if (results.length === 0) {
    return json({ guest: null }, 200, corsHeaders);
  }

  return json({ guest: formatGuest(results[0]) }, 200, corsHeaders);
}

// ============================================================
// POST /submit — update guest record with RSVP
// ============================================================
async function handleSubmit(request, env, corsHeaders) {
  const body = await request.json();
  const { guestId, attending, name, email, dietary, songRequest, notes, plusOneName, plusOneDietary } = body;

  if (!guestId) {
    return json({ error: 'guestId is required' }, 400, corsHeaders);
  }

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

  if (name) {
    properties['Name'] = {
      title: [{ text: { content: name } }]
    };
  }

  if (email) {
    properties['Email'] = {
      email: email
    };
  }

  if (plusOneName) {
    properties['Plus One Name'] = {
      rich_text: [{ text: { content: plusOneName } }]
    };
  }
  if (plusOneDietary !== undefined) {
    properties['Plus One Dietary'] = {
      rich_text: [{ text: { content: plusOneDietary || '' } }]
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

function formatGuest(page) {
  const props = page.properties;

  return {
    id: page.id,
    name: getTitle(props['Name']),
    email: getEmail(props['Email']),
    hasPlusOne: getCheckbox(props['Has Plus One']),
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

function getEmail(prop) {
  return prop?.email || '';
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
