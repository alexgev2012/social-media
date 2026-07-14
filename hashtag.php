<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId = $_SESSION["user_id"];
$error  = "";


$tag = mb_strtolower(trim($_GET["tag"] ?? ""));

if ($tag === "") {

    header("Location: home.php");
    exit;

}


// Handle "post directly into this label" — the tag is always
// attached to the post, even if the user didn't type the # themselves

if ($_SERVER["REQUEST_METHOD"] === "POST") {


    $content = trim($_POST["content"] ?? "");


    if ($content === "") {

        $error = "Write something to post.";

    }

    elseif (mb_strlen($content) > 1000) {

        $error = "Post is too long (max 1000 characters).";

    }

    else {


        if (!in_array($tag, extractHashtags($content), true)) {

            $content = rtrim($content) . " #" . $tag;

        }


        $stmt = $conn->prepare(
            "INSERT INTO posts (user_id, content, status, created_at)
             VALUES (?, ?, 0, NOW())"
        );

        $stmt->bind_param("is", $userId, $content);
        $stmt->execute();

        $postId = $stmt->insert_id;

        $stmt->close();


        syncPostHashtags($conn, $postId, $content);


        header("Location: hashtag.php?tag=" . urlencode($tag));
        exit;

    }

}


// Does this hashtag exist?

$stmt = $conn->prepare("SELECT id FROM hashtags WHERE name = ?");
$stmt->bind_param("s", $tag);
$stmt->execute();
$hashtag = $stmt->get_result()->fetch_assoc();
$stmt->close();


$posts = [];

if ($hashtag) {


    $stmt = $conn->prepare(
        "SELECT p.id, p.user_id, p.content, p.image, p.video, p.created_at, p.updated_at,
                u.username, u.firstname, u.lastname, u.avatar,

                (SELECT COUNT(*) FROM likes l
                 WHERE l.content_type = 'post' AND l.content_id = p.id
                   AND l.deleted_at IS NULL) AS like_count,

                (SELECT COUNT(*) FROM likes l
                 WHERE l.content_type = 'post' AND l.content_id = p.id
                   AND l.user_id = ? AND l.deleted_at IS NULL) AS liked_by_me

         FROM post_hashtags ph
         JOIN posts p ON p.id = ph.post_id
         JOIN users u ON u.id = p.user_id
         WHERE ph.hashtag_id = ? AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC
         LIMIT 50"
    );

    $stmt->bind_param("ii", $userId, $hashtag["id"]);
    $stmt->execute();

    $posts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $stmt->close();

}


$comments = fetchCommentsGrouped($conn, $userId);


$pageTitle = "#" . $tag;

require_once "includes/header.php";

?>

<main class="feed">

    <div class="card">

        <h2 class="section-title">#<?= htmlspecialchars($tag); ?></h2>

        <span class="muted">
            <?= count($posts); ?> <?= count($posts) === 1 ? "post" : "posts"; ?>
        </span>

    </div>

    <!-- Post directly into this label -->

    <div class="card composer">

        <?php if ($error): ?>

            <div class="composer-error"><?= htmlspecialchars($error); ?></div>

        <?php endif; ?>

        <form method="POST" id="hashtagPostForm">

            <textarea
                name="content"
                placeholder="Post something in #<?= htmlspecialchars($tag); ?>..."
                maxlength="1000"
                rows="3"
            ></textarea>

            <div class="composer-footer">

                <span class="muted">Tagged with #<?= htmlspecialchars($tag); ?></span>

                <button type="submit" class="submitBtn">Post</button>

            </div>

        </form>

    </div>

    <?php if (count($posts) === 0): ?>

        <div class="card empty">

            <h2>No posts yet</h2>
            <p>Be the first to post under #<?= htmlspecialchars($tag); ?>.</p>

        </div>

    <?php endif; ?>

    <?php foreach ($posts as $post): ?>

        <?php renderPost($post, $comments[$post["id"]] ?? [], $userId); ?>

    <?php endforeach; ?>

</main>

<script src="assets/app.js"></script>

</body>
</html>