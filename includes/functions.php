<?php

require_once __DIR__ . "/database.php";


// Redirect guests to login

function requireLogin() {

    if (!isset($_SESSION["user_id"])) {
        header("Location: login.php");
        exit;
    }

}


// "5m ago" style timestamps

function timeAgo($datetime) {

    $diff = time() - strtotime($datetime);

    if ($diff < 60)     return "just now";
    if ($diff < 3600)   return floor($diff / 60) . "m ago";
    if ($diff < 86400)  return floor($diff / 3600) . "h ago";
    if ($diff < 604800) return floor($diff / 86400) . "d ago";

    return date("M j, Y", strtotime($datetime));

}


// Initials for avatar circles

function initials($first, $last) {

    return strtoupper(mb_substr((string)$first, 0, 1) . mb_substr((string)$last, 0, 1));

}


// Avatar: image if the user has one, otherwise initials circle
// ($avatar is now a URL like "media.php?id=42", or an old uploads/ path)

function avatarHtml($avatar, $first, $last, $extraClass = "") {

    if ($avatar) {

        return '<img class="avatar ' . $extraClass . '" src="' . htmlspecialchars($avatar) . '" alt="">';

    }

    return '<div class="avatar ' . $extraClass . '">' . htmlspecialchars(initials($first, $last)) . '</div>';

}


/*
 * Validate an uploaded image (real mime check via finfo + size limit)
 * WITHOUT saving it anywhere. The caller inserts the bytes into its
 * own table using sendBlob().
 *
 * Returns: ["tmp" => tmp_path, "mime" => mime] on success
 *          ["error" => "message"] on failure
 *          null if no file was sent
 */

function validateImage($file, $maxBytes = 5242880) {

    if (!isset($file) || $file["error"] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if ($file["error"] !== UPLOAD_ERR_OK) {
        return ["error" => "Upload failed. Please try again."];
    }

    if ($file["size"] > $maxBytes) {
        return ["error" => "Image is too large (max " . round($maxBytes / 1048576) . " MB)."];
    }


    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file["tmp_name"]);

    $allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    if (!in_array($mime, $allowed, true)) {
        return ["error" => "Only JPG, PNG, GIF and WEBP images are allowed."];
    }


    return ["tmp" => $file["tmp_name"], "mime" => $mime];

}


/*
 * Validate an uploaded video the same way.
 *
 * Max 50 MB: media.php loads the whole blob into PHP memory to
 * serve it, so bigger videos need a higher memory_limit in php.ini.
 */

function validateVideo($file, $maxBytes = 52428800) {

    if (!isset($file) || $file["error"] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if ($file["error"] === UPLOAD_ERR_INI_SIZE || $file["error"] === UPLOAD_ERR_FORM_SIZE) {
        return ["error" => "Video is too large for the server settings. Increase upload_max_filesize in php.ini."];
    }

    if ($file["error"] !== UPLOAD_ERR_OK) {
        return ["error" => "Upload failed. Please try again."];
    }

    if ($file["size"] > $maxBytes) {
        return ["error" => "Video is too large (max " . round($maxBytes / 1048576) . " MB)."];
    }


    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file["tmp_name"]);

    $allowed = ["video/mp4", "video/webm", "video/quicktime"];

    if (!in_array($mime, $allowed, true)) {
        return ["error" => "Only MP4, WEBM and MOV videos are allowed."];
    }


    return ["tmp" => $file["tmp_name"], "mime" => $mime];

}


/*
 * Stream a file's bytes into a bound blob parameter, 1 MB at a time,
 * so big videos don't hit MySQL's max_allowed_packet limit.
 *
 * $index is the ZERO-BASED position of the blob in the query.
 */

function sendBlob($stmt, $index, $tmpPath) {

    $fp = fopen($tmpPath, "rb");

    while (!feof($fp)) {

        $stmt->send_long_data($index, fread($fp, 1048576));

    }

    fclose($fp);

}


