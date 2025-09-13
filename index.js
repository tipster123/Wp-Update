require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const WP_BASE_URL = process.env.WP_BASE_URL; // e.g., https://dev-tgindex.pantheonsite.io/wp-json/wp/v2
const WP_AUTH_USER = process.env.WP_AUTH_USER;
const WP_AUTH_PASS = process.env.WP_AUTH_PASS.replace(/\s/g, ''); // Remove spaces from app password

if (!WP_BASE_URL || !WP_AUTH_USER || !WP_AUTH_PASS) {
  console.error('Missing required environment variables. Please set WP_BASE_URL, WP_AUTH_USER, and WP_AUTH_PASS.');
  process.exit(1);
}

const WP_AUTH_TOKEN = 'Basic ' + Buffer.from(`${WP_AUTH_USER}:${WP_AUTH_PASS}`).toString('base64');

// Helper: Update WordPress post meta using REST API
async function updatePostMeta(postId, metaKey, metaValue) {
  const url = `${WP_BASE_URL}/content_submission/${postId}`;
  const body = {
    meta: {
      [metaKey]: metaValue
    }
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': WP_AUTH_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`WordPress API error [${resp.status}]: ${errorText}`);
  }
  return await resp.json();
}

app.post('/update-telegram', async (req, res) => {
  try {
    const { postId, chatId, membersCount, title, description } = req.body;

    if (!postId) {
      return res.status(400).json({ error: 'postId is required' });
    }

    if (!chatId && !title && membersCount === undefined && !description) {
      return res.status(400).json({ error: 'At least one update field (chatId, title, membersCount, description) is required' });
    }

    if (chatId) {
      await updatePostMeta(postId, '_telegram_chat_id', chatId);
    }
    if (typeof membersCount === 'number') {
      await updatePostMeta(postId, '_telegram_members', membersCount);
    }
    if (title) {
      await updatePostMeta(postId, 'telegram_title', title);
      // Optionally update post title too
      await fetch(`${WP_BASE_URL}/posts/${postId}`, {
        method: 'POST',
        headers: {
          'Authorization': WP_AUTH_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title })
      });
    }
    if (description) {
      await updatePostMeta(postId, 'telegram_description', description);
    }

    return res.json({ success: true, message: `Post ${postId} updated successfully.` });
  } catch (error) {
    console.error('Update error:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Telegram Updater backend listening on port ${PORT}`);
});
