<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId = $_SESSION["user_id"];


// Fetch the latest notifications with actor info + a snippet of the related post

$stmt = $conn->prepare(
    "SELECT n.id, n.type, n.post_id, n.is_read, n.created_at,
            u.id AS actor_id, u.username, u.firstname, u.lastname, u.avatar,
            p.content AS post_content, p.user_id AS post_owner
     FROM notifications n
     JOIN users u ON u.id = n.actor_id
     LEFT JOIN posts p ON p.id = n.post_id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC
     LIMIT 50"
);

$stmt->bind_param("i", $userId);
$stmt->execute();

$notifications = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$stmt->close();


// Now that we've loaded them, mark everything as read
// (the list above still remembers which ones WERE unread, for highlighting)

$stmt = $conn->prepare(
    "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0"
);

$stmt->bind_param("i", $userId);
$stmt->execute();
$stmt->close();


// Short snippet of a post for context: "liked your post: 'Hello wor...'"

function postSnippet($content) {

    if ($content === null) return "";

    $content = trim($content);

    if ($content === "") return "";

    if (mb_strlen($content) > 40) {
        $content = mb_substr($content, 0, 40) . "...";
    }

    return ": \"" . $content . "\"";

}


$pageTitle = "Notifications";

require_once "includes/header.php";

?>

<main class="feed">

    <div class="card">

        <h2 class="section-title">Notifications</h2>

        <?php if (count($notifications) === 0): ?>

            <p class="muted">
                Nothing here yet. When people like, comment, or follow you, it shows up here.
            </p>

        <?php endif; ?>

        <div class="notif-list">

            <?php foreach ($notifications as $n): ?>

                <?php

                    // Where does clicking the notification take you?
                    // follow  → the actor's profile
                    // like / comment → the profile where the post lives

                    if ($n["type"] === "follow") {

                        $link = "profile.php?id=" . $n["actor_id"];

                    } elseif ($n["type"] === "comment_like") {

                        // My comment got liked → my profile has my activity

                        $link = "profile.php?id=" . $userId;

                    } elseif ($n["type"] === "story_like") {

                        // My story got liked → open my own stories
                        // (if it expired, story.php just sends us home)

                        $link = "story.php?user=" . $userId;

                    } else {

                        $link = "profile.php?id=" . ($n["post_owner"] ?? $userId);

                    }


                    // The text + icon per type

                    switch ($n["type"]) {

                        case "like":
                            $text = "liked your post" . postSnippet($n["post_content"]);
                            $icon = "❤️";
                            break;

                        case "comment":
                            $text = "commented on your post" . postSnippet($n["post_content"]);
                            $icon = "💬";
                            break;

                        case "follow":
                            $text = "started following you";
                            $icon = "➕";
                            break;

                        case "story_like":
                            $text = "liked your story";
                            $icon = "❤️";
                            break;

                        case "comment_like":
                            $text = "liked your comment";
                            $icon = "❤️";
                            break;

                        case "reply":
                            $text = "replied to your comment" . postSnippet($n["post_content"]);
                            $icon = "💬";
                            break;

                        default:
                            $text = "did something";
                            $icon = "🔔";

                    }

                ?>

                <a href="<?= $link; ?>" class="notif <?= $n["is_read"] ? "" : "unread"; ?>">

                    <?= avatarHtml($n["avatar"], $n["firstname"], $n["lastname"]); ?>

                    <div class="notif-body">

                        <p>
                            <strong><?= htmlspecialchars($n["firstname"] . " " . $n["lastname"]); ?></strong>
                            <?= htmlspecialchars($text); ?>
                        </p>

                        <span class="notif-time"><?= timeAgo($n["created_at"]); ?></span>

                    </div>

                    <span class="notif-icon"><?= $icon; ?></span>

                </a>

            <?php endforeach; ?>

        </div>

    </div>

</main>

<script src="assets/app.js"></script>

</body>
</html>