/* ============================================
 * Hashtags
 * ============================================ */


// Pull unique lowercase tag names out of post content.
// #hello and #Hello count as the same tag.

function extractHashtags($content) {

    preg_match_all('/#([a-zA-Z0-9_]{2,50})/u', (string)$content, $matches);

    $tags = array_map("mb_strtolower", $matches[1]);

    return array_values(array_unique($tags));

}


/*
 * Sync a post's hashtag links to match its current content.
 * Call this after inserting OR updating a post's content.
 *
 * Always clears old links first, so editing a tag out of a post
 * (or removing all tags) is handled the same way as adding one.
 */

function syncPostHashtags($conn, $postId, $content) {

    $stmt = $conn->prepare("DELETE FROM post_hashtags WHERE post_id = ?");
    $stmt->bind_param("i", $postId);
    $stmt->execute();
    $stmt->close();


    foreach (extractHashtags($content) as $tag) {


        // Find or create the hashtag row

        $stmt = $conn->prepare("SELECT id FROM hashtags WHERE name = ?");
        $stmt->bind_param("s", $tag);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();


        if ($row) {

            $hashtagId = (int)$row["id"];

        } else {

            $stmt = $conn->prepare("INSERT INTO hashtags (name) VALUES (?)");
            $stmt->bind_param("s", $tag);
            $stmt->execute();
            $hashtagId = $stmt->insert_id;
            $stmt->close();

        }


        $stmt = $conn->prepare(
            "INSERT IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)"
        );

        $stmt->bind_param("ii", $postId, $hashtagId);
        $stmt->execute();
        $stmt->close();

    }

}


/*
 * Escape post content, THEN make #hashtags clickable links to
 * hashtag.php — same escape-first-then-wrap safety pattern as
 * linkifyText() below.
 */

function linkifyHashtags($text) {

    $escaped = nl2br(htmlspecialchars($text));

    return preg_replace(
        '/#([a-zA-Z0-9_]{2,50})/u',
        '<a href="hashtag.php?tag=$1" class="hashtag-link">#$1</a>',
        $escaped
    );

}


/*
 * Render one post card.
 * Used by home.php (feed), profile.php (user's posts), and
 * hashtag.php (posts under a tag).
 */

function renderPost($post, $postComments, $currentUserId) {

    $isOwner   = (int)$post["user_id"] === (int)$currentUserId;
    $wasEdited = !empty($post["updated_at"]);

    // Comment counter includes replies

    $totalComments = 0;

    foreach ($postComments as $tc) {
        $totalComments += 1 + count($tc["replies"] ?? []);
    }

    ?>

    <article class="card post"
             data-post-id="<?= $post["id"]; ?>"
             data-content="<?= htmlspecialchars($post["content"]); ?>">

        <div class="post-header">

            <a href="profile.php?id=<?= $post["user_id"]; ?>">
                <?= avatarHtml($post["avatar"], $post["firstname"], $post["lastname"]); ?>
            </a>

            <div class="post-meta">

                <a class="post-author" href="profile.php?id=<?= $post["user_id"]; ?>">
                    <?= htmlspecialchars($post["firstname"] . " " . $post["lastname"]); ?>
                </a>

                <span>
                    @<?= htmlspecialchars($post["username"]); ?>
                    · <?= timeAgo($post["created_at"]); ?>
                    <?php if ($wasEdited): ?> · <em>edited</em><?php endif; ?>
                </span>

            </div>

            <?php if ($isOwner): ?>

                <button class="iconBtn editBtn" title="Edit post">✏️</button>
                <button class="iconBtn deleteBtn" title="Delete post">✕</button>

            <?php endif; ?>

        </div>

        <p class="post-content"><?= linkifyHashtags($post["content"]); ?></p>

        <?php if (!empty($post["image"])): ?>

            <img class="post-image" src="<?= htmlspecialchars($post["image"]); ?>" alt="Post photo">

        <?php endif; ?>

        <?php if (!empty($post["video"])): ?>

            <video class="post-video"
                   src="<?= htmlspecialchars($post["video"]); ?>"
                   controls
                   preload="metadata"></video>

        <?php endif; ?>

        <div class="post-actions">

            <button class="likeBtn <?= $post["liked_by_me"] ? "liked" : ""; ?>">
                <span class="heart"><?= $post["liked_by_me"] ? "❤️" : "🤍"; ?></span>
                <span class="likeCount"><?= $post["like_count"]; ?></span>
            </button>

            <button class="commentToggle">
                💬 <span class="commentCount"><?= $totalComments; ?></span>
            </button>

        </div>

        <div class="comments" hidden>

            <div class="comment-list">

                <?php foreach ($postComments as $c): ?>

                    <?php renderComment($c, $currentUserId); ?>

                <?php endforeach; ?>

            </div>

            <form class="comment-form">

                <input type="text" name="comment" placeholder="Write a comment..."
                       maxlength="500" autocomplete="off">

                <button type="submit" class="submitBtn small">Send</button>

            </form>

        </div>

    </article>

    <?php

}


/*
 * Fetch all comments grouped by post_id, as a tree:
 * top-level comments carry their replies in a "replies" array.
 * Each comment also knows its like count and whether I liked it.
 */

function fetchCommentsGrouped($conn, $userId) {

    $stmt = $conn->prepare(
        "SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
                u.username, u.firstname, u.lastname, u.avatar,

                (SELECT COUNT(*) FROM likes l
                 WHERE l.content_type = 'comment' AND l.content_id = c.id
                   AND l.deleted_at IS NULL) AS like_count,

                (SELECT COUNT(*) FROM likes l
                 WHERE l.content_type = 'comment' AND l.content_id = c.id
                   AND l.user_id = ? AND l.deleted_at IS NULL) AS liked_by_me

         FROM comments c
         JOIN users u ON u.id = CAST(c.user_id AS UNSIGNED)
         WHERE c.deleted_at IS NULL
         ORDER BY c.created_at ASC"
    );

    $stmt->bind_param("i", $userId);
    $stmt->execute();

    $all = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $stmt->close();


    // First pass: collect replies under their parent id

    $repliesByParent = [];

    foreach ($all as $row) {

        if (!empty($row["parent_id"])) {
            $repliesByParent[$row["parent_id"]][] = $row;
        }

    }


    // Second pass: top-level comments get their replies attached

    $grouped = [];

    foreach ($all as $row) {

        if (empty($row["parent_id"])) {

            $row["replies"] = $repliesByParent[$row["id"]] ?? [];

            $grouped[$row["post_id"]][] = $row;

        }

    }

    return $grouped;

}


/*
 * Render one comment (or reply): body, like button, reply button.
 * Replies render themselves through the same function.
 */

function renderComment($c, $currentUserId) {

    ?>

    <div class="comment" data-comment-id="<?= $c["id"]; ?>">

        <?= avatarHtml($c["avatar"], $c["firstname"], $c["lastname"], "small"); ?>

        <div class="comment-main">

            <div class="comment-body">

                <strong><?= htmlspecialchars($c["firstname"] . " " . $c["lastname"]); ?></strong>

                <p><?= nl2br(htmlspecialchars($c["content"])); ?></p>

            </div>

            <div class="comment-actions">

                <button class="cLikeBtn <?= $c["liked_by_me"] ? "liked" : ""; ?>">
                    <span class="cHeart"><?= $c["liked_by_me"] ? "❤️" : "🤍"; ?></span>
                    <span class="cLikeCount"><?= $c["like_count"]; ?></span>
                </button>

                <button class="replyBtn">Reply</button>

                <span class="comment-time"><?= timeAgo($c["created_at"]); ?></span>

            </div>

            <div class="replies">

                <?php foreach ($c["replies"] ?? [] as $r): ?>

                    <?php renderComment($r, $currentUserId); ?>

                <?php endforeach; ?>

            </div>

            <form class="reply-form" hidden>

                <input type="text" placeholder="Write a reply..."
                       maxlength="500" autocomplete="off">

                <button type="submit" class="submitBtn small">Send</button>

            </form>

        </div>

    </div>

    <?php

}


/* ============================================
 * Notifications
 * ============================================ */


function addNotification($conn, $recipientId, $actorId, $type, $postId = null) {

    if ((int)$recipientId === (int)$actorId) {
        return;
    }

    $stmt = $conn->prepare(
        "INSERT INTO notifications (user_id, actor_id, type, post_id)
         VALUES (?, ?, ?, ?)"
    );

    $stmt->bind_param("iisi", $recipientId, $actorId, $type, $postId);
    $stmt->execute();
    $stmt->close();

}


function removeNotification($conn, $recipientId, $actorId, $type, $postId = null) {

    if ($postId === null) {

        $stmt = $conn->prepare(
            "DELETE FROM notifications
             WHERE user_id = ? AND actor_id = ? AND type = ? AND post_id IS NULL"
        );

        $stmt->bind_param("iis", $recipientId, $actorId, $type);

    } else {

        $stmt = $conn->prepare(
            "DELETE FROM notifications
             WHERE user_id = ? AND actor_id = ? AND type = ? AND post_id = ?"
        );

        $stmt->bind_param("iisi", $recipientId, $actorId, $type, $postId);

    }

    $stmt->execute();
    $stmt->close();

}


function unreadNotifications($conn, $userId) {

    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS total
         FROM notifications
         WHERE user_id = ? AND is_read = 0"
    );

    $stmt->bind_param("i", $userId);
    $stmt->execute();

    $count = $stmt->get_result()->fetch_assoc()["total"];

    $stmt->close();

    return (int)$count;

}


// How many unread messages does a user have (across all chats)?

function unreadMessages($conn, $userId) {

    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS total
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE (c.user1_id = ? OR c.user2_id = ?)
           AND m.sender_id != ?
           AND m.is_read = 0"
    );

    $stmt->bind_param("iii", $userId, $userId, $userId);
    $stmt->execute();

    $count = $stmt->get_result()->fetch_assoc()["total"];

    $stmt->close();

    return (int)$count;

}


/*
 * Messenger-style time labels for the inbox:
 * today → "14:32", yesterday → "Yesterday",
 * this week → "Monday", older → "Jul 12" (with year if not this year)
 */

function chatTime($datetime) {

    $ts  = strtotime($datetime);
    $day = date("Y-m-d", $ts);

    if ($day === date("Y-m-d")) {
        return date("H:i", $ts);
    }

    if ($day === date("Y-m-d", strtotime("-1 day"))) {
        return "Yesterday";
    }

    if ($ts > strtotime("-6 days")) {
        return date("l", $ts);          // weekday name
    }

    if (date("Y", $ts) === date("Y")) {
        return date("M j", $ts);
    }

    return date("M j, Y", $ts);

}


/*
 * Make URLs in a message clickable.
 * IMPORTANT ORDER: the text is escaped FIRST (so nobody can inject
 * HTML), and only then are the harmless escaped URLs wrapped in <a>.
 */

function linkifyText($text) {

    $escaped = nl2br(htmlspecialchars($text));

    return preg_replace(
        '~(https?://[^\s<]+)~i',
        '<a href="$1" target="_blank" rel="noopener">$1</a>',
        $escaped
    );

}


/*
 * Is this message just 1-3 emoji? Then it renders BIG (jumbo),
 * like every modern messenger does.
 */

function isJumboEmoji($text) {

    $t = trim($text);

    if ($t === "" || mb_strlen($t) > 8) {
        return false;
    }

    // No letters, digits or normal punctuation → treat as emoji-only

    return !preg_match('/[\p{L}\p{N}\p{P}]/u', $t);

